import { NextRequest, NextResponse } from 'next/server';

// External API endpoints
const UPLOAD_ENDPOINT = 'http://bore.pub:7777/auto-apply';
const STATUS_ENDPOINT = 'http://bore.pub:7777/auto-apply-status';

/**
 * Normalize URL to ensure it has a proper protocol prefix
 * @param url The URL to normalize
 * @returns Normalized URL with proper protocol
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  // Trim whitespace
  url = url.trim();
  
  // Return empty string if URL is empty after trimming
  if (!url) return '';
  
  // Add https:// if no protocol is specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * GET handler for checking auto-apply status
 * Proxies requests to the external API status endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Get task ID from query parameters
    const taskId = request.nextUrl.searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }
    
    // Call the external API to check status
    const response = await fetch(`${STATUS_ENDPOINT}/${taskId}`, {
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from external API:', errorText);
      
      return NextResponse.json(
        { error: 'Failed to check upload status', details: errorText },
        { status: response.status }
      );
    }
    
    const statusData = await response.json();
    return NextResponse.json(statusData);
  } catch (error: any) {
    console.error('Error checking auto-apply status:', error);
    
    // Specific error for connection issues
    if (error.name === 'AbortError' || error.code?.startsWith('UND_ERR_')) {
      return NextResponse.json(
        { error: 'Connection to auto-apply service failed. Please try again later.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to check auto-apply status' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for auto-applying to jobs
 * Handles the upload process to the external API
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract data from the request
    const { pdfUrl, prompt, apiKey, jobData, url, resumeData, personalInfo } = body;
    
    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'PDF URL is required' },
        { status: 400 }
      );
    }
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Upload prompt is required' },
        { status: 400 }
      );
    }
    
    console.log('Processing PDF URL:', pdfUrl.substring(0, 50) + '...');
    
    try {
      // Create form data for the external API
      const formData = new FormData();
      
      // Create an enhanced prompt that includes job details if available
      let jobUrl = '';
      let enhancedPrompt = prompt;
      
      if (jobData) {
        const jobTitle = jobData.title || jobData.job_title || '';
        const company = jobData.company || jobData.company_name || '';
        
        // Enhance the prompt with job details if available
        if (jobTitle && company) {
          enhancedPrompt = `\n${prompt}\nJob Title: ${jobTitle}\nCompany: ${company}\nJob Descripton: ${jobData.description}\nLooking for skills in: ${jobData.skills}\n`;
        }
        
        // Always use the provided company_website as the target_url if present
        jobUrl = jobData.company_website || '';
        jobUrl = normalizeUrl(jobUrl);
      }

      // Determine the best source for contact information (prioritize resumeData over personalInfo)
      const contactInfo = resumeData ? {
        name: resumeData.name || '',
        email: resumeData.contact?.email || '',
        phone: resumeData.contact?.phone || '',
        location: resumeData.contact?.location || '',
        linkedin: resumeData.contact?.linkedin || '',
        website: resumeData.contact?.website || ''
      } : personalInfo ? {
        name: personalInfo.name || '',
        email: personalInfo.email || '',
        phone: personalInfo.phone || '',
        location: personalInfo.location || '',
        linkedin: personalInfo.linkedin || '',
        website: personalInfo.website || ''
      } : null;

      // Add personal information to the prompt
      if (contactInfo) {
        const basicInfo = `
Personal Information:
Name: ${contactInfo.name}
Email: ${contactInfo.email}
Phone: ${contactInfo.phone}
Location: ${contactInfo.location}
LinkedIn: ${contactInfo.linkedin}
Website: ${contactInfo.website}`;

        enhancedPrompt += basicInfo;
        console.log('Contact info added from:', resumeData ? 'resumeData' : 'personalInfo');
      }

      // Add application-specific questions if personalInfo is available
      if (personalInfo) {
        const applicationQuestionsArray = [
          personalInfo.salaryExpectations ? `Salary Expectations: ${personalInfo.salaryExpectations}` : null,
          personalInfo.workAuthorization ? `Work Authorization: ${personalInfo.workAuthorization}` : null,
          personalInfo.requireSponsorship !== undefined ? `Requires Sponsorship: ${personalInfo.requireSponsorship ? 'Yes' : 'No'}` : null,
          personalInfo.militaryStatus ? `Military Status: ${personalInfo.militaryStatus}` : null,
          personalInfo.veteranStatus ? `Veteran Status: ${personalInfo.veteranStatus}` : null,
          personalInfo.disabilityStatus ? `Disability Status: ${personalInfo.disabilityStatus}` : null,
          personalInfo.accommodationsNeeded ? `Accommodations Needed: ${personalInfo.accommodationsNeeded}` : null,
          personalInfo.gender ? `Gender: ${personalInfo.gender}` : null,
          personalInfo.ethnicity ? `Ethnicity: ${personalInfo.ethnicity}` : null,
          personalInfo.willingToRelocate !== undefined ? `Willing to Relocate: ${personalInfo.willingToRelocate ? 'Yes' : 'No'}` : null,
          personalInfo.remoteWorkPreference ? `Remote Work Preference: ${personalInfo.remoteWorkPreference}` : null,
          personalInfo.availableStartDate ? `Available Start Date: ${personalInfo.availableStartDate}` : null,
          personalInfo.referralSource ? `Referral Source: ${personalInfo.referralSource}` : null,
          personalInfo.previouslyEmployed !== undefined ? `Previously Employed: ${personalInfo.previouslyEmployed ? 'Yes' : 'No'}` : null,
          personalInfo.previousEmploymentDetails ? `Previous Employment Details: ${personalInfo.previousEmploymentDetails}` : null
        ].filter(item => item !== null);
        
        // Only add application questions section if there are actual questions to include
        if (applicationQuestionsArray.length > 0) {
          enhancedPrompt += `\n\nApplication Questions:\n${applicationQuestionsArray.join('\n')}`;
        }
        
        console.log('Application questions included:', applicationQuestionsArray.length);
      } else {
        console.log('Application questions included: 0');
      }

      // Add detailed resume information if available
      if (resumeData) {
        // Add professional summary
        if (resumeData.summary) {
          enhancedPrompt += `\n\nPROFESSIONAL SUMMARY:\n${resumeData.summary}`;
        }

        // Add skills
        if (resumeData.skills) {
          const skillsText = Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : resumeData.skills;
          enhancedPrompt += `\n\nSKILLS:\n${skillsText}`;
        }

        // Add work experience
        if (resumeData.experience && resumeData.experience.length > 0) {
          const experienceInfo = resumeData.experience.map((exp: any, index: number) => 
            `${index + 1}. ${exp.title} at ${exp.company} (${exp.dates})\n   Location: ${exp.location || 'Not specified'}\n   Highlights: ${exp.highlights?.join('; ') || 'None provided'}`
          ).join('\n');
          enhancedPrompt += `\n\nWORK EXPERIENCE:\n${experienceInfo}`;
        }

        // Add education
        if (resumeData.education && resumeData.education.length > 0) {
          const educationInfo = resumeData.education.map((edu: any, index: number) => 
            `${index + 1}. ${edu.degree} from ${edu.institution} (${edu.dates})\n   Location: ${edu.location || 'Not specified'}\n   Details: ${edu.details?.join('; ') || 'None provided'}`
          ).join('\n');
          enhancedPrompt += `\n\nEDUCATION:\n${educationInfo}`;
        }

        // Add projects if available
        if (resumeData.projects && resumeData.projects.length > 0) {
          const projectsInfo = resumeData.projects.map((project: any, index: number) => 
            `${index + 1}. ${project.name}\n   Description: ${project.description || 'Not provided'}\n   Technologies: ${project.technologies?.join(', ') || 'Not specified'}`
          ).join('\n');
          enhancedPrompt += `\n\nPROJECTS:\n${projectsInfo}`;
        }
      }

      // Add instructions for form filling
      if (resumeData || personalInfo || jobData) {
        enhancedPrompt += `\n\nIMPORTANT INSTRUCTIONS FOR FORM FILLING:
- Use the detailed resume information provided above to fill out all form fields accurately
- Fill out contact information, work experience, education, skills, and any other relevant sections
- Use the exact information provided in the resume data above
- For application-specific questions, use the answers provided in the Application Questions section
- Be thorough and complete when filling out forms`;
      }
      
      // Instead of trying to convert the data URI to a blob here,
      // we'll pass the data URI directly to the backend using the file_url parameter
      formData.append('file_url', pdfUrl);
      
      // CRITICAL: Add the prompt parameter that was missing before
      formData.append('prompt', enhancedPrompt);
      
      // Log the prompt for debugging (truncated to avoid excessive logging)
      console.log('Enhanced prompt (first 200 chars):', enhancedPrompt.substring(0, 200) + '...');
      console.log('Prompt contains personal info:', !!personalInfo);
      console.log('Prompt contains resume data:', !!resumeData);
      console.log('Form data fields being sent:', Array.from(formData.keys()));
      
      // Log a sample of the structured data being sent (for debugging)
      if (resumeData) {
        console.log('Resume data sample:', {
          name: resumeData.name,
          email: resumeData.contact?.email,
          phone: resumeData.contact?.phone,
          location: resumeData.contact?.location,
          linkedin: resumeData.contact?.linkedin,
          website: resumeData.contact?.website,
          experienceCount: resumeData.experience?.length,
          firstJobTitle: resumeData.experience?.[0]?.title,
          skillsCount: Array.isArray(resumeData.skills) ? resumeData.skills.length : 0
        });
      } else {
        console.log('No resume data received in request');
      }
      
      // Log personal info sample for debugging
      if (personalInfo) {
        console.log('Personal info sample:', {
          name: personalInfo.name,
          email: personalInfo.email,
          phone: personalInfo.phone,
          location: personalInfo.location,
          linkedin: personalInfo.linkedin,
          website: personalInfo.website,
          hasApplicationQuestions: !!(personalInfo.salaryExpectations || personalInfo.workAuthorization)
        });
      } else {
        console.log('No personal info received in request');
      }
      
      if (apiKey) {
        formData.append('api_key', apiKey);
      }
      
      // Always pass the company_website as target_url if present
      if (jobUrl) {
        formData.append('target_url', jobUrl);
      }
      
      // Use the provided url directly for the form data
      if (url) {
        formData.append('url', normalizeUrl(url));
      }
      
      // Call the external API to start the upload process with timeout
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error from external API:', errorText);
        
        return NextResponse.json(
          { error: 'Failed to start auto-apply process', details: errorText },
          { status: response.status }
        );
      }
      
      const responseData = await response.json();
      return NextResponse.json(responseData);
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      
      // Specific error handling for connection issues
      if (error.name === 'AbortError' || error.code?.startsWith('UND_ERR_')) {
        return NextResponse.json(
          { error: 'Connection to auto-apply service failed. Please try again later.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to process PDF: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error starting auto-apply process:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start auto-apply process' },
      { status: 500 }
    );
  }
} 