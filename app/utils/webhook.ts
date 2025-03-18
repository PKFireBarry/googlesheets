// Webhook utility functions

// Hardcoded webhook URL - use the same one across the application
export const WEBHOOK_URL = 'http://localhost:5678/webhook/1f50d8b8-820e-43b4-91a5-5cc31014fc8a';

// Default timeout for webhook requests (in milliseconds)
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Ensures the webhook URL has the proper protocol
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
 * Creates a promise that rejects after a specified timeout
 * @param ms Timeout in milliseconds
 * @returns A promise that rejects after the timeout
 */
const timeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
};

/**
 * Sends data to the webhook with a timeout
 * @param type The type of data being sent
 * @param data The data to send
 * @param timeout Optional timeout in milliseconds (defaults to 30 seconds)
 * @returns Promise that resolves when the data is sent
 */
export const sendToWebhook = async (type: string, data: any, timeout = DEFAULT_TIMEOUT) => {
  try {
    console.log(`Sending ${type} data to webhook:`, data);
    
    // Use our API route instead of calling the webhook directly
    const apiUrl = '/api/webhook';
    
    // Create the fetch request
    const fetchPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl: WEBHOOK_URL,
        type,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
    
    // Race the fetch against a timeout
    const response = await Promise.race([
      fetchPromise,
      timeoutPromise(timeout)
    ]) as Response;
    
    if (!response.ok) {
      console.error('Failed to send data to webhook:', response.statusText);
      return false;
    } else {
      console.log('Data successfully sent to webhook');
      return true;
    }
  } catch (error) {
    console.error('Error sending data to webhook:', error);
    return false;
  }
};

/**
 * Tests the webhook connection
 * @param webhookUrl The webhook URL to test
 * @param timeout Optional timeout in milliseconds (defaults to 30 seconds)
 * @returns Promise that resolves with the test result
 */
export const testWebhook = async (webhookUrl: string, timeout = DEFAULT_TIMEOUT) => {
  try {
    console.log(`Testing webhook connection: ${webhookUrl}`);
    
    const processedUrl = ensureProperProtocol(webhookUrl);
    
    // Use our API route instead of calling the webhook directly
    const apiUrl = '/api/webhook';
    
    // Create the fetch request
    const fetchPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl: processedUrl,
        type: 'test_connection',
        timestamp: new Date().toISOString(),
      }),
    });
    
    // Race the fetch against a timeout
    const response = await Promise.race([
      fetchPromise,
      timeoutPromise(timeout)
    ]) as Response;
    
    if (!response.ok) {
      throw new Error(`Test failed: ${response.statusText}`);
    }
    
    // Try to parse the response as JSON
    try {
      const responseData = await response.json();
      console.log('Webhook test response:', responseData);
      return { success: true, data: responseData };
    } catch (e) {
      // If we can't parse the response as JSON, that's okay
      console.log('Webhook test successful (no JSON response)');
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Webhook test failed:', error);
    throw error;
  }
};

/**
 * Looks up HR contacts for a company
 * @param company The company name to look up
 * @param timeout Optional timeout in milliseconds (defaults to 30 seconds)
 * @returns Promise that resolves with the HR contacts
 */
export const lookupHRContacts = async (company: string, timeout = 60000) => {
  try {
    console.log(`Looking up HR contacts for company: ${company}`);
    
    // Use our API route instead of calling the webhook directly
    const apiUrl = 'http://localhost:5678/webhook/1f50d8b8-820e-43b4-91a5-5cc31014fc8a';
    
    // Prepare the payload
    const payload = {
      webhookUrl: WEBHOOK_URL,
      type: 'hr_contact_search',
      company: company,
      timestamp: new Date().toISOString(),
    };
    
    console.log('Sending lookup request with payload:', payload);
    
    // Create the fetch request
    const fetchPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Race the fetch against a timeout
    const response = await Promise.race([
      fetchPromise,
      timeoutPromise(timeout)
    ]) as Response;
    
    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.statusText}`);
    }
    
    console.log('Webhook response received:', response.status);
    
    // Wait for the response from the webhook
    const responseData = await response.json();
    console.log('Webhook response data:', responseData);
    
    // Handle different response formats
    if (responseData.output) {
      // Single contact in output property
      const contact = responseData.output;
      return [contact];
    } else if (Array.isArray(responseData)) {
      // Array of contacts
      return responseData;
    } else if (responseData.data && Array.isArray(responseData.data)) {
      // Array in data property
      return responseData.data;
    } else if (responseData.body && typeof responseData.body === 'object') {
      // The data is in the body property (common in webhook test responses)
      console.log('Found data in body property:', responseData.body);
      
      // If the body contains the type and company, it might be the request object
      // In that case, we need to look for the actual data elsewhere
      if (responseData.body.type === 'hr_contact_search' && responseData.body.company) {
        console.log('Body appears to be the request object, looking for data elsewhere');
        
        // Check if there's any other property that might contain the data
        for (const key in responseData) {
          if (key !== 'body' && typeof responseData[key] === 'object' && responseData[key] !== null) {
            console.log(`Checking property ${key} for contact data`);
            const possibleData = responseData[key];
            
            // If it has properties that look like contact data
            if (possibleData.name || possibleData.email || possibleData.linkedin_url) {
              console.log(`Found potential contact data in ${key} property`);
              return [possibleData];
            }
          }
        }
        
        // If we couldn't find anything useful, return the whole response
        return [responseData];
      }
      
      return [responseData.body];
    } else if (responseData.executionMode === 'test' && responseData.body) {
      // This is a test execution with data in the body
      console.log('Received test execution with data in body');
      return [responseData.body];
    } else if (responseData.webhookUrl && responseData.body) {
      // Response includes webhookUrl and body with the actual data
      console.log('Received response with webhookUrl and body data');
      return [responseData.body];
    } else if (responseData.executionMode === 'test' || responseData.webhookUrl) {
      // This might be just an acknowledgment, check if there's any useful data
      console.log('Received response with executionMode or webhookUrl');
      
      // Try to find any data that looks like contact information
      for (const key in responseData) {
        if (typeof responseData[key] === 'object' && responseData[key] !== null) {
          console.log(`Checking property ${key} for contact data`);
          const possibleData = responseData[key];
          
          // If it has company or type properties, it might be our data
          if (possibleData.name || possibleData.email || possibleData.linkedin_url) {
            console.log(`Found potential contact data in ${key} property`);
            return [possibleData];
          }
        }
      }
      
      // If we couldn't find anything useful, return the whole response as a last resort
      console.log('No specific contact data found, returning whole response');
      return [responseData];
    } else {
      // Try to extract any contact-like object
      const possibleContact = responseData;
      if (possibleContact.name || possibleContact.email || possibleContact.linkedin_url) {
        return [possibleContact];
      }
      
      // No recognizable data format, but return the response anyway
      // This ensures we don't lose any data that might be useful
      console.log('No recognizable contact data in response, returning raw response');
      return [responseData];
    }
  } catch (error) {
    console.error('Error looking up HR contacts:', error);
    throw error;
  }
}; 