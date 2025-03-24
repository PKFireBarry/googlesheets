// LinkedIn lookup utility functions

/**
 * Ensures the URL has the proper protocol
 * @param url The URL to process
 * @returns The URL with the proper protocol
 */
export const ensureProperProtocol = (url: string): string => {
  // If it's a localhost URL without protocol, add https:// for our specific webhook
  if (url.startsWith('localhost') && url.includes('5678/webhook')) {
    return `https://${url}`;
  }
  
  // If it's a regular localhost URL without protocol, add http://
  if (url.startsWith('localhost')) {
    return `http://${url}`;
  }
  
  // If there's no protocol, add https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
};

/**
 * Creates a promise that resolves after a specified delay
 * @param ms Delay in milliseconds
 * @returns A promise that resolves after the delay
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Interface for LinkedIn task status updates
 */
interface TaskStatusUpdate {
  status: string;
  progress: number;
  elapsedTime: number;
  message?: string;
}

/**
 * Interface for task status update callback
 */
type TaskStatusCallback = (update: TaskStatusUpdate) => void;

/**
 * Polls a function until it returns a truthy value or times out
 * @param fn The function to poll
 * @param interval Polling interval in milliseconds
 * @param timeout Timeout in milliseconds
 * @param onUpdate Optional callback for status updates
 * @returns The result of the function when it returns a truthy value
 */
const poll = async <T>(
  fn: () => Promise<T | null>, 
  interval: number = 2000, 
  timeout: number = 120000,
  onUpdate?: TaskStatusCallback
): Promise<T> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Calculate progress as percentage of time elapsed
    const elapsedMs = Date.now() - startTime;
    const progress = Math.min(Math.round((elapsedMs / timeout) * 100), 99);
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    
    // Call the update callback if provided
    if (onUpdate) {
      onUpdate({
        status: 'polling',
        progress,
        elapsedTime: elapsedSeconds,
        message: `Checking task status (${elapsedSeconds}s elapsed)`
      });
    }
    
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      console.error('Poll function error:', error);
      // Continue despite errors
    }
    
    await delay(interval);
  }
  
  throw new Error(`Polling timed out after ${timeout}ms`);
};

/**
 * Interface for LinkedIn contact data
 */
export interface LinkedInContactData {
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  website: string;
  profileImage: string;
  company: string;
  phone: string;
  location: string;
  [key: string]: unknown; // Allow for additional properties
}

/**
 * Looks up HR contacts at a company using the LinkedIn API and Gemini for processing
 * @param company The company name to look up
 * @param apiKey Optional Gemini API key
 * @param jobData Optional job data for personalizing messages
 * @param timeout Timeout in milliseconds
 * @param onStatusUpdate Optional callback for status updates
 * @returns Array of contact data objects
 */
export const lookupLinkedInHR = async (
  company: string, 
  apiKey?: string,
  jobData?: Record<string, unknown>,
  timeout = 180000, // 3 minutes default timeout
  onStatusUpdate?: TaskStatusCallback
): Promise<LinkedInContactData[]> => {
  const startTime = Date.now();
  
  if (!company) {
    throw new Error('Company name is required');
  }
  
  try {
    // Start the LinkedIn lookup task
    onStatusUpdate?.({
      status: 'starting',
      progress: 5,
      elapsedTime: 0,
      message: 'Starting LinkedIn HR contact search...'
    });
    
    // Call the LinkedIn API to start a lookup task
    const startResponse = await fetch('/api/linkedin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        company,
        apiKey
      })
    });
    
    // Log if we're using an API key (without exposing it)
    if (apiKey) {
      console.log(`Using user-provided API key (${apiKey.substring(0, 5)}...) for LinkedIn lookup`);
    } else {
      console.log('No API key provided by user for LinkedIn lookup');
    }
    
    // Get the full response as JSON first, then check status
    const responseData = await startResponse.json();
    console.log('LinkedIn API response:', responseData);
    
    if (!startResponse.ok) {
      throw new Error(responseData.error || 'Failed to start LinkedIn search');
    }
    
    // Get the task ID from the response - note the key is task_id, not taskId
    const taskId = responseData.task_id || responseData.taskId;
    
    if (!taskId) {
      console.error('No task_id or taskId found in response:', responseData);
      throw new Error('No task ID returned from LinkedIn API');
    }
    
    console.log(`Started LinkedIn lookup task with ID: ${taskId}`);
    
    // Update status to show we're now polling
    onStatusUpdate?.({
      status: 'polling',
      progress: 10,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: 'Search started, waiting for results...'
    });
    
    // Poll the task status until it's complete
    const pollTaskStatus = async () => {
      try {
        console.log(`Polling for task status: ${taskId}`);
        const statusResponse = await fetch(`/api/linkedin?taskId=${encodeURIComponent(taskId)}`);
        
        if (!statusResponse.ok) {
          console.error(`Error checking task status: ${statusResponse.statusText}`);
          return null;
        }
        
        const statusData = await statusResponse.json();
        console.log('Task status response:', statusData);
        
        // Check if the task is still running
        if (statusData.status === 'running') {
          console.log('Task still running, will check again...');
          return null;
        }
        
        // Check if the task is complete with results
        // Handle both possible response structures: statusData.results or statusData.result.result
        if (statusData.status === 'completed' && (statusData.results || (statusData.result && statusData.result.result))) {
          console.log('Task completed with results!');
          // Update the status to show we're processing the results
          onStatusUpdate?.({
            status: 'processing',
            progress: 80,
            elapsedTime: Math.round((Date.now() - startTime) / 1000),
            message: 'Processing search results with AI...'
          });
          
          // Process the results with Gemini - use the correct results field and pass job data
          const resultsToProcess = statusData.results || statusData.result;
          const contacts = await processContactsWithGemini(resultsToProcess, company, apiKey, jobData);
          
          return contacts;
        }
        
        // If the task completed but with an error
        if (statusData.status === 'error') {
          console.error('Task completed with error:', statusData.message);
          throw new Error(statusData.message || 'LinkedIn search failed');
        }
        
        // If we get an unexpected status
        console.log('Received unexpected task status:', statusData.status);
        return null;
      } catch (error) {
        console.error('Error polling task status:', error);
        throw error;
      }
    };
    
    // Poll the task status until it's complete or times out
    const results = await poll(
      pollTaskStatus,
      3000, // Poll every 3 seconds
      timeout, // Use the provided timeout
      onStatusUpdate
    );
    
    // Final success status update
    onStatusUpdate?.({
      status: 'completed',
      progress: 100,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: 'LinkedIn search completed successfully!'
    });
    
    return results || [];
  } catch (error) {
    console.error('LinkedIn lookup error:', error);
    
    // Final error status update
    onStatusUpdate?.({
      status: 'error',
      progress: 100,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    
    throw error;
  }
};

/**
 * Processes LinkedIn contact data with the Gemini API
 * @param rawData The raw contact data from LinkedIn
 * @param company The company name
 * @param apiKey Optional Gemini API key
 * @param jobData Optional job data for personalizing messages
 * @returns Array of processed contact data objects
 */
async function processContactsWithGemini(
  rawData: Record<string, unknown>, 
  company: string, 
  apiKey?: string,
  jobData?: Record<string, unknown>
): Promise<LinkedInContactData[]> {
  try {
    console.log('Processing LinkedIn results with Gemini AI...');
    
    // Log if we're using an API key (without exposing it)
    if (apiKey) {
      console.log(`Using user-provided API key (${apiKey.substring(0, 5)}...) for Gemini processing`);
    } else {
      console.log('No API key provided by user for Gemini processing, will use environment variable');
    }
    
    // Handle nested result structure if needed
    // If rawData has a 'result' property that's an array, use that instead
    const dataToProcess = rawData.result && Array.isArray(rawData.result) 
      ? { result: rawData.result } 
      : rawData;
    
    console.log('Data structure for Gemini processing:', 
      Object.keys(dataToProcess), 
      'Result array length:', 
      Array.isArray(dataToProcess.result) ? dataToProcess.result.length : 'N/A'
    );
    
    // Include job data if provided for more personalized processing
    if (jobData) {
      console.log('Including job data for personalized message generation');
    }
    
    // Call the Gemini API to process the results
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rawData: dataToProcess,
        company,
        apiKey,
        jobData // Pass job data to Gemini API
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to process results with Gemini');
    }
    
    // The response should be a single contact object
    const data = await response.json();
    
    // The API returns a single contact, make it an array for consistency
    const contacts = [data].filter(contact => contact && contact.name && contact.name !== 'n/a');
    
    return contacts;
  } catch (error) {
    console.error('Error processing contacts with Gemini:', error);
    throw error;
  }
} 