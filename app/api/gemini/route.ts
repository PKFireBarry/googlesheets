import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Extracts JSON from a possibly markdown-formatted response
 * @param text The raw text from Gemini, possibly containing markdown
 * @returns The cleaned JSON string
 */
const extractJsonFromResponse = (text: string): string => {
  // Try to extract JSON from markdown code blocks (```json...```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to extract anything that looks like JSON (starts with { and ends with })
  const jsonObjectMatch = text.match(/({[\s\S]*})/);
  if (jsonObjectMatch && jsonObjectMatch[1]) {
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
    const geminiApiKey = apiKey || 
                        process.env.GEMINI_API_KEY || 
                        process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required. Please provide it in your request or set it in your environment variables.' },
        { status: 400 }
      );
    }
    
    // Validate API key format - should be a reasonably long string
    if (geminiApiKey.length < 20) {
      return NextResponse.json(
        { error: 'The provided Gemini API key appears to be invalid. Please check your API key and try again.' },
        { status: 400 }
      );
    }
    
    // Process job data if provided
    let jobDetailsSection = '';
    if (jobData) {
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
  "suggestedMessage": ""
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, and no extra text before or after the JSON.`;

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
      return NextResponse.json(
        { error: `Gemini API error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Extract the text from the Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Clean up the text to extract JSON
    const cleanedText = extractJsonFromResponse(rawText);
    
    // Parse the text as JSON
    try {
      // Try to parse the response as JSON
      const parsedData = JSON.parse(cleanedText);
      
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
      // Try to make the text valid JSON by doing some additional cleaning
      try {
        // Replace single quotes with double quotes
        const fixedJson = cleanedText.replace(/'/g, '"')
          // Fix common issues like trailing commas
          .replace(/,\s*}/g, '}')
          // Add quotes around unquoted keys
          .replace(/(\w+):/g, '"$1":');
          
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
        
        return NextResponse.json(validatedData);
      } catch (recoverError) {
        return NextResponse.json(
          { error: 'Failed to parse Gemini response as valid JSON' },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Error in Gemini API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error processing LinkedIn data' },
      { status: 500 }
    );
  }
} 