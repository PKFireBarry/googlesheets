import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Helper function to check if resume phrases are present in the cover letter
 */
function analyzeResumeUsage(resumeContent: string, coverLetterText: string) {
  if (!resumeContent || !coverLetterText) return { used: false, matches: [], matchCount: 0 };
  
  // Extract potential key phrases from resume (3+ word phrases)
  const resumeText = resumeContent.toLowerCase();
  const coverLetterLower = coverLetterText.toLowerCase();
  
  // Split resume into sentences and phrases
  const resumeSentences = resumeText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const keyPhrases: string[] = [];
  
  // Extract key phrases that might represent skills, job titles, or accomplishments
  const potentialSigWords = ['managed', 'developed', 'created', 'built', 'designed', 
                            'implemented', 'led', 'coordinated', 'analyzed', 'reduced',
                            'increased', 'improved', 'trained', 'supervised', 'experience',
                            'years', 'expert', 'proficient', 'certified', 'degree'];
  
  // Extract 3-5 word phrases that might be significant
  const words = resumeText.split(/\s+/);
  for (let i = 0; i < words.length - 2; i++) {
    // Look for phrases that might contain significant terms
    const isSignificant = potentialSigWords.some(sigWord => 
      words[i].includes(sigWord) || words[i+1].includes(sigWord) || words[i+2].includes(sigWord)
    );
    
    if (words[i].length > 3 && words[i+1].length > 3 && (isSignificant || words[i].length > 5)) {
      const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`.trim();
      if (phrase.length > 10) {
        keyPhrases.push(phrase);
      }
    }
  }
  
  // Check for longer skill-based phrases (4-5 words)
  for (let i = 0; i < words.length - 3; i++) {
    const phrase = `${words[i]} ${words[i+1]} ${words[i+2]} ${words[i+3]}`.trim();
    if (phrase.length > 15) {
      keyPhrases.push(phrase);
    }
  }
  
  // Add single technical terms and skills that might be important
  const skillsSection = resumeText.includes('skills') 
    ? resumeText.substring(resumeText.indexOf('skills'))
    : '';
  
  if (skillsSection) {
    // Look for single words in the skills section that might be technical terms
    const skillWords = skillsSection.split(/\s+/).filter(word => 
      word.length > 5 && !['skills', 'include', 'including', 'proficient'].includes(word.toLowerCase())
    );
    
    skillWords.forEach(skill => {
      if (coverLetterLower.includes(skill.toLowerCase())) {
        keyPhrases.push(skill);
      }
    });
  }
  
  // Look for matches
  const matches: string[] = [];
  
  // Check sentences
  resumeSentences.forEach(sentence => {
    if (sentence.length > 20 && coverLetterLower.includes(sentence)) {
      matches.push(sentence);
    }
  });
  
  // Check phrases
  keyPhrases.forEach(phrase => {
    if (coverLetterLower.includes(phrase.toLowerCase())) {
      // Don't add duplicates or substrings of already added matches
      if (!matches.some(m => m.includes(phrase) || phrase.includes(m))) {
        matches.push(phrase);
      }
    }
  });
  
  // Deduplicate matches
  const uniqueMatches = [...new Set(matches)];
  
  return {
    used: uniqueMatches.length > 0,
    matchCount: uniqueMatches.length,
    matches: uniqueMatches.slice(0, 5) // Return top 5 matches
  };
}

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
      resumePdfData, // New field for PDF data in base64 format
      skills,
      location,
      apiKey 
    } = body;
    
    // Debug the incoming request data
    console.log('API Request received for:', {
      jobTitle,
      companyName,
      jobDescriptionLength: jobDescription?.length || 0,
      hasResumeContent: !!resumeContent,
      resumeContentLength: resumeContent?.length || 0,
      hasPdfData: !!resumePdfData,
      hasSkills: !!skills,
      hasLocation: !!location,
      hasApiKey: !!apiKey
    });
    
    if (resumeContent) {
      console.log('Resume content preview:', resumeContent.substring(0, 200) + '...');
    }
    
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
    interface GeminiPart {
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }

    const geminiContent = {
      parts: [] as GeminiPart[]
    };

    // First add the text instruction for PDF data
    geminiContent.parts.push({
      text: `You are a professional cover letter writer. I need you to create a modern, concise, and impactful cover letter for a ${jobTitle} position at ${companyName}.
      
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${location ? `Location: ${location}` : ''}

Please analyze my resume (provided as a PDF) and create a personalized cover letter following these modern cover letter best practices:

1. CONCISENESS: Keep it brief (around 300 words) with 2-3 short paragraphs. Recruiters appreciate brevity.

2. NEW INFORMATION ONLY: Don't just repeat what's in the resume. Add context, personal connection to the role/company, or elaborate on specific experiences that are particularly relevant.

3. AUTHENTIC CONNECTION: Draw genuine connections between my qualifications and this specific job/company.

4. ADDRESS ANY "RED FLAGS": If you notice employment gaps, career changes, or non-traditional experience in my resume, address them positively and proactively.

5. STAND OUT: Make the letter memorable but professional. Avoid generic language and templates.

The cover letter should sound natural, convincing, and tailored specifically to this role. Use a confident but not arrogant tone.

Please format it professionally with today's date, appropriate salutation, and a professional closing.`
    });
    
    // If PDF data is provided, add it to the contents
    if (resumePdfData) {
      // First add the text instruction
      geminiContent.parts.push({
        text: `You are a professional cover letter writer. I need you to create a modern, concise, and impactful cover letter for a ${jobTitle} position at ${companyName}.
        
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${location ? `Location: ${location}` : ''}

Please analyze my resume (provided as a PDF) and create a personalized cover letter following these modern cover letter best practices:

1. CONCISENESS: Keep it brief (around 300 words) with 2-3 short paragraphs. Recruiters appreciate brevity.

2. NEW INFORMATION ONLY: Don't just repeat what's in the resume. Add context, personal connection to the role/company, or elaborate on specific experiences that are particularly relevant.

3. AUTHENTIC CONNECTION: Draw genuine connections between my qualifications and this specific job/company.

4. ADDRESS ANY "RED FLAGS": If you notice employment gaps, career changes, or non-traditional experience in my resume, address them positively and proactively.

5. STAND OUT: Make the letter memorable but professional. Avoid generic language and templates.

The cover letter should sound natural, convincing, and tailored specifically to this role. Use a confident but not arrogant tone.

FORMAT GUIDELINES:
- Include only the company name and city/state for the address (e.g., "${companyName}, ${location || 'Company Location'}")
- Use "Dear Hiring Manager," as the salutation (not placeholders in brackets)
- Include 2-3 concise paragraphs for the body
- ALWAYS END with a closing like "Sincerely," followed by the candidate's full name - this is REQUIRED

EXTREMELY IMPORTANT: 
- DO NOT use placeholder text in brackets like [Today's Date] or [Hiring Manager Name]
- DO NOT include any explanatory text, justifications, or notes
- If you extract the name from the resume, use it in the signature - otherwise use "Candidate Name"
- Your response must ONLY include the final, polished cover letter with all placeholders replaced
- ALWAYS INCLUDE a proper closing signature at the end (e.g., "Sincerely,\nJohn Smith")`
      });
      
      // Then add the PDF data
      geminiContent.parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: resumePdfData
        }
      });
      
      console.log('Using PDF resume data for Gemini API');
    } else {
      // Use regular text-based prompt if no PDF data
      const textPrompt = `Generate a modern, concise, and impactful cover letter for the following job application:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Relevant Skills: ${skills}` : ''}
${location ? `Job Location: ${location}` : ''}
${resumeContent ? `
===== Resume Content =====
${resumeContent}
=======================
` : ''}

Follow these MODERN COVER LETTER GUIDELINES:

1. CONCISENESS: Keep it brief (around 300 words) with 2-3 short paragraphs. Recruiters are busy and appreciate brevity.

2. NEW INFORMATION ONLY: Don't just repeat what's in the resume. Add context, personal connection to the role/company, or elaborate on specific points that make the candidate ideal for THIS SPECIFIC position.

3. AUTHENTIC CONNECTION: Draw genuine connections between the candidate's qualifications and this specific job/company. Avoid generic language.

4. ADDRESS ANY "RED FLAGS": If you notice employment gaps, career changes, or non-traditional experience in the resume, address them positively and proactively.

5. STAND OUT: Make the letter memorable but professional. Focus on what makes this candidate uniquely valuable.

${resumeContent ? `WHEN USING THE RESUME:
- Extract key skills and experiences that match the job requirements, but don't just list them
- Maintain the candidate's voice and tone as reflected in their resume
- Use specific achievements or projects from the resume as examples, but add context about how they relate to this role
- If the candidate has unique or non-traditional experience, explain how it provides value to this specific role
- Use terminology and technical terms from both the resume and job description to show relevance
- Extract the full name from the resume and use it in the signature line` : ''}

FORMAT GUIDELINES:
- Include only the company name and city/state for the address (e.g., "${companyName}, ${location || 'Company Location'}")
- Use "Dear Hiring Manager," as the salutation (not placeholders in brackets)
- Include 2-3 concise paragraphs for the body
- ALWAYS END with a closing like "Sincerely," followed by the candidate's full name - this is REQUIRED
${resumeContent ? ` - Extract the candidate's full name from the first line of the resume: "${resumeContent.split('\n')[0]}"` : ' - Use "Candidate Name" if no name can be determined'}

EXTREMELY IMPORTANT: 
- DO NOT use placeholder text in brackets like [Today's Date] or [Hiring Manager Name]
- DO NOT include any explanatory text, justifications, or notes
- Do not include any text in brackets [like this] in the final cover letter
- Your response must ONLY include the final, polished cover letter with all placeholders replaced
- ALWAYS INCLUDE a proper closing signature at the end (e.g., "Sincerely,\nJohn Smith")

Return ONLY the finished cover letter with no additional comments, notes, or explanations.`;

      geminiContent.parts.push({ text: textPrompt });
      console.log('Using text-based prompt for Gemini API');
    }
    
    console.log('Prompt prepared, making API call to Gemini');

    // Call the Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
    console.log('Calling Gemini API...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [geminiContent],
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
    console.log('Gemini API response received');
    
    // Extract the text from the Gemini response
    let coverLetterText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('RAW RESPONSE FROM GEMINI:');
    console.log('----------------------------------------');
    console.log(coverLetterText);
    console.log('----------------------------------------');
    
    // Simpler function that just fixes the date and preserves everything else
    function minimalCleanResponse(text: string): string {
      console.log('Using minimal cleaning - just fixing date placeholder');
      
      // Replace date placeholder with actual date
      const today = new Date();
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      const formattedDate = today.toLocaleDateString('en-US', options);
      
      // Only replace the date placeholder but keep everything else as is
      return text.replace(/\[Today's Date\]/g, formattedDate)
                .replace(/\[Date\]/g, formattedDate)
                .replace(/\[Current Date\]/g, formattedDate);
    }

    // Clean up the response to remove explanatory content
    function cleanCoverLetterResponse(text: string, resumeContent?: string): string {
      // Check and remove common prefixes/introductions
      const commonPrefixes = [
        "Okay, here's a",
        "Here's a",
        "Based on",
        "I've crafted",
        "Below is a",
        "Here is a",
        "Following your guidelines",
        "Cover Letter:",
        "Cover Letter"
      ];
      
      for (const prefix of commonPrefixes) {
        if (text.startsWith(prefix)) {
          // Find the first paragraph break and remove the prefix
          const firstBreak = text.indexOf("\n\n");
          if (firstBreak > 0) {
            text = text.substring(firstBreak + 2);
            break;
          }
        }
      }

      // Common endings/markers to look for that indicate explanatory content
      const endMarkers = [
        "**Explanation of Choices",
        "**Important Considerations",
        "Explanation of Choices",
        "Important Considerations",
        "Good luck with your application",
        "I hope this helps",
        "Note:",
        "---",
        "Hope this helps",
        "Best of luck",
        "This letter is designed to",
        "This cover letter",
        "*Explanation:",
        "*Note:"
      ];

      // Find the earliest end marker
      let endIndex = text.length;
      for (const marker of endMarkers) {
        const index = text.indexOf(marker);
        if (index !== -1 && index < endIndex) {
          endIndex = index;
        }
      }

      // Check for common signature patterns
      const signaturePatterns = [
        "Sincerely,", 
        "Best regards,", 
        "Yours sincerely,",
        "Respectfully,",
        "Kind regards,",
        "Regards,"
      ];
      
      let signatureIndex = -1;
      let signaturePattern = "";
      
      for (const pattern of signaturePatterns) {
        const index = text.indexOf(pattern);
        if (index !== -1 && (signatureIndex === -1 || index < signatureIndex)) {
          signatureIndex = index;
          signaturePattern = pattern;
        }
      }
      
      if (signatureIndex !== -1) {
        // Find the signature block end (name + a few lines)
        let signatureBlockEnd = signatureIndex;
        let newlinesFound = 0;
        let nameFound = false;
        
        // Skip the signature line itself
        let i = signatureIndex + signaturePattern.length;
        while (i < text.length && text[i] !== '\n') i++;
        
        // Now look for the name and subsequent newlines
        for (; i < text.length; i++) {
          // If we find text after the signature line, that's likely the name
          if (!nameFound && text[i].trim() !== '') {
            nameFound = true;
          }
          
          if (text[i] === '\n') {
            // Only count newlines after we've found the name
            if (nameFound) newlinesFound++;
            
            // After finding the name and 2 newlines, we're likely at the end of the signature block
            if (nameFound && newlinesFound >= 2) {
              signatureBlockEnd = i;
              break;
            }
          }
        }
        
        // If signature block ends before any explanation markers, use it as the end point
        if (signatureBlockEnd + 1 < endIndex) {
          endIndex = signatureBlockEnd + 1;
        }
      }
      
      // Also check for specific end patterns like asterisks or multiple dashes that might indicate explanations
      const extraEndMarkers = ["***", "---", "___", "###"];
      for (const marker of extraEndMarkers) {
        const index = text.indexOf(marker);
        if (index !== -1 && index > 0 && index < endIndex) {
          endIndex = index;
        }
      }

      // Trim the text to end at the determined end point
      let cleanedText = text.substring(0, endIndex).trim();
      
      // Remove any trailing asterisks, dashes, etc.
      cleanedText = cleanedText.replace(/[\*\-_#]+\s*$/, "").trim();
      
      // Remove placeholder text in brackets like [Today's Date], [Hiring Manager Name], etc.
      cleanedText = cleanedText.replace(/\[Today's Date\]/gi, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
      cleanedText = cleanedText.replace(/\[Date\]/gi, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
      cleanedText = cleanedText.replace(/\[Current Date\]/gi, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
      
      // Replace other common placeholders
      cleanedText = cleanedText.replace(/\[Hiring Manager( Name)?\]/gi, "Hiring Manager");
      cleanedText = cleanedText.replace(/\[Hiring Manager Title\]/gi, "");
      cleanedText = cleanedText.replace(/\[[^\]]*Manager[^\]]*\]/gi, "Hiring Manager");
      cleanedText = cleanedText.replace(/\[Company Address[^\]]*\]/gi, "");
      cleanedText = cleanedText.replace(/\[Hospital Address[^\]]*\]/gi, "");
      cleanedText = cleanedText.replace(/\[Mr\.\/Ms\.\/Mx\. Last Name or Hiring Manager Title\]/gi, "Hiring Manager");
      cleanedText = cleanedText.replace(/Dear \[Mr\.\/Ms\.\/Mx\.[^\]]*\]/gi, "Dear Hiring Manager");
      
      // Remove any lines that contain only placeholder text
      cleanedText = cleanedText.split('\n')
        .filter(line => !line.trim().match(/^\[.*\]$/))
        .join('\n');
      
      // Clean up any empty lines created by removing placeholder lines
      cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
      
      // Try to extract a real name from the resume content for the signature
      let candidateName = "Candidate Name";
      if (resumeContent) {
        console.log('Attempting to extract name from resume');
        const lines = resumeContent.trim().split('\n');
        
        // Try multiple approaches to find a name
        
        // Approach 1: First line is often the name
        if (lines.length > 0) {
          const possibleName = lines[0].trim();
          // If it looks like a name (not too long, not too short)
          if (possibleName.length > 3 && possibleName.length < 60 && 
              !/^\d/.test(possibleName) && 
              !possibleName.toLowerCase().includes('resume')) {
            candidateName = possibleName;
            console.log('Extracted name from first line:', candidateName);
          }
        }
        
        // Approach 2: Look for lines that might contain only a name
        if (candidateName === "Candidate Name") {
          for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i].trim();
            // Check if this looks like just a name (1-4 words, no special chars, not too long)
            if (line.length > 3 && line.length < 40 && 
                line.split(/\s+/).length <= 4 && 
                /^[A-Za-z\s\-\.]+$/.test(line)) {
              candidateName = line;
              console.log('Extracted name from line', i, ':', candidateName);
              break;
            }
          }
        }
        
        console.log('Using name for signature:', candidateName);
      }
      
      // Replace [Candidate Name] with actual name or "Candidate Name" if no name found
      cleanedText = cleanedText.replace(/\[Candidate Name\]/gi, candidateName);
      
      // Finally, replace any remaining brackets with placeholders inside
      cleanedText = cleanedText.replace(/\[([^\]]+)\]/g, "$1");
      
      // Clean up any single letters or other characters that might appear before signature
      if (signatureIndex > 0) {
        console.log('Found signature at index:', signatureIndex);
        
        // Check last 10 characters before signature for unwanted characters
        const lastCharsBeforeSignature = cleanedText.substring(Math.max(0, signatureIndex - 10), signatureIndex);
        console.log('Last chars before signature:', JSON.stringify(lastCharsBeforeSignature));

        // Match and remove any of these patterns:
        // 1. Single letter surrounded by newlines
        // 2. Single non-letter character surrounded by whitespace
        // 3. "Best," on a separate line (we want to keep just "Sincerely,")
        const cleanPattern = /(\n+[A-Za-z][\s\n]+|\n+[^A-Za-z0-9\s][\s\n]+|\n+Best,[\s\n]+)$/;
        const beforeSignature = cleanedText.substring(0, signatureIndex).trim();
        const fixedBeforeSignature = beforeSignature.replace(cleanPattern, '\n');
        
        if (beforeSignature !== fixedBeforeSignature) {
          console.log('Cleaned up characters before signature');
          cleanedText = fixedBeforeSignature + '\n' + cleanedText.substring(signatureIndex);
        }
      }
      
      // Check if the cover letter is missing a proper signature and add one if needed
      if (!signaturePatterns.some(pattern => cleanedText.includes(pattern))) {
        // If no signature found, add one
        cleanedText += "\n\nSincerely,\n\n" + candidateName;
      } else if (signatureIndex !== -1) {
        // If signature exists but name is missing or is "Candidate Name", replace with real name
        const afterSignatureText = cleanedText.substring(signatureIndex + signaturePattern.length);
        const afterSignatureLines = afterSignatureText.split('\n').filter(line => line.trim());
        
        // If there's no text after signature or it contains only "Candidate Name"
        if (afterSignatureLines.length === 0 || 
            (afterSignatureLines.length === 1 && afterSignatureLines[0].trim() === "Candidate Name")) {
          // Replace with better signature + name
          cleanedText = cleanedText.substring(0, signatureIndex + signaturePattern.length) + 
                       "\n\n" + candidateName;
        }
      }
      
      return cleanedText;
    }

    // By default, use minimal cleaning unless we detect major issues that require full cleaning
    let needsFullCleaning = false;

    // Check for issues that would require full cleaning
    if (!coverLetterText.includes("Sincerely,") || 
        coverLetterText.includes("[Candidate Name]") ||
        coverLetterText.includes("Explanation:") ||
        coverLetterText.includes("Note:") ||
        coverLetterText.match(/\n[A-Za-z][\s\n]+Sincerely,/)) {
      needsFullCleaning = true;
      console.log("Detected issues requiring full cleaning");
    }

    // Now apply the appropriate cleaning method
    if (needsFullCleaning) {
      console.log("Applying comprehensive cleaning");
      coverLetterText = cleanCoverLetterResponse(coverLetterText, resumeContent);
    } else {
      console.log("Using minimal cleaning - just fixing date placeholder");
      coverLetterText = minimalCleanResponse(coverLetterText);
    }

    console.log('Cover letter after cleaning, length:', coverLetterText.length);
    console.log('Cover letter preview after cleaning:', coverLetterText.substring(0, 200) + '...');
    
    if (!coverLetterText) {
      return NextResponse.json(
        { error: 'Failed to generate cover letter text' },
        { status: 500 }
      );
    }
    
    // Analyze if resume content is used in the cover letter
    let resumeAnalysis = null;
    if (resumeContent) {
      resumeAnalysis = analyzeResumeUsage(resumeContent, coverLetterText);
      console.log('Resume content usage analysis:', resumeAnalysis);
      if (!resumeAnalysis.used) {
        console.warn('WARNING: Resume content does not appear to be used in the cover letter!');
      } else {
        console.log(`Found ${resumeAnalysis.matchCount} phrases from resume in the cover letter`);
      }
    }
    
    // Return analysis with the response
    return NextResponse.json({
      coverLetterText,
      rawResponse: data?.candidates?.[0]?.content?.parts?.[0]?.text || '',
      jobTitle,
      companyName,
      debug: {
        resumeContentLength: resumeContent?.length || 0,
        coverLetterLength: coverLetterText.length,
        resumeAnalysis: resumeAnalysis || { used: false, matchCount: 0, matches: [] },
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });
  } catch (error) {
    console.error('Error generating cover letter:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 