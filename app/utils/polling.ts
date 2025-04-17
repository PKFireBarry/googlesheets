import type { TaskStatusCallback } from './webhook';

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