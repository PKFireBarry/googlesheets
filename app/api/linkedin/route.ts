import { NextRequest, NextResponse } from 'next/server';

interface JinaSearchResult {
  name: string;
  title: string;
  linkedinUrl: string;
  description: string;
  company?: string;
}

interface ParsedLinkedInContact {
  name: string;
  title: string;
  linkedinUrl: string;
  description: string;
  company?: string;
  location?: string;
  experience?: string;
}

interface LinkedInContactData {
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  website: string;
  profileImage: string;
  company: string;
  phone: string;
  location: string;
  [key: string]: unknown;
}

/**
 * POST handler for LinkedIn lookup using Jina.ai search
 * Replaces browser automation with fast Jina.ai search + AI parsing
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract company and optional API keys
    const { company, apiKey, jinaApiKey } = body;
    
    // Check if company is provided
    if (!company) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Use provided API key or fall back to environment variable
    const jinaApiKeyToUse = jinaApiKey || process.env.JINA_API_KEY || process.env.NEXT_PUBLIC_JINA_API_KEY;
    
    console.log('🔍 Environment check:', {
      jinaApiKeyProvided: jinaApiKey ? 'YES' : 'NO',
      JINA_API_KEY: process.env.JINA_API_KEY ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_JINA_API_KEY: process.env.NEXT_PUBLIC_JINA_API_KEY ? 'SET' : 'NOT SET',
      finalKey: jinaApiKeyToUse ? 'AVAILABLE' : 'MISSING'
    });
    
    if (!jinaApiKeyToUse) {
      return NextResponse.json(
        { error: 'Jina.ai API key is required. Please set JINA_API_KEY environment variable or provide via request.' },
        { status: 400 }
      );
    }
    
    console.log(`Looking up LinkedIn HR contacts for company: ${company} using Jina.ai`);
    
    try {
      // Make the Jina.ai search request with more specific query
      const searchQuery = `"${company}" ("HR Manager" OR "Human Resources" OR "Talent Acquisition" OR "Recruiting Manager" OR "People Operations" OR "Recruiter") site:linkedin.com/in/`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const jinaUrl = `https://s.jina.ai/?q=${encodedQuery}&hl=en&gl=US`;
      
      console.log('🔍 Making Jina.ai request to:', jinaUrl);
      console.log('🔍 Using API key (first 10 chars):', jinaApiKeyToUse.substring(0, 10) + '...');
      
      const jinaResponse = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jinaApiKeyToUse}`,
          'X-Respond-With': 'markdown',
        },
      });
      
      console.log('🔍 Jina.ai Response status:', jinaResponse.status);
      console.log('🔍 Jina.ai Response headers:', Object.fromEntries(jinaResponse.headers.entries()));

      if (!jinaResponse.ok) {
        throw new Error(`Jina.ai request failed: ${jinaResponse.statusText}`);
      }

      const rawData = await jinaResponse.text();
      console.log('🔍 Jina.ai Raw Response length:', rawData.length);
      console.log('🔍 Jina.ai Raw Response (first 500 chars):', rawData.substring(0, 500));
      
      // Check if Jina.ai returned an error or usage instructions
      if (rawData.includes('[Usage') || rawData.includes('Authenticated as')) {
        console.error('🔍 Jina.ai returned error or usage instructions instead of search results');
        console.error('🔍 Full Jina.ai response:', rawData);
        throw new Error(`Jina.ai search failed. Response: ${rawData.substring(0, 200)}`);
      }
      
      // If response is very short but doesn't contain error messages, it might just be no results
      if (rawData.length < 50) {
        console.warn('🔍 Jina.ai returned very short response, might be no search results');
        console.warn('🔍 Full response:', JSON.stringify(rawData));
        return NextResponse.json([]); // Return empty array for no results
      }

      // Use Gemini AI for parsing
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('Gemini API key is required for parsing search results');
      }

      const parsedResults = await enhanceWithGemini(rawData, company, geminiApiKey);
      
      if (!parsedResults || parsedResults.length === 0) {
        throw new Error('No valid LinkedIn profiles found in search results');
      }

      // Convert to LinkedInContactData format expected by frontend
      const linkedInContacts = convertToLinkedInContactData(parsedResults, company);

      return NextResponse.json(linkedInContacts);
      
    } catch (error) {
      console.error('Error in LinkedIn lookup:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'LinkedIn lookup failed' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error initiating LinkedIn HR lookup:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to enhance parsing with Gemini AI
 * @param rawData Raw markdown data from Jina.ai
 * @param company Company name being searched
 * @param apiKey Gemini API key
 * @returns Parsed LinkedIn contact data
 */
async function enhanceWithGemini(rawData: string, company: string, apiKey: string): Promise<ParsedLinkedInContact[]> {
  try {
    const prompt = `
You are a LinkedIn profile parser specializing in extracting HR and recruiting professionals. Extract LinkedIn contacts from the search results below.

Company being searched: ${company}

CRITICAL INSTRUCTIONS:
1. Extract LinkedIn profile URLs (linkedin.com/in/...)
2. CAREFULLY extract job titles from the text - look for titles like:
   - HR Manager, Human Resources Director, Talent Acquisition Specialist
   - Recruiting Manager, Senior Recruiter, Talent Partner
   - People Operations, Chief People Officer, VP of People
   - Any role containing "HR", "Human Resources", "Talent", "Recruiting", "People"
3. Extract the person's full name from the profile information
4. Look for location information (city, state, country)
5. Extract years of experience if mentioned
6. Focus on HR, recruiting, and talent acquisition roles ONLY
7. If no clear title is found, analyze the description and infer the most likely HR-related role
8. CREATE CLEAN, PROFESSIONAL DESCRIPTIONS: Instead of copying raw HTML/text, create a concise 1-2 sentence professional summary based on their role and experience
9. Return a JSON array with this EXACT structure:

[
  {
    "name": "Full Name",
    "title": "Specific Job Title (never empty - infer from description if needed)",
    "linkedinUrl": "https://www.linkedin.com/in/username",
    "description": "Professional summary: [Role] at [Company] with [experience/background] in [relevant areas]. [Key responsibility or specialty if mentioned].",
    "company": "${company}",
    "location": "City, State or extracted location",
    "experience": "Number of years if mentioned"
  }
]

DESCRIPTION EXAMPLES:
- Instead of: "CAO / CHRO, who drives transformative change and strategic programs across global… · Experience: ADT"
- Write: "Chief Administrative Officer and Chief Human Resources Officer at ADT, specializing in transformative change and strategic program management across global operations."

- Instead of: "As a Manager at ADT for Talent Acquisition Programs, I'm responsible for outreach and…"
- Write: "Manager of Talent Acquisition Programs at ADT, responsible for recruitment outreach and program development."

EXAMPLE of good extraction:
If you see "Dinah Ruiz - Results driven, self-motivated, and team-oriented leader with over 15 years of experience at Royal Caribbean Group"
You should extract title as "HR Leader" or "Human Resources Manager" (infer from context)

Raw markdown search results:
${rawData}

Return ONLY valid JSON with clean, professional descriptions, no other text.
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
      title: result.title || 'HR Professional', // Default title if still empty
      linkedinUrl: result.linkedinUrl || '',
      description: result.description || '',
      company: result.company || company,
      location: result.location || '',
      experience: result.experience || ''
    }));
  } catch (error) {
    console.error('🔍 Error enhancing with Gemini:', error);
    return [];
  }
}

/**
 * Convert parsed results to LinkedInContactData format expected by frontend
 * @param parsedResults Results from Gemini parsing
 * @param company Company name
 * @returns Array of LinkedInContactData
 */
function convertToLinkedInContactData(parsedResults: ParsedLinkedInContact[], company: string): LinkedInContactData[] {
  return parsedResults.map(result => ({
    name: result.name,
    title: result.title,
    email: '', // Not available from search
    linkedinUrl: result.linkedinUrl,
    website: '', // Not available from search
    profileImage: '', // Not available from search
    company: result.company || company,
    phone: '', // Not available from search
    location: result.location || '', // Now extracted from search
    description: result.description, // Additional field for description
    experience: result.experience || '' // Additional field for experience
  }));
} 
