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
    const { pdfUrl, prompt, apiKey, jobData, url } = body;
    
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
      
      // Instead of trying to convert the data URI to a blob here,
      // we'll pass the data URI directly to the backend using the file_url parameter
      formData.append('file_url', pdfUrl);
      
      // CRITICAL: Add the prompt parameter that was missing before
      formData.append('prompt', enhancedPrompt);
      
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