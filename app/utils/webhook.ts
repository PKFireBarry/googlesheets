// Webhook utility functions

// Hardcoded webhook URL - use the same one across the application
export const WEBHOOK_URL = 'http://localhost:5678/webhook/1f50d8b8-820e-43b4-91a5-5cc31014fc8a';

// Default timeout for webhook requests (in milliseconds)
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Longer timeout for LinkedIn lookups (in milliseconds)
const LINKEDIN_LOOKUP_TIMEOUT = 180000; // 3 minutes

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
 * @param webhookUrl Optional custom webhook URL (overrides the default)
 * @returns Promise that resolves when the data is sent
 */
export const sendToWebhook = async (type: string, data: Record<string, unknown>, timeout = DEFAULT_TIMEOUT, webhookUrl = WEBHOOK_URL) => {
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
        webhookUrl: webhookUrl,
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
    } catch {
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
 * Interface for LinkedIn contact data
 */
interface LinkedInContactData {
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
 * Looks up HR contacts for a company using LinkedIn via CORS bypass and Gemini processing
 * @param company The company name to look up
 * @param apiKey Optional Gemini API key (will fall back to environment variable if not provided)
 * @param timeout Optional timeout in milliseconds (defaults to 3 minutes)
 * @returns Promise that resolves with the HR contacts
 */
export const lookupLinkedInHR = async (
  company: string, 
  apiKey?: string, 
  timeout = LINKEDIN_LOOKUP_TIMEOUT
): Promise<LinkedInContactData[]> => {
  try {
    console.log(`Looking up LinkedIn HR contacts for company: ${company}`);
    
    // Step 1: Call our LinkedIn API route to handle the CORS-bypassed scraping
    console.log('Calling LinkedIn API route for scraping');
    const linkedinPromise = fetch('/api/linkedin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        company,
        apiKey // Pass the API key to the LinkedIn API route
      })
    });
    
    // Race the fetch against a timeout
    const linkedinResponse = await Promise.race([
      linkedinPromise,
      timeoutPromise(timeout)
    ]) as Response;
    
    if (!linkedinResponse.ok) {
      throw new Error(`LinkedIn lookup failed: ${linkedinResponse.statusText}`);
    }
    
    // Get the raw result from the LinkedIn API
    const rawResult = await linkedinResponse.json();
    console.log('Raw LinkedIn search result received');
    
    if (!rawResult || rawResult.status !== 'completed') {
      throw new Error('LinkedIn search did not complete successfully');
    }
    
    // Step 2: Process the raw result with Gemini through our API route
    console.log('Calling Gemini API route for processing');
    
    // Use the provided API key or fall back to the environment variable
    const geminiApiKey = apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    
    const geminiResponse = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawData: rawResult,
        company,
        apiKey: geminiApiKey
      })
    });
    
    // Parse the response from the Gemini API
    const processedResult = await geminiResponse.json();
    
    // Check if there's an error in the response
    if (!geminiResponse.ok || processedResult.error) {
      console.error('Gemini processing failed:', processedResult);
      
      // Even if there's an error, if we have a fallback structure, use it
      if (processedResult.name && processedResult.company) {
        console.log('Using fallback contact data despite error');
        return [processedResult as LinkedInContactData];
      }
      
      // If it's a severe error with no usable data, throw an error
      throw new Error(processedResult.error || `Gemini processing failed: ${geminiResponse.statusText}`);
    }
    
    console.log('Processed data received from Gemini:', processedResult);
    
    // Step 3: Validate the processed data before returning
    // Ensure we have the minimum required fields
    if (!processedResult.name || processedResult.name === 'Error parsing response') {
      throw new Error('Failed to extract valid contact information');
    }
    
    // Create a standardized contact object to ensure consistent structure
    const contactData: LinkedInContactData = {
      name: processedResult.name || 'n/a',
      title: processedResult.title || 'n/a',
      email: processedResult.email || 'n/a',
      linkedinUrl: processedResult.linkedinUrl || 'n/a',
      website: processedResult.website || 'n/a',
      profileImage: processedResult.profileImage || 'n/a',
      company: company,
      phone: processedResult.phone || 'n/a',
      location: processedResult.location || 'n/a'
    };
    
    // Step 4: Return the processed result as an array for consistency with the existing API
    return [contactData];
  } catch (error) {
    console.error('Error in LinkedIn HR lookup:', error);
    throw error;
  }
};

/**
 * Looks up HR contacts for a company
 * @param company The company name to look up
 * @param timeout Optional timeout in milliseconds (defaults to 60 seconds)
 * @param webhookUrl Optional custom webhook URL (overrides the default)
 * @returns Promise that resolves with the HR contacts
 */
export const lookupHRContacts = async (company: string, timeout = 60000, webhookUrl = WEBHOOK_URL) => {
  try {
    console.log(`Looking up HR contacts for company: ${company}`);
    
    // Use our API route instead of calling the webhook directly
    const apiUrl = '/api/webhook';
    
    // Prepare the payload
    const payload = {
      webhookUrl: webhookUrl, // Use the provided webhook URL or default
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