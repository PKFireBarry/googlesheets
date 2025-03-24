import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Extracts JSON from a possibly markdown-formatted response
 * @param text The raw text from Gemini, possibly containing markdown
 * @returns The cleaned JSON string
 */
const extractJsonFromResponse = (text: string): string => {
  // Try to extract JSON from markdown code blocks (```json...```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    console.log('Found JSON in code block, extracting...');
    return codeBlockMatch[1].trim();
  }

  // Try to extract anything that looks like JSON (starts with { and ends with })
  const jsonObjectMatch = text.match(/({[\s\S]*})/);
  if (jsonObjectMatch && jsonObjectMatch[1]) {
    console.log('Found potential JSON object structure, extracting...');
    return jsonObjectMatch[1].trim();
  }

  // If we can't find JSON patterns, return the original text
  return text.trim();
};

/**
 * POST handler for Gemini API
 * This processes LinkedIn data using Google's Gemini Flash 2.0 model
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract data from the request
    const { rawData, company, apiKey, jobData } = body;
    
    // Check if required data is provided
    if (!rawData) {
      return NextResponse.json(
        { error: 'Raw data is required' },
        { status: 400 }
      );
    }
    
    // Use provided API key or environment variable
    // Try both client-side and server-side environment variables
    const geminiApiKey = apiKey || 
                        process.env.GEMINI_API_KEY || 
                        process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required. Please provide it in your request or set it in your environment variables.' },
        { status: 400 }
      );
    }
    
    // Log API key usage (securely)
    console.log(`Using API key for Gemini: ${geminiApiKey.substring(0, 5)}... (${apiKey ? 'user provided' : 'from environment'})`);
    
    // Process job data if provided
    let jobDetailsSection = '';
    if (jobData) {
      console.log('Job data provided for personalized messages');
      
      // Extract key job details
      const jobTitle = jobData.title || jobData.job_title || 'Unknown Position';
      const jobDescription = jobData.description || jobData.job_description || '';
      const jobRequirements = jobData.requirements || '';
      const jobSkills = jobData.skills || '';
      
      // Format job details for the prompt
      jobDetailsSection = `
Here are details about the job for which you're crafting a personalized outreach message:

Job Title: ${jobTitle}
Company: ${company}
${jobDescription ? `Description: ${jobDescription}` : ''}
${jobRequirements ? `Requirements: ${jobRequirements}` : ''}
${jobSkills ? `Skills: ${jobSkills}` : ''}

Please use these details to personalize the response and make it more relevant to the specific job opening.`;
    }
    
    // Prepare the prompt for Gemini
    const prompt = `Extract the personal details and profile image URL from this output from a linkedin account search. 
If data is missing just add n/a to the field.

${JSON.stringify(rawData)}

${jobDetailsSection}

Here is the format of how I want you to respond. Only reply with information in this format do not include any other text or markdown formatting in your response:

{
  "name": "extracted name or n/a",
  "title": "extracted title or n/a",
  "email": "extracted email or n/a",
  "linkedinUrl": "extracted LinkedIn URL or n/a",
  "website": "extracted website or n/a",
  "profileImage": "extracted profile image URL or n/a",
  "company": "${company || 'n/a'}",
  "phone": "extracted phone or n/a",
  "location": "extracted location or n/a",
  "suggestedMessage": "Create a personalized outreach message based on the job details and the recruiter's information. The message should be professional and highlight how the candidate is relevant for the specific position."
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, and no extra text before or after the JSON.`;

    console.log('Calling Gemini API with prompt:', prompt.substring(0, 150) + '...');
    
    // Create the API URL with the API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
    // Call the Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Lower temperature for more deterministic output
          topP: 0.8,
          topK: 40
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      
      // Provide more specific error messages for common API key issues
      if (response.status === 400) {
        return NextResponse.json(
          { error: 'Invalid request to Gemini API. Check your API key format.' },
          { status: 400 }
        );
      } else if (response.status === 403) {
        return NextResponse.json(
          { error: 'Access denied by Gemini API. Your API key may be invalid or you may have exceeded your quota.' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `Gemini API error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Gemini API response structure:', Object.keys(data));
    
    // Extract the text from the Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    console.log('Raw text from Gemini:', rawText.substring(0, 100) + (rawText.length > 100 ? '...' : ''));
    
    // Clean up the text to extract JSON
    const cleanedText = extractJsonFromResponse(rawText);
    console.log('Cleaned text for parsing:', cleanedText.substring(0, 100) + (cleanedText.length > 100 ? '...' : ''));
    
    // Parse the text as JSON
    try {
      // Try to parse the response as JSON
      const parsedData = JSON.parse(cleanedText);
      console.log('Successfully parsed Gemini response as JSON:', parsedData);
      
      // Validate the parsed data has the expected structure
      const validatedData = {
        name: parsedData.name || 'n/a',
        title: parsedData.title || 'n/a',
        email: parsedData.email || 'n/a',
        linkedinUrl: parsedData.linkedinUrl || 'n/a',
        website: parsedData.website || 'n/a',
        profileImage: parsedData.profileImage || 'n/a',
        company: parsedData.company || company || 'n/a',
        phone: parsedData.phone || 'n/a',
        location: parsedData.location || 'n/a',
        suggestedMessage: parsedData.suggestedMessage || ''
      };
      
      return NextResponse.json(validatedData);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e);
      console.log('Cleaned text that failed to parse:', cleanedText);
      
      // Try to make the text valid JSON by doing some additional cleaning
      try {
        // Replace single quotes with double quotes
        const fixedJson = cleanedText.replace(/'/g, '"')
          // Fix common issues like trailing commas
          .replace(/,\s*}/g, '}')
          // Add quotes around unquoted keys
          .replace(/(\w+):/g, '"$1":');
          
        console.log('Attempting to parse cleaned JSON:', fixedJson);
        const correctedData = JSON.parse(fixedJson);
        
        const validatedData = {
          name: correctedData.name || 'n/a',
          title: correctedData.title || 'n/a',
          email: correctedData.email || 'n/a',
          linkedinUrl: correctedData.linkedinUrl || 'n/a',
          website: correctedData.website || 'n/a',
          profileImage: correctedData.profileImage || 'n/a',
          company: correctedData.company || company || 'n/a',
          phone: correctedData.phone || 'n/a',
          location: correctedData.location || 'n/a',
          suggestedMessage: correctedData.suggestedMessage || ''
        };
        
        console.log('Successfully recovered JSON after fixing:', validatedData);
        return NextResponse.json(validatedData);
      } catch (recoverError) {
        console.error('Failed to recover JSON after cleaning:', recoverError);
      }
      
      // Create a fallback object with the company name
      const fallbackData = {
        name: 'Error parsing response',
        title: 'n/a',
        email: 'n/a',
        linkedinUrl: 'n/a',
        website: 'n/a',
        profileImage: 'n/a',
        company: company || 'n/a',
        phone: 'n/a',
        location: 'n/a',
        suggestedMessage: '',
        _error: true
      };
      
      // Return both the fallback data and the raw text for debugging
      return NextResponse.json({
        ...fallbackData,
        rawText: rawText,
        error: 'Failed to parse Gemini response as valid JSON'
      });
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 