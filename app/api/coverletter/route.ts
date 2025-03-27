import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * POST handler for cover letter generation using Gemini API
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract data from the request
    const { 
      jobTitle, 
      companyName, 
      jobDescription, 
      resumeContent, 
      skills,
      location,
      apiKey 
    } = body;
    
    // Check if required data is provided
    if (!jobTitle || !companyName || !jobDescription) {
      return NextResponse.json(
        { error: 'Job title, company name, and job description are required' },
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
    
    console.log(`Generating cover letter for ${jobTitle} at ${companyName}`);
    
    // Prepare the prompt for Gemini
    const prompt = `Generate a professional cover letter for a job application with the following details:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Relevant Skills: ${skills}` : ''}
${location ? `Job Location: ${location}` : ''}
${resumeContent ? `
===== Resume Content =====
${resumeContent}
=======================
IMPORTANT: The above resume information MUST be specifically referenced and utilized in the cover letter.
Highlight 2-3 key experiences or skills from the resume that directly relate to this position.
` : ''}

Please follow these guidelines for an effective cover letter:
1. Be concise - around 300 words total with 2-3 short paragraphs.
2. Don't merely repeat resume content - provide new insights and context.
3. Make authentic connections between qualifications and the specific job.
4. If the resume shows employment gaps or career changes, address them positively.
5. Highlight any non-traditional but relevant experience.
6. Show genuine enthusiasm for the company and role.
7. Keep the tone professional but conversational.
8. Include a strong opening, targeted body content, and a compelling conclusion.
9. Address why the candidate is a good fit for this specific role.
${resumeContent ? '10. IMPORTANT: Explicitly reference specific experiences and skills from the provided resume.' : ''}

Format the cover letter as follows:
- Proper business letter format
- Date at the top
- Respectful greeting
- Professional closing

Return ONLY the full cover letter text with no additional comments or instructions.`;

    // Call the Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
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
          temperature: 0.3, // Balanced between creativity and coherence
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024 // Ensure enough tokens for a full cover letter
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
    
    // Extract the text from the Gemini response
    const coverLetterText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!coverLetterText) {
      return NextResponse.json(
        { error: 'Failed to generate cover letter text' },
        { status: 500 }
      );
    }
    
    // Format response
    const result = {
      coverLetterText,
      jobTitle,
      companyName
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 