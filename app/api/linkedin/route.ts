import { NextRequest, NextResponse } from 'next/server';

// Bore.pub service URLs for task management
const BORE_PUB_RUN_TASK_URL = 'http://bore.pub:37211/run-task';
const BORE_PUB_STOP_TASK_URL = 'http://bore.pub:37211/stop-task';

// Maximum time (in milliseconds) a task should run before we force stop it
const MAX_TASK_RUNTIME = 150000; // 2.5 minutes

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
 */
export async function POST(request: NextRequest) {
  let taskId: string | null = null;
  
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

    console.log('Starting LinkedIn search with task');
    
    // Prepare the request body with optional parameters
    const requestBody: LinkedInTaskRequestBody = { task };
    
    // Add system prompt if provided
    requestBody.system_prompt = systemPrompt;
    
    // Use provided API key, or fall back to environment variable
    const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
    
    // Add API key if provided
    if (geminiApiKey) {
      requestBody.api_key = geminiApiKey;
      console.log('Using provided API key for the task');
    } else {
      console.log('No API key provided, relying on bore.pub default');
    }
    
    // Create the fetch request to bore.pub
    const response = await fetch(BORE_PUB_RUN_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.error(`LinkedIn lookup failed: ${response.statusText}`);
      return NextResponse.json(
        { error: `LinkedIn lookup failed: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Get the raw result from bore.pub
    const rawResult = await response.json();
    console.log('Raw LinkedIn search result status:', rawResult.status);
    
    // Extract task ID for potential termination if needed
    if (rawResult && rawResult.task_id) {
      taskId = rawResult.task_id;
      console.log(`Task started with ID: ${taskId}`);
      
      // Set a timeout to stop the task if it runs too long
      // This is a safety mechanism to prevent infinite looping tasks
      setTimeout(async () => {
        try {
          if (rawResult.status !== 'completed') {
            console.log(`Task ${taskId} is taking too long, stopping it automatically...`);
            if (taskId) {
              await stopTask(taskId);
            }
          }
        } catch (stopError) {
          console.error(`Error stopping task ${taskId}:`, stopError);
        }
      }, MAX_TASK_RUNTIME);
    }
    
    // Check if the search was successful
    if (!rawResult || rawResult.status !== 'completed') {
      return NextResponse.json(
        { error: 'LinkedIn search did not complete successfully' },
        { status: 500 }
      );
    }
    
    // Return the raw result
    return NextResponse.json(rawResult);
  } catch (error) {
    // If an error occurs and we have a task ID, try to stop the task
    if (taskId) {
      try {
        await stopTask(taskId);
      } catch (stopError) {
        console.error(`Error stopping task ${taskId} after exception:`, stopError);
      }
    }
    
    console.error('Error in LinkedIn HR lookup:', error);
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