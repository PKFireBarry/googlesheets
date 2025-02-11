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
    
    if (!spreadsheetId || rowIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });

    return NextResponse.json({ 
      success: true,
      status: result.status,
    });
  } catch (error: any) {
    console.error('Delete row error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: error.stack
      },
      { status: 500 }
    );
  }
} 