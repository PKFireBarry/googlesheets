import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Debug: Log environment variables (redacted for security)
    console.log('Environment check:', {
      hasEmail: !!process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL,
      hasKey: !!process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY,
      emailPreview: process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL?.substring(0, 5) + '...',
    });

    // Verify credentials exist
    if (!process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY) {
      console.error('Missing credentials:', {
        email: !process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'missing' : 'present',
        key: !process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY ? 'missing' : 'present'
      });
      return NextResponse.json(
        { error: 'Missing Google service account credentials' },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const { spreadsheetId, rowIndex } = await request.json();
    
    console.log('Delete request received for:', {
      spreadsheetId: spreadsheetId ? `${spreadsheetId.substring(0, 5)}...` : 'missing',
      rowIndex
    });
    
    if (!spreadsheetId || rowIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Google Sheets API uses 0-based indexing for startIndex and endIndex
    // But the rowIndex we receive is already the actual row number in the sheet (1-based)
    const startIndex = rowIndex - 1;
    const endIndex = rowIndex;
    
    console.log('Attempting to delete row:', {
      sheetId: 0,
      startIndex: startIndex,
      endIndex: endIndex
    });

    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: startIndex,
              endIndex: endIndex
            }
          }
        }]
      }
    });

    console.log('Delete operation result:', {
      status: result.status,
      statusText: result.statusText
    });

    return NextResponse.json({ 
      success: true,
      status: result.status,
    });
  } catch (error: unknown) {
    console.error('Delete row error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorStack
      },
      { status: 500 }
    );
  }
}