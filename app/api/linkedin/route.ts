import { NextRequest, NextResponse } from 'next/server';

// Bore.pub service URLs for task management from environment variables
const BORE_PUB_RUN_TASK_URL = process.env.LINKEDIN_RUN_TASK_URL || 'http://bore.pub:7777/run-task';
const BORE_PUB_STOP_TASK_URL = process.env.LINKEDIN_STOP_TASK_URL || 'http://bore.pub:7777/stop-task';
const BORE_PUB_TASK_STATUS_URL = process.env.LINKEDIN_TASK_STATUS_URL || 'http://bore.pub:7777/task-status';

// Maximum time (in milliseconds) a task should run before we force stop it
const MAX_TASK_RUNTIME = 95000; // 1.5 minutes

// Interface for the request body
interface LinkedInTaskRequestBody {
  task: string;
  system_prompt?: string;
  api_key?: string;
  [key: string]: unknown;
}

/**
 * POST handler for LinkedIn lookup
 * This bypasses CORS using the bore.pub service to scrape LinkedIn data
 * Implements the polling pattern instead of waiting for task completion
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract company and optional API key
    const { company, apiKey } = body;
    
    // Check if company is provided
    if (!company) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }
    
    console.log(`Looking up LinkedIn HR contacts for company: ${company}`);
    
    // Define system prompt for better guidance of the automation
    const systemPrompt = `You are a professional LinkedIn researcher. Your task is to find HR contacts at companies using Google and LinkedIn.
Follow the instructions carefully and meticulously. If you encounter any obstacles, try alternative approaches to find the information.
Focus specifically on finding HR personnel with clear job titles related to Human Resources, Recruitment, or Talent Acquisition.
Extract profile details accurately, especially LinkedIn profile URLs and contact information.`;
    
    // Create the LinkedIn search task for the bore.pub service
    const task = `
Go to Google.com (always start with this step)
Search for the company ${company} on LinkedIn.

Check if the Company has a LinkedIn Page
    If no LinkedIn page is found, return to Google.com and exit the process.
    If a LinkedIn page is found, click on the company page.

Navigate to the People Section
    Locate the People section of the company's LinkedIn page.
    Scroll down to the people cards on the page to find people that work in HR-related roles.
    Identify profiles of employees (excluding accounts labeled as "LinkedIn Member", as these are private).
  
Find HR-Related Employees
    Search for at least one employee with a job title related to:
        Human Resources (HR)
        Recruitment
        Talent Acquisition
        Hiring Manager
        Other relevant HR roles
    If no suitable employee is found, return to Google.com and exit the process.

Extract Contact Information
    Click on the selected employee's profile picture to open their profile.
    Click the More button.
    Open the Contact Info overlay and collect any available details, such as:
        Full name
        Profile image URL
        Job title
        LinkedIn profile URL
        Email (if available)
        Company website (if available)
Return to google.com
Return the Results of the LinkedIn profile found
Compile and return all collected information about the HR employee(s) and any available company HR contact details.
`;

    // Prepare the request body with optional parameters
    const requestBody: LinkedInTaskRequestBody = { task };
    
    // Add system prompt 
    requestBody.system_prompt = systemPrompt;
    
    // Use provided API key, or fall back to environment variable
    const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
    
    // Add API key if provided
    if (geminiApiKey) {
      requestBody.api_key = geminiApiKey.trim();
      console.log('Using API key for the task');
    }
    
    // Create the fetch request to bore.pub to START the task
    console.log(`Connecting to task service: ${BORE_PUB_RUN_TASK_URL}`);
    try {
      const response = await fetch(BORE_PUB_RUN_TASK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://googlesheets.vercel.app',
          'Access-Control-Request-Method': 'POST'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        let errorMessage = `LinkedIn lookup failed to start: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error response');
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: response.status }
        );
      }
      
      // Get the task information with the task ID
      const taskInfo = await response.json();
      
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
              console.log(`Task ${taskId} is taking too long, stopping it automatically`);
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
        message: 'LinkedIn search task started successfully',
        company: company
      });
    } catch (fetchError: unknown) {
      console.error('Fetch error when connecting to service:', fetchError);
      return NextResponse.json(
        { error: `Failed to connect to task service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error initiating LinkedIn HR lookup:', error);
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
  } catch (error) {
    console.error('Error stopping task:', error);
    throw error;
  }
} 
