import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY) {
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
    const { spreadsheetId, rowIndex, note, noteColumnIndex } = await request.json();

    if (!spreadsheetId || rowIndex === undefined || note === undefined || noteColumnIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!${String.fromCharCode(65 + noteColumnIndex)}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[note]]
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update note error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}