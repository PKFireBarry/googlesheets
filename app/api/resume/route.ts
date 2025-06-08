import { NextRequest, NextResponse } from 'next/server';
import { ResumeData, ExperienceEntry } from '../../types/resume';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.0-flash';

// Gemini API Types
interface GeminiTextPart {
  text: string;
}

interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

interface GeminiRequestBody {
  contents: [{
    parts: GeminiPart[];
  }];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

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
 * Cleans placeholder locations from the resume data
 * @param data The resume data object
 * @returns Cleaned resume data with placeholder locations removed
 */
const cleanPlaceholderLocations = (data: any): any => {
  // Helper function to check if a location is a placeholder
  const isPlaceholderLocation = (loc: string): boolean => {
    const placeholderPatterns = [
      /city,?\s*state/i,
      /location/i,
      /\[.*\]/,
      /\(.*\)/,
      /your?\s+city/i,
      /address/i
    ];
    return placeholderPatterns.some(pattern => pattern.test(loc));
  };

  // Clean the main contact location
  if (data.contact?.location && isPlaceholderLocation(data.contact.location)) {
    data.contact.location = '';
  }

  // Clean experience locations
  if (Array.isArray(data.experience)) {
    data.experience = data.experience.map((exp: any) => ({
      ...exp,
      location: exp.location && isPlaceholderLocation(exp.location) ? '' : exp.location
    }));
  }

  // Clean education locations
  if (Array.isArray(data.education)) {
    data.education = data.education.map((edu: any) => ({
      ...edu,
      location: edu.location && isPlaceholderLocation(edu.location) ? '' : edu.location
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
    
    // Prepare the prompt for Gemini
    const instructionText = `I need you to create a tailored resume for a job application. I'll provide you with my resume ${resumePdfData ? 'as a PDF' : 'data'} and the job details. Please create a professional resume that highlights the most relevant skills, experiences, and qualifications that match the job requirements without adding any false information.

CRITICAL REQUIREMENT: You MUST include an education section in every tailored resume you create. This is non-negotiable. Even if the education seems less relevant to the job, it must be preserved and included.

STRATEGIC ANALYSIS PROCESS:
1. First, carefully analyze the job posting to identify the TOP 5 most critical requirements/skills
2. Then, review the candidate's experience to find specific examples that demonstrate those requirements
3. Craft bullet points that explicitly connect the candidate's experience to each critical job requirement
4. Use the exact terminology from the job posting when describing relevant experiences
5. Ensure each role's bullet points collectively tell a story of increasing responsibility and relevant expertise

Here are the job details:
${jobDetailsSection}

${personalInfoSection}

Tailoring Instructions:
1. Focus on the most relevant skills and experiences that directly relate to the job description.
2. Highlight keywords and terms from the job posting to improve ATS compatibility.
3. Include at least one bullet point that addresses each key responsibility in the job description this should try to find the commonalities between the job description and the resume.
4. Be concise and precise - every word should contribute to showcasing relevant qualifications.
5. Maintain a clean, professional format suitable for the job position.
6. The resume should not exceed 1 pages.
7. Don't invent or fabricate any experiences or skills not mentioned in the original resume.
8. IMPORTANT: Preserve the exact employment dates from the original resume - do not create gaps or change any start/end dates.
9. If there are employment gaps in the original resume that appear concerning, address them positively in the summary rather than modifying dates.
10. IMPORTANT: For job locations, DO NOT use placeholder text like "City, State". If a location is not known or is a placeholder, omit it entirely.
11. Please summarize the job description and how you tailored the resume to fit it in the tailoringNotes field.

CRITICAL BULLET POINT STRATEGY:
12. Each bullet point must demonstrate IMPACT and VALUE, not just list responsibilities.
13. Use the STAR method (Situation, Task, Action, Result) to create compelling bullet points that show measurable outcomes.
14. Connect each bullet point to specific job requirements by using similar language and addressing the same challenges.
15. Quantify achievements wherever possible (percentages, numbers, timeframes, scale).
16. Start each bullet point with strong action verbs that match the job posting's language.
17. Show progression and growth in responsibilities across different roles.
18. Demonstrate problem-solving abilities and business impact relevant to the target role.
19. Use industry-specific terminology and keywords from the job posting naturally within the bullet points.
20. Each bullet point should answer: "How does this experience make me the ideal candidate for THIS specific role?"

MANDATORY BASELINE REQUIREMENTS:
21. ALWAYS include the experience section in every tailored resume - this section is required.
22. ALWAYS include the skills section in every tailored resume - this section is required.
23. ALWAYS include the education section in every tailored resume - this section is required. Even if the original resume has minimal education information, you MUST include whatever education data is available. If the original resume contains any degree, certification, or educational background, it MUST be preserved in the tailored resume.
24. For each experience entry, provide AT LEAST 3 bullet points in the highlights array - never less than 3.
25. For projects, do NOT include a description field - only use the highlights array with AT LEAST 2 bullet points per project there should be at least 2 projects.
26. CRITICAL: If you find ANY educational background in the source resume (degrees, certifications, courses, training), you MUST include it in the education array. Do not omit education even if it seems less relevant to the job - education should always be preserved.

BULLET POINT QUALITY REQUIREMENTS:
27. Each bullet point must be 15-25 words and pack maximum impact into that space.
28. Every bullet point must include at least ONE quantifiable metric (numbers, percentages, timeframes, scale).
29. Use power words that directly mirror the job posting's language and requirements.
30. Each bullet point should demonstrate a specific skill or requirement mentioned in the job posting.
31. Avoid generic phrases like "responsible for" or "worked on" - use dynamic action verbs.
32. Show clear cause-and-effect relationships between actions and business outcomes.
33. Prioritize bullet points that address the most critical job requirements first.
34. Use parallel structure and consistent tense throughout all bullet points.
35. Order experiences and bullet points by relevance to the job - most relevant first.
36. Within each role, lead with the bullet point that most directly addresses the primary job requirement.


BULLET POINT EXAMPLES - Follow these patterns:

BAD EXAMPLES (avoid these):
❌ "Responsible for managing a team"
❌ "Worked on various projects"
❌ "Helped improve processes"
❌ "Assisted with customer service"

GOOD EXAMPLES (emulate these):
✅ "Led cross-functional team of 8 engineers, delivering 3 major features ahead of schedule, increasing user engagement by 35%"
✅ "Architected scalable microservices infrastructure supporting 50K+ concurrent users, reducing system downtime by 99.2%"
✅ "Implemented automated testing pipeline, cutting deployment time from 4 hours to 15 minutes while achieving 95% code coverage"
✅ "Optimized database queries and caching strategies, improving application response time by 60% for 100K+ daily active users"

EDUCATION PRESERVATION REMINDER: Before generating the JSON, carefully review the source resume for ANY educational background (degrees, diplomas, certificates, training programs, courses) and ensure ALL of it is included in the education section of your response.

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
  "summary": "Compelling 3-4 sentence summary that positions the candidate as the ideal fit for THIS specific role, highlighting the most relevant qualifications and using key terms from the job posting",
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
      "location": "City, State (optional)",
      "dates": "Year - Year (optional)",
      "details": ["Relevant coursework or achievements (optional)"]
    },
    ...
  ],
  "projects": [
    {
      "name": "Project Name",
      "technologies": ["Tech 1", "Tech 2", ...],
      "highlights": ["Highlight 1", "Highlight 2", "Highlight 3", ...]
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
  "tailoringNotes": "Detailed analysis of: (1) Top 5 job requirements identified, (2) How each requirement was addressed through specific experiences, (3) Key terminology/keywords incorporated, (4) Strategic positioning decisions made"
}

IMPORTANT: Return ONLY the JSON object with no markdown formatting, no code blocks, and no extra text before or after the JSON.`;

    console.log('Calling Gemini API for resume generation...');
    
    // Create the API URL with the API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
    // Prepare the request body
    const requestBody: GeminiRequestBody = {
      contents: [{
        parts: [
          { text: instructionText }
        ]
      }]
    };

    // If we have PDF data, add it as a separate part
    if (resumePdfData) {
      console.log('Using PDF resume data for Gemini API');
      console.log('PDF data format:', resumePdfData.substring(0, 50) + '...');
      
      // Extract base64 data from data URI if present
      let base64Data = resumePdfData;
      if (resumePdfData.startsWith('data:')) {
        const base64Index = resumePdfData.indexOf('base64,');
        if (base64Index !== -1) {
          base64Data = resumePdfData.substring(base64Index + 7);
          console.log('Extracted base64 data from data URI');
          console.log('Base64 data length:', base64Data.length);
        }
      } else {
        console.log('PDF data appears to be raw base64, length:', base64Data.length);
      }
      
      requestBody.contents[0].parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      });
    } else if (resumeData) {
      // Using JSON format (old way)
      console.log('Using JSON resume data for Gemini API');
      console.log('📚 Source resume education data:', resumeData.education ? resumeData.education.length : 0, 'entries');
      if (resumeData.education && resumeData.education.length > 0) {
        resumeData.education.forEach((edu: any, index: number) => {
          console.log(`  📖 Source Education ${index + 1}:`, edu.degree, 'from', edu.institution);
        });
      } else {
        console.log('⚠️  WARNING: No education data found in source resume!');
      }
      
      const textPart = requestBody.contents[0].parts[0] as GeminiTextPart;
      textPart.text += `\n\nHere is my master resume data:\n${JSON.stringify(resumeData)}`;
    }

    // Add generation config
    requestBody.generationConfig = {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 4096
    };
    
    // Log the complete request being sent to Gemini for debugging
    console.log('🚀 GEMINI REQUEST DEBUG:');
    console.log('  - API URL:', apiUrl.substring(0, 100) + '...');
    console.log('  - Request parts count:', requestBody.contents[0].parts.length);
    console.log('  - Has PDF data:', requestBody.contents[0].parts.some(part => 'inlineData' in part));
    console.log('  - Text instruction length:', (requestBody.contents[0].parts[0] as GeminiTextPart).text?.length || 0);
    
    if (resumePdfData) {
      console.log('  - PDF data starts with:', resumePdfData.substring(0, 30));
      console.log('  - PDF data total length:', resumePdfData.length);
    }

    // Call the Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: `Gemini API error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Extract the text from the Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error('❌ No response text received from Gemini API');
      return NextResponse.json(
        { error: 'No response text received from Gemini' },
        { status: 500 }
      );
    }
    
    console.log('📝 Raw Gemini Response (first 500 chars):', rawText.substring(0, 500) + '...');
    
    // Clean up the response text
    const cleanedText = extractJsonFromResponse(rawText);
    console.log('🧹 Cleaned JSON text (first 500 chars):', cleanedText.substring(0, 500) + '...');
    
    // Parse the text as JSON
    try {
      // Try to parse the response as JSON
      const parsedData = JSON.parse(cleanedText);
      
      // CHECK FOR PLACEHOLDER DATA - REJECT IF FOUND (only for PDF data)
      if ((parsedData.name === 'John Doe' || parsedData.contact?.email === 'john.doe@example.com') && resumePdfData && !resumeData) {
        console.error('🚨 CRITICAL ERROR: Gemini returned placeholder "John Doe" data instead of actual resume information from PDF!');
        console.error('This indicates that Gemini could not properly read the PDF.');
        console.error('PDF data length:', resumePdfData.length);
        console.error('PDF data format:', resumePdfData.substring(0, 50));
        
        return NextResponse.json({
          error: 'AI failed to extract real information from your PDF resume. Please try uploading your resume again or use a different format.',
          details: 'The AI returned placeholder data instead of your actual resume information from the PDF.'
        }, { status: 500 });
      }
      
      console.log('✅ Successfully parsed Gemini response as JSON structure');
      console.log('📊 Parsed Resume Data Structure:');
      console.log('  - Name:', parsedData.name);
      console.log('  - Contact:', parsedData.contact ? 'Present' : 'Missing');
      console.log('  - Summary length:', parsedData.summary ? parsedData.summary.length : 0, 'characters');
      console.log('  - Skills count:', Array.isArray(parsedData.skills) ? parsedData.skills.length : 0);
      console.log('  - Experience entries:', Array.isArray(parsedData.experience) ? parsedData.experience.length : 0);
      console.log('  - Education entries:', Array.isArray(parsedData.education) ? parsedData.education.length : 0);
      console.log('  - Project entries:', Array.isArray(parsedData.projects) ? parsedData.projects.length : 0);
      console.log('  - Certification entries:', Array.isArray(parsedData.certifications) ? parsedData.certifications.length : 0);
      
      // Log experience details
      if (Array.isArray(parsedData.experience)) {
        parsedData.experience.forEach((exp: any, index: number) => {
          console.log(`  📋 Experience ${index + 1}:`, exp.title, 'at', exp.company);
          console.log(`    - Highlights count:`, Array.isArray(exp.highlights) ? exp.highlights.length : 0);
          
          // Quality check for bullet points
          if (Array.isArray(exp.highlights)) {
            exp.highlights.forEach((highlight: string, i: number) => {
              const wordCount = highlight.split(' ').length;
              const hasNumbers = /\d/.test(highlight);
              const hasWeakWords = /responsible for|worked on|helped|assisted/i.test(highlight);
              
              console.log(`    📝 Bullet ${i + 1} (${wordCount} words, numbers: ${hasNumbers}, weak words: ${hasWeakWords}):`, highlight.substring(0, 80) + '...');
            });
          }
        });
      }
      
      // Log education details
      if (Array.isArray(parsedData.education)) {
        parsedData.education.forEach((edu: any, index: number) => {
          console.log(`  🎓 Education ${index + 1}:`, edu.degree, 'from', edu.institution);
        });
      } else {
        console.log('🚨 CRITICAL WARNING: AI response is missing education section! This violates the mandatory requirements.');
      }
      
      // Log project details
      if (Array.isArray(parsedData.projects)) {
        parsedData.projects.forEach((project: any, index: number) => {
          console.log(`  🚀 Project ${index + 1}:`, project.name);
          console.log(`    - Technologies:`, Array.isArray(project.technologies) ? project.technologies.length : 0);
          console.log(`    - Highlights count:`, Array.isArray(project.highlights) ? project.highlights.length : 0);
          
          // Quality check for project bullet points
          if (Array.isArray(project.highlights)) {
            project.highlights.forEach((highlight: string, i: number) => {
              const wordCount = highlight.split(' ').length;
              const hasNumbers = /\d/.test(highlight);
              const hasWeakWords = /responsible for|worked on|helped|assisted/i.test(highlight);
              
              console.log(`    📝 Project Bullet ${i + 1} (${wordCount} words, numbers: ${hasNumbers}, weak words: ${hasWeakWords}):`, highlight.substring(0, 80) + '...');
            });
          }
        });
      }
      
      // Clean any remaining placeholder locations
      const cleanedData = cleanPlaceholderLocations(parsedData);
      console.log('🧽 Applied placeholder location cleaning');
      
      // EDUCATION FALLBACK: If AI didn't include education but source resume had it, preserve it
      if ((!cleanedData.education || cleanedData.education.length === 0)) {
        if (resumeData?.education && resumeData.education.length > 0) {
          console.log('🔧 EDUCATION FALLBACK: AI omitted education, restoring from source resume');
          cleanedData.education = resumeData.education;
          console.log('✅ Restored', resumeData.education.length, 'education entries from source resume');
        } else if (resumePdfData) {
          console.log('⚠️  EDUCATION MISSING: AI omitted education from PDF resume. Cannot restore automatically.');
          console.log('💡 SUGGESTION: The AI should have extracted education from the PDF. This may indicate an issue with the AI prompt or the PDF content.');
        }
      }
      
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