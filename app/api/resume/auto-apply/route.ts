import { NextRequest, NextResponse } from 'next/server';

// External API endpoints
const UPLOAD_ENDPOINT = 'http://bore.pub:7777/test-upload';
const STATUS_ENDPOINT = 'http://bore.pub:7777/test-upload-status';

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
    const response = await fetch(`${STATUS_ENDPOINT}/${taskId}`);
    
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
    const { pdfUrl, prompt, apiKey, jobData } = body;
    
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
      let enhancedPrompt = prompt;
      let jobUrl = '';
      
      if (jobData) {
        const jobTitle = jobData.title || jobData.job_title || '';
        const company = jobData.company || jobData.company_name || '';
        jobUrl = jobData.url || jobData.company_website || '';
        
        // Create a more detailed prompt with job information
        enhancedPrompt = `Apply for the ${jobTitle} position at ${company}. ${
          jobUrl ? `Navigate to ${jobUrl} and ` : ''
        }complete the application form, upload the resume, and submit the application. ${prompt}`;
      }
      
      console.log('Enhanced prompt:', enhancedPrompt);
      
      // Instead of trying to convert the data URI to a blob here,
      // we'll pass the data URI directly to the backend using the file_url parameter
      formData.append('file_url', pdfUrl);
      formData.append('prompt', enhancedPrompt);
      
      if (apiKey) {
        formData.append('api_key', apiKey);
      }
      
      if (jobUrl) {
        formData.append('target_url', jobUrl);
      }
      
      console.log('Sending request with prompt:', enhancedPrompt);
      
      // Call the external API to start the upload process
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData
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