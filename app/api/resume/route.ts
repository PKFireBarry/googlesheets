import { NextRequest, NextResponse } from 'next/server';
import { ResumeData, ExperienceEntry } from '../../types/resume';

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
 * Clean placeholder locations from resume data
 */
const cleanPlaceholderLocations = (data: ResumeData): ResumeData => {
  if (!data) return data;

  // Clean experience locations
  if (data.experience) {
    data.experience = data.experience.map((exp: ExperienceEntry) => ({
      ...exp,
      location: exp.location && (
        exp.location.includes('City') ||
        exp.location.includes('State') ||
        exp.location === 'Remote' ||
        exp.location.trim() === ''
      ) ? '' : exp.location
    }));
  }

  return data;
};

/**
 * POST handler for Resume Generation using Gemini API
 * This processes the user's master resume and job details to create a tailored resume
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract data from the request
    const { resumeData, resumePdfData, jobData, apiKey, personalInfo } = body;
    
    // Check if required data is provided
    if ((!resumeData && !resumePdfData) || !jobData) {
      return NextResponse.json(
        { error: 'Resume data (either as JSON or PDF) and job data are required' },
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
    
    // Log API key usage (securely)
    console.log(`Using API key for Gemini: ${geminiApiKey.substring(0, 5)}... (${apiKey ? 'user provided' : 'from environment'})`);
    
    // Extract key job details
    const jobTitle = jobData.title || jobData.job_title || 'Unknown Position';
    const jobDescription = jobData.description || jobData.job_description || '';
    const jobRequirements = jobData.requirements || '';
    const jobSkills = jobData.skills || '';
    const company = jobData.company_name || jobData.company || '';
    
    // Format job details for the prompt
    const jobDetailsSection = `
Job Title: ${jobTitle}
Company: ${company}
${jobDescription ? `Description: ${jobDescription}` : ''}
${jobRequirements ? `Requirements: ${jobRequirements}` : ''}
${jobSkills ? `Skills: ${jobSkills}` : ''}`;

    // Add user's personal info if provided
    let personalInfoSection = '';
    if (personalInfo) {
      personalInfoSection = `
Please use the following personal information in the resume:
Name: ${personalInfo.name || 'Extract from resume'}
Email: ${personalInfo.email || 'Extract from resume'}
Phone: ${personalInfo.phone || 'Extract from resume'}
Location: ${personalInfo.location || 'Extract from resume'}
LinkedIn: ${personalInfo.linkedin || 'Extract from resume or omit'}
Website: ${personalInfo.website || 'Extract from resume or omit'}
`;
    }
    
    // Prepare the prompt for Gemini with parts array
    const instructionText = `I need you to create a tailored resume for a job application. I'll provide you with my resume ${resumePdfData ? 'as a PDF' : 'data'} and the job details. Please create a professional resume that highlights the most relevant skills, experiences, and qualifications that match the job requirements without adding any false information.

Here are the job details:
${jobDetailsSection}

${personalInfoSection}

Tailoring Instructions:
1. Focus on the most relevant skills and experiences that directly relate to the job description.
2. Highlight keywords and terms from the job posting to improve ATS compatibility.
3. Include at least one bullet point that addresses each key responsibility in the job description.
4. Be concise and precise - every word should contribute to showcasing relevant qualifications.
5. Maintain a clean, professional format suitable for the job position.
6. The resume should not exceed 1-2 pages.
7. Don't invent or fabricate any experiences or skills not mentioned in the original resume.
8. IMPORTANT: Preserve the exact employment dates from the original resume - do not create gaps or change any start/end dates.
9. If there are employment gaps in the original resume that appear concerning, address them positively in the summary rather than modifying dates.
10. IMPORTANT: For job locations, DO NOT use placeholder text like "City, State". If a location is not known or is a placeholder, omit it entirely.
11. Please summarize the job description and how you tailored the resume to fit it in the tailoringNotes field.

Return the complete resume content in a structured JSON format:

{
  "name": "Full Name",
  "contact": {
    "email": "email@example.com",
    "phone": "555-555-5555",
    "location": "City, State",
    "linkedin": "linkedin.com/in/username",
    "website": "personalwebsite.com"
  },
  "summary": "Professional summary paragraph",
  "skills": ["Skill 1", "Skill 2", "Skill 3", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "", // Leave empty if location is not known or is a placeholder
      "dates": "Month Year - Month Year",
      "highlights": ["Achievement 1", "Achievement 2", ...]
    },
    ...
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "Institution Name",
      "location": "City, State",
      "dates": "Month Year - Month Year",
      "details": ["Detail 1", "Detail 2", ...]
    },
    ...
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2", ...],
      "highlights": ["Highlight 1", "Highlight 2", ...]
    },
    ...
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Month Year"
    },
    ...
  ],
  "tailoringNotes": "Description of how this resume was tailored for this specific job"
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, and no extra text before or after the JSON.`;

    console.log('Calling Gemini API for resume generation...');
    
    // Create the API URL with the API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
    // Prepare the request body based on whether we have PDF data or JSON data
    let requestContents;
    
    if (resumePdfData) {
      // Using PDF format
      requestContents = {
        parts: [
          { text: instructionText },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: resumePdfData
            }
          }
        ]
      };
      console.log('Using PDF resume data for Gemini API');
    } else {
      // Using JSON format (old way)
      requestContents = {
        parts: [
          { 
            text: `${instructionText}\n\nHere is my master resume data:\n${JSON.stringify(resumeData)}`
          }
        ]
      };
      console.log('Using JSON resume data for Gemini API');
    }
    
    // Call the Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [requestContents],
        generationConfig: {
          temperature: 0.2, // Slightly higher temperature for creativity but still mostly deterministic
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 4096 // Ensure we have enough tokens for a complete resume
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
    console.log('Raw text from Gemini (start):', rawText.substring(0, 100) + '...');
    
    // Clean up the text to extract JSON
    const cleanedText = extractJsonFromResponse(rawText);
    console.log('Cleaned text for parsing (start):', cleanedText.substring(0, 100) + '...');
    
    // Parse the text as JSON
    try {
      // Try to parse the response as JSON
      const parsedData = JSON.parse(cleanedText);
      console.log('Successfully parsed Gemini response as JSON structure');
      
      // Clean any remaining placeholder locations
      const cleanedData = cleanPlaceholderLocations(parsedData);
      
      // Return the resume data
      return NextResponse.json(cleanedData);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e);
      
      // Try to make the text valid JSON by doing some additional cleaning
      try {
        // Replace single quotes with double quotes
        const fixedJson = cleanedText.replace(/'/g, '"')
          // Fix common issues like trailing commas
          .replace(/,\s*}/g, '}')
          // Add quotes around unquoted keys
          .replace(/(\w+):/g, '"$1":');
          
        console.log('Attempting to parse cleaned JSON...');
        const correctedData = JSON.parse(fixedJson);
        
        console.log('Successfully recovered JSON after fixing');
        return NextResponse.json(correctedData);
      } catch (recoverError) {
        console.error('Failed to recover JSON after cleaning:', recoverError);
      }
      
      // Create a fallback response
      return NextResponse.json({
        error: 'Failed to parse Gemini response as valid JSON',
        rawText: rawText
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 