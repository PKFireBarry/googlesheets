import { NextRequest, NextResponse } from 'next/server';
import { ensureProperProtocol } from '../../utils/webhook';

// Default webhook URL - can be overridden in the request
const DEFAULT_WEBHOOK_URL = 'http://localhost:5678/webhook/1f50d8b8-820e-43b4-91a5-5cc31014fc8a';

/**
 * POST handler for webhook proxy
 * This avoids CORS issues by proxying requests through the Next.js server
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Get the webhook URL from the request or use the default
    const webhookUrl = body.webhookUrl 
      ? ensureProperProtocol(body.webhookUrl) 
      : DEFAULT_WEBHOOK_URL;
    
    // Remove the webhookUrl from the payload before forwarding
    const { webhookUrl: _, ...payload } = body;
    
    console.log(`Proxying webhook request to: ${webhookUrl}`);
    console.log('Payload:', payload);
    
    // Configure fetch options with SSL handling for localhost
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };
    
    // For localhost with HTTPS, we need to ignore SSL certificate issues
    if (webhookUrl.startsWith('https://localhost')) {
      console.log('Using localhost with HTTPS - SSL verification will be relaxed');
      // Note: In Node.js environment, we would add rejectUnauthorized: false
      // But in Next.js API routes, we rely on the platform's handling
    }
    
    // Forward the request to the actual webhook
    const response = await fetch(webhookUrl, fetchOptions);
    
    // Check if the response is OK
    if (!response.ok) {
      console.error(`Webhook request failed: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Webhook request failed: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Try to parse the response as JSON
    try {
      const responseData = await response.json();
      console.log('Webhook response:', responseData);
      
      // If this is a test execution or contains a webhookUrl, it might be just an acknowledgment
      // In this case, we need to check if it contains the actual data we need
      if ((responseData.executionMode === 'test' || responseData.webhookUrl) && 
          responseData.body && typeof responseData.body === 'object') {
        console.log('Found data in body property of test execution');
        
        // Return the response data with additional context
        return NextResponse.json({
          ...responseData,
          _proxyNote: 'Data extracted from webhook test execution'
        });
      }
      
      return NextResponse.json(responseData);
    } catch (e) {
      // If we can't parse the response as JSON, return a success message
      console.log('Webhook request successful (no JSON response)');
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Error proxying webhook request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 