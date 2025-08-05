import { NextRequest, NextResponse } from 'next/server';

interface JinaSearchResult {
  title: string;
  url: string;
  description: string;
}

interface ParsedLinkedInContact {
  name: string;
  title: string;
  linkedinUrl: string;
  description: string;
  company?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { company, apiKey } = await request.json();
    if (!company || !apiKey) {
      return NextResponse.json({ error: 'Missing company or apiKey' }, { status: 400 });
    }

    // Make the Jina.ai request
    const searchQuery = `${company} Recruiting Talent Acquisition site:linkedin.com/in/`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const jinaUrl = `https://s.jina.ai/?q=${encodedQuery}&hl=en&gl=US`;
    
    console.log('🔍 Making Jina.ai request to:', jinaUrl);
    
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Respond-With': 'markdown',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Jina.ai request failed' }, { status: response.status });
    }

    const rawData = await response.text();
    console.log('🔍 Jina.ai Raw Response length:', rawData.length);
    console.log('🔍 Jina.ai Raw Response sample:', rawData.substring(0, 500));
    
    // Check if Jina.ai returned an error or usage instructions
    if (rawData.includes('[Usage') || rawData.includes('Authenticated as') || rawData.length < 100) {
      console.error('🔍 Jina.ai returned error or usage instructions instead of search results');
      return NextResponse.json({ 
        error: 'Jina.ai search failed. Please check your API key and try again.',
        details: rawData.substring(0, 200)
      }, { status: 400 });
    }

    // Use only Gemini AI for parsing
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ 
        error: 'Gemini API key is required for parsing search results',
        details: 'Please set GEMINI_API_KEY environment variable'
      }, { status: 400 });
    }

    const geminiResults = await enhanceWithGemini(rawData, company, geminiApiKey);
    if (geminiResults && geminiResults.length > 0) {
      return NextResponse.json({
        success: true,
        results: geminiResults,
        totalResults: geminiResults.length,
        company: company
      });
    } else {
      return NextResponse.json({ 
        error: 'No valid LinkedIn profiles found in search results',
        details: 'The AI parser could not extract any valid profiles from the search results'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error in /api/jina-search:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

/**
 * Enhance parsing with Gemini AI
 */
async function enhanceWithGemini(rawData: string, company: string, apiKey: string): Promise<ParsedLinkedInContact[]> {
  try {
    const prompt = `
You are a LinkedIn profile parser. Extract all LinkedIn contacts from the following markdown search results.

Company being searched: ${company}

Instructions:
1. Look for LinkedIn profile URLs (linkedin.com/in/...)
2. Extract the person's name and job title from the search result titles and descriptions
3. Focus on HR, recruiting, and talent acquisition roles
4. Only include valid LinkedIn profiles
5. If a title is not found, use an empty string instead of null
6. Return a JSON array with this exact structure:

[
  {
    "name": "Full Name",
    "title": "Job Title or empty string",
    "linkedinUrl": "https://www.linkedin.com/in/username",
    "description": "Profile description from search results",
    "company": "${company}"
  }
]

Raw markdown search results:
${rawData}

Return only valid JSON, no other text. Do not make any external API calls.
`;
    console.log('🔍 Calling Gemini API with prompt length:', prompt.length);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        }
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔍 Gemini API error:', response.status, response.statusText);
      console.error('🔍 Gemini error details:', errorText);
      return [];
    }
    
    const data = await response.json();
    console.log('🔍 Gemini API response structure:', Object.keys(data));
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      console.error('🔍 No text generated by Gemini');
      console.error('🔍 Gemini response data:', JSON.stringify(data, null, 2));
      return [];
    }

    console.log('🔍 Gemini generated text length:', generatedText.length);
    console.log('🔍 Gemini response preview:', generatedText.substring(0, 500));
    // Try to extract JSON from the response
    const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('🔍 No JSON found in Gemini response');
      return [];
    }
    const parsedResults = JSON.parse(jsonMatch[0]);
    console.log('🔍 Parsed Gemini results:', parsedResults);
    return parsedResults.map((result: any) => ({
      name: result.name || 'Unknown',
      title: result.title || '',
      linkedinUrl: result.linkedinUrl || '',
      description: result.description || '',
      company: result.company || company
    }));
  } catch (error) {
    console.error('🔍 Error enhancing with Gemini:', error);
    return [];
  }
} 