// Define the TaskStatusCallback type directly instead of importing it
type TaskStatusCallback = (status: {
  status: string;
  progress: number;
  elapsedTime: number;
  message: string;
}) => void;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Polls a function until it returns a truthy value or times out
 * @param fn The function to poll
 * @param interval Polling interval in milliseconds
 * @param timeout Timeout in milliseconds
 * @param onUpdate Optional callback for status updates
 * @returns The result of the function when it returns a truthy value
 */
export const poll = async <T>(
  fn: () => Promise<T | null>, 
  interval: number = 2000, 
  timeout: number = 180000,
  onUpdate?: TaskStatusCallback
): Promise<T> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const elapsedMs = Date.now() - startTime;
    const progress = Math.min(Math.round((elapsedMs / timeout) * 100), 99);
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    
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
    }
    
    await delay(interval);
  }
  
  throw new Error(`Polling timed out after ${timeout}ms`);
}; 

/**
 * Utility functions for polling APIs
 */

/**
 * Generic polling function that calls a callback until a condition is met
 * @param callback Function to call on each poll
 * @param condition Function that returns true when polling should stop
 * @param interval Polling interval in ms
 * @param maxAttempts Maximum number of polling attempts
 * @returns Promise that resolves when condition is met or rejects after maxAttempts
 */
export async function pollUntil<T>(
  callback: () => Promise<T>,
  condition: (result: T) => boolean,
  interval: number = 2000,
  maxAttempts: number = 30
): Promise<T> {
  let attempts = 0;
  let lastResult: T | null = null;
  let lastError: Error | null = null;
  
  return new Promise<T>(async (resolve, reject) => {
    const executePoll = async () => {
      try {
        const result = await callback();
        lastResult = result;
        
        if (condition(result)) {
          resolve(result);
          return;
        }
        
        attempts++;
        
        if (attempts >= maxAttempts) {
          reject(new Error(`Polling timed out after ${maxAttempts} attempts. Last result: ${JSON.stringify(lastResult)}`));
          return;
        }
        
        setTimeout(executePoll, interval);
      } catch (error: any) {
        lastError = error;
        attempts++;
        
        if (attempts >= maxAttempts) {
          reject(new Error(`Polling failed after ${maxAttempts} attempts. Last error: ${error.message}`));
          return;
        }
        
        // Continue polling despite errors
        console.warn(`Polling attempt ${attempts} failed: ${error.message}. Retrying in ${interval}ms...`);
        setTimeout(executePoll, interval);
      }
    };
    
    executePoll();
  });
}

/**
 * Polls the auto-apply status endpoint until a terminal state is reached
 * @param taskId The task ID to poll for
 * @param interval Polling interval in ms
 * @param maxAttempts Maximum number of polling attempts
 * @returns Promise that resolves with the final status data
 */
export async function pollAutoApplyStatus(
  taskId: string,
  interval: number = 3000,
  maxAttempts: number = 40
): Promise<{
  status: string;
  result?: any;
  error?: string;
  progress?: number;
  message?: string;
}> {
  console.log(`Starting to poll for task ${taskId} status...`);
  
  return pollUntil(
    async () => {
      try {
        const response = await fetch(`/api/resume/auto-apply?taskId=${taskId}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response from status API: ${response.status} ${errorText}`);
          throw new Error(`Failed to check upload status: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`Poll status for task ${taskId}:`, data.status);
        return data;
      } catch (error: any) {
        console.error(`Error polling for task ${taskId}:`, error);
        throw error;
      }
    },
    (result) => {
      // Terminal states: completed, failed
      const isTerminal = result.status === 'completed' || result.status === 'failed';
      if (isTerminal) {
        console.log(`Task ${taskId} reached terminal state: ${result.status}`);
      }
      return isTerminal;
    },
    interval,
    maxAttempts
  ).catch(error => {
    // If polling fails, return a failed status
    console.error(`Polling for task ${taskId} failed:`, error);
    return {
      status: 'failed',
      error: `Polling failed: ${error.message}`
    };
  });
} 