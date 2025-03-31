import { NextRequest, NextResponse } from 'next/server';
import { prepareResumeTextForAPI } from '../../utils/resumeAdapter';

// Bore.pub service URLs for task management
const BORE_PUB_RUN_TASK_URL = 'http://bore.pub:37211/run-task';
const BORE_PUB_STOP_TASK_URL = 'http://bore.pub:37211/stop-task';
const BORE_PUB_TASK_STATUS_URL = 'http://bore.pub:37211/task-status';

// Maximum time (in milliseconds) a task should run before we force stop it
const MAX_TASK_RUNTIME = 180000; // 3 minutes

// Interface for the request body
interface AutoApplyTaskRequestBody {
  task: string;
  system_prompt?: string;
  api_key?: string;
  [key: string]: unknown;
}

/**
 * POST handler for Auto Apply
 * This bypasses CORS using the bore.pub service to automate job applications
 * Implements the polling pattern to track task status
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract job details and optional API key
    const { jobUrl, companyName, jobTitle, resumeData, resumePdfData, apiKey } = body;
    
    // Check if jobUrl is provided
    if (!jobUrl) {
      return NextResponse.json(
        { error: 'Job application URL is required' },
        { status: 400 }
      );
    }
    
    // Check if we have a resume
    if (!resumeData && !resumePdfData) {
      return NextResponse.json(
        { error: 'Resume data is required for auto-applying' },
        { status: 400 }
      );
    }
    
    console.log(`Starting auto-apply for job: ${jobTitle} at ${companyName}, URL: ${jobUrl}`);
    
    // Format resume data as text for the automation task
    const formattedResumeText = prepareResumeTextForAPI(resumeData, resumePdfData);
    
    // Define system prompt for better guidance of the automation
    const systemPrompt = `You are a professional job application assistant. Your task is to help users apply to jobs automatically.
Follow the instructions carefully and meticulously. If you encounter any obstacles, try alternative approaches to complete the application.
Focus on filling required fields accurately using the user's resume data. Look for ways to submit the application or reach a confirmation page.
Report all steps and outcomes clearly, including what information was submitted and any challenges encountered.`;
    
    // Create the auto-apply task for the bore.pub service
    const task = `
Go to the job application URL: ${jobUrl}

Analyze the page to determine the type of job application form:
- Look for application forms, "Apply Now" buttons, or login requirements
- Determine if it's a direct application or redirects to another platform

Below is the user's resume information to use for filling out forms:
${formattedResumeText || 'No plaintext resume available, but PDF data is available for upload.'}

Proceed based on the page type:
1. For direct application forms:
   - Fill out the form with the resume data provided above
   - Use exact information from the resume when filling fields
   - For name fields, use "${resumeData?.name || 'User\'s name'}"
   - For email, use "${resumeData?.contact?.email || 'User\'s email'}"
   - For phone, use "${resumeData?.contact?.phone || 'User\'s phone'}"
   - For location/address, use "${resumeData?.contact?.location || 'User\'s location'}"
   - For experience, education, and skills, refer to the resume text above
   - Upload resume if possible (the resume data is available)
   - Complete all required fields using information from the resume
   - Submit the application if possible

2. For login-required applications:
   - Note that the site requires login
   - Do not attempt to create accounts
   - Report this obstacle clearly

3. For multi-step applications:
   - Complete as many steps as possible
   - Fill all available fields with appropriate information from the resume
   - Document progress through each step

4. For redirect to job boards (Indeed, LinkedIn, etc.):
   - Follow the redirect
   - Attempt to apply on the destination site
   - Document which platform was used

Document the entire process including:
- Form fields encountered and what data was entered
- Any obstacles or barriers to completing the application
- Confirmation messages or errors received
- Final status of the application (completed, partial, blocked)

Return to google.com when finished
Compile and return the detailed application results including all steps taken and the final outcome.
`;

    console.log('Starting Auto Apply with task');
    
    // Prepare the request body with optional parameters
    const requestBody: AutoApplyTaskRequestBody = { task };
    
    // Add system prompt
    requestBody.system_prompt = systemPrompt;
    
    // Use provided API key, or fall back to environment variable
    const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
    
    // Add API key if provided
    if (geminiApiKey) {
      requestBody.api_key = geminiApiKey.trim();
      console.log('Using provided API key:', geminiApiKey.substring(0, 5) + '...');
    } else {
      console.log('No API key provided, relying on bore.pub default');
    }
    
    // Create the fetch request to bore.pub to START the task
    const response = await fetch(BORE_PUB_RUN_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error(`Auto Apply failed to start: ${response.statusText}`);
      return NextResponse.json(
        { error: `Auto Apply failed to start: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Get the task information with the task ID
    const taskInfo = await response.json();
    console.log('Task started with info:', taskInfo);
    
    if (!taskInfo || !taskInfo.task_id) {
      return NextResponse.json(
        { error: 'Failed to get task ID from service' },
        { status: 500 }
      );
    }
    
    // Set up the automatic task stopping after MAX_TASK_RUNTIME
    const taskId = taskInfo.task_id;
    
    // Set up a background timeout to stop the task if it runs too long
    setTimeout(async () => {
      try {
        // Check if the task is still running before stopping it
        const statusResponse = await fetch(`${BORE_PUB_TASK_STATUS_URL}/${taskId}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.status === 'running') {
            console.log(`Task ${taskId} is taking too long, stopping it automatically...`);
            await stopTask(taskId);
          }
        }
      } catch (stopError) {
        console.error(`Error in timeout handler for task ${taskId}:`, stopError);
      }
    }, MAX_TASK_RUNTIME);
    
    // Return the task ID for polling
    return NextResponse.json({
      task_id: taskId,
      taskId: taskId,
      status: 'running',
      message: 'Auto Apply task started successfully',
      jobTitle,
      companyName,
      jobUrl
    });
    
  } catch (error) {
    console.error('Error initiating Auto Apply:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler to check the status of a task by polling
 */
export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Checking status of task: ${taskId}`);
    
    // Call the task-status endpoint
    const statusUrl = `${BORE_PUB_TASK_STATUS_URL}/${taskId}`;
    const statusResponse = await fetch(statusUrl);
    
    if (!statusResponse.ok) {
      console.error(`Failed to get task status: ${statusResponse.statusText}`);
      return NextResponse.json(
        { error: `Failed to get task status: ${statusResponse.statusText}` },
        { status: statusResponse.status }
      );
    }
    
    // Return the status
    const statusData = await statusResponse.json();
    console.log(`Task ${taskId} status:`, statusData.status);
    
    // Make sure we have consistent field names
    return NextResponse.json({
      ...statusData,
      task_id: taskId,
      taskId: taskId
    });
    
  } catch (error) {
    console.error('Error checking task status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to stop a running task
 * @param taskId The ID of the task to stop
 */
async function stopTask(taskId: string): Promise<void> {
  try {
    console.log(`Stopping task with ID: ${taskId}`);
    const stopResponse = await fetch(BORE_PUB_STOP_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task_id: taskId })
    });
    
    if (!stopResponse.ok) {
      console.error(`Failed to stop task: ${stopResponse.statusText}`);
      return;
    }
    
    const stopResult = await stopResponse.json();
    console.log('Task stop result:', stopResult);
  } catch (error) {
    console.error('Error stopping task:', error);
    throw error;
  }
} 