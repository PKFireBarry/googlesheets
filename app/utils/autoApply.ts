/**
 * Utility for auto-applying to jobs using browser automation
 */

import { ResumeData } from '../types/resume';

/**
 * Interface for task status updates
 */
interface TaskStatusUpdate {
  status: string;
  progress: number;
  elapsedTime: number;
  message?: string;
}

/**
 * Interface for application results
 */
export interface AutoApplyResult {
  status: 'success' | 'partial' | 'failed';
  message: string;
  details: string;
  steps: string[];
  resumeSubmitted: boolean;
  formsFilled: boolean;
  obstacles: string[];
}

/**
 * Interface for task status update callback
 */
type TaskStatusCallback = (update: TaskStatusUpdate) => void;

/**
 * Creates a promise that resolves after a specified delay
 * @param ms Delay in milliseconds
 * @returns A promise that resolves after the delay
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
  timeout: number = 180000,
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
 * Auto-applies to a job using browser automation
 * @param jobUrl The job application URL
 * @param jobTitle The job title
 * @param companyName The company name
 * @param resumeData Parsed resume data (if available)
 * @param resumePdfData Resume PDF data as base64 string (if available)
 * @param apiKey Optional Gemini API key
 * @param timeout Timeout in milliseconds (default: 3 minutes)
 * @param onStatusUpdate Optional callback for status updates
 * @returns Auto application result
 */
export const autoApplyToJob = async (
  jobUrl: string,
  jobTitle: string,
  companyName: string,
  resumeData: ResumeData | null,
  resumePdfData: string | null,
  apiKey?: string,
  timeout = 180000, // 3 minutes default timeout
  onStatusUpdate?: TaskStatusCallback
): Promise<AutoApplyResult> => {
  const startTime = Date.now();
  
  if (!jobUrl) {
    throw new Error('Job application URL is required');
  }
  
  if (!resumeData && !resumePdfData) {
    throw new Error('Resume data is required for auto-applying');
  }
  
  try {
    // Start the auto-apply task
    onStatusUpdate?.({
      status: 'starting',
      progress: 5,
      elapsedTime: 0,
      message: 'Starting auto-apply process...'
    });
    
    // Call the auto-apply API to start a task
    const startResponse = await fetch('/api/auto-apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        jobUrl,
        jobTitle,
        companyName,
        resumeData,
        resumePdfData,
        apiKey
      })
    });
    
    // Log if we're using an API key (without exposing it)
    if (apiKey) {
      console.log(`Using user-provided API key (${apiKey.substring(0, 5)}...) for auto-apply`);
    } else {
      console.log('No API key provided by user for auto-apply');
    }
    
    // Get the full response as JSON first, then check status
    const responseData = await startResponse.json();
    console.log('Auto-apply API response:', responseData);
    
    if (!startResponse.ok) {
      throw new Error(responseData.error || 'Failed to start auto-apply process');
    }
    
    // Get the task ID from the response
    const taskId = responseData.task_id || responseData.taskId;
    
    if (!taskId) {
      console.error('No task_id or taskId found in response:', responseData);
      throw new Error('No task ID returned from auto-apply API');
    }
    
    console.log(`Started auto-apply task with ID: ${taskId}`);
    
    // Update status to show we're now polling
    onStatusUpdate?.({
      status: 'polling',
      progress: 10,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: 'Application started, waiting for results...'
    });
    
    // Poll the task status until it's complete
    const pollTaskStatus = async () => {
      try {
        console.log(`Polling for task status: ${taskId}`);
        const statusResponse = await fetch(`/api/auto-apply?taskId=${encodeURIComponent(taskId)}`);
        
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
        if (statusData.status === 'completed' && (statusData.results || (statusData.result && statusData.result.result))) {
          console.log('Task completed with results!');
          
          // Update the status to show we're processing the results
          onStatusUpdate?.({
            status: 'processing',
            progress: 90,
            elapsedTime: Math.round((Date.now() - startTime) / 1000),
            message: 'Processing application results...'
          });
          
          // Process the raw results into our standardized format
          const rawResults = statusData.results || statusData.result;
          const result = processAutoApplyResults(rawResults, jobTitle, companyName);
          
          return result;
        }
        
        // If the task completed but with an error
        if (statusData.status === 'error') {
          console.error('Task completed with error:', statusData.message);
          
          // Create an error result
          const errorResult: AutoApplyResult = {
            status: 'failed',
            message: statusData.message || 'Auto-apply failed',
            details: 'The automated job application process encountered an error and could not be completed.',
            steps: ['Started application process', 'Encountered an error'],
            resumeSubmitted: false,
            formsFilled: false,
            obstacles: [statusData.message || 'Unknown error']
          };
          
          return errorResult;
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
    const result = await poll(
      pollTaskStatus,
      3000, // Poll every 3 seconds
      timeout, // Use the provided timeout
      onStatusUpdate
    );
    
    // Final status update
    onStatusUpdate?.({
      status: result.status,
      progress: 100,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: result.message
    });
    
    return result;
  } catch (error) {
    console.error('Error in auto-apply process:', error);
    
    // Create an error result
    const errorResult: AutoApplyResult = {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'The automated job application process encountered an error and could not be completed.',
      steps: ['Started application process', 'Encountered an error'],
      resumeSubmitted: false,
      formsFilled: false,
      obstacles: [error instanceof Error ? error.message : 'Unknown error']
    };
    
    // Final error status update
    onStatusUpdate?.({
      status: 'error',
      progress: 100,
      elapsedTime: Math.round((Date.now() - startTime) / 1000),
      message: errorResult.message
    });
    
    return errorResult;
  }
};

/**
 * Processes raw auto-apply results into a standardized format
 * @param rawResults Raw results from the automation service
 * @param jobTitle The job title
 * @param companyName The company name
 * @returns Processed auto-apply results
 */
function processAutoApplyResults(
  rawResults: any,
  jobTitle: string,
  companyName: string
): AutoApplyResult {
  try {
    // Extract the relevant information from the raw results
    // This is challenging as the format can vary, so we try to be robust
    const resultText = typeof rawResults === 'string' 
      ? rawResults 
      : (rawResults.result || rawResults.output || JSON.stringify(rawResults));
    
    console.log('Processing raw results:', resultText);
    
    // Determine application success status from text content
    const successIndicators = ['application submitted', 'successfully applied', 'application complete', 'thank you for applying'];
    const partialIndicators = ['partial application', 'could not complete', 'additional steps required', 'account required'];
    const resumeSubmittedIndicators = ['resume uploaded', 'resume submitted', 'resume attached'];
    const formsFilledIndicators = ['form filled', 'entered information', 'completed fields'];
    const obstacleIndicators = ['login required', 'account required', 'could not', 'unable to', 'blocked', 'captcha', 'error'];
    
    // Check for success indicators
    const isSuccess = successIndicators.some(indicator => 
      resultText.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Check for partial success indicators
    const isPartial = partialIndicators.some(indicator => 
      resultText.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Check if resume was submitted
    const resumeSubmitted = resumeSubmittedIndicators.some(indicator => 
      resultText.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Check if forms were filled
    const formsFilled = formsFilledIndicators.some(indicator => 
      resultText.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Extract obstacles
    const obstacles = obstacleIndicators
      .filter(indicator => resultText.toLowerCase().includes(indicator.toLowerCase()))
      .map(indicator => {
        // Try to extract the full sentence containing this obstacle
        const sentences = resultText.split(/[.!?]\s+/);
        const relevantSentence = sentences.find((s: string) => 
          s.toLowerCase().includes(indicator.toLowerCase())
        );
        return relevantSentence || `Encountered obstacle: ${indicator}`;
      });
    
    // Extract application steps from the text
    // This is a simplistic approach - we split by newlines or numbered items
    const steps = resultText
      .split(/\n|(?:\d+\.\s*)/)
      .map((step: string) => step.trim())
      .filter((step: string) => step.length > 10) // Require reasonable length
      .slice(0, 10); // Limit to 10 steps for simplicity
    
    // Determine the overall status and construct message
    let status: 'success' | 'partial' | 'failed';
    let message: string;
    
    if (isSuccess) {
      status = 'success';
      message = `Successfully applied to ${jobTitle} position at ${companyName}.`;
    } else if (isPartial || resumeSubmitted || formsFilled) {
      status = 'partial';
      message = `Partially completed application for ${jobTitle} at ${companyName}.`;
    } else {
      status = 'failed';
      message = `Unable to complete application for ${jobTitle} at ${companyName}.`;
    }
    
    // Create the final result
    return {
      status,
      message,
      details: resultText,
      steps: steps.length > 0 ? steps : ['Application process was attempted'],
      resumeSubmitted,
      formsFilled,
      obstacles
    };
  } catch (error) {
    console.error('Error processing auto-apply results:', error);
    
    // Fallback result
    return {
      status: 'failed',
      message: 'Failed to process auto-apply results',
      details: typeof rawResults === 'string' 
        ? rawResults 
        : JSON.stringify(rawResults, null, 2),
      steps: ['Application process was attempted', 'Error processing results'],
      resumeSubmitted: false,
      formsFilled: false,
      obstacles: ['Error processing results']
    };
  }
} 