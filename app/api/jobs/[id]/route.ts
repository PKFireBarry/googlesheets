import { NextRequest, NextResponse } from 'next/server';
import { extractSpreadsheetId } from '../../../utils/dataHelpers';

// Get environment variables
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const GOOGLE_SHEET_URL = process.env.NEXT_PUBLIC_DEFAULT_SHEET_URL || "https://docs.google.com/spreadsheets/d/1dLV3n1XnbyxMaI71JqcWV-4OYnxa9sAl4kBRcST8rjE";

/**
 * GET handler for job details by ID
 * Fetches job details from Google Sheets based on job ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get job ID from params - ensure params is properly awaited
    const jobId = await params.id;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // Extract spreadsheet ID from environment variable
    const spreadsheetId = extractSpreadsheetId(GOOGLE_SHEET_URL);
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Invalid Google Sheets URL in environment configuration' },
        { status: 400 }
      );
    }
    
    // Construct the range for all sheets
    const sheets = [
      "Tech Jobs",
      "Business Operations Jobs",
      "Healthcare Jobs",
      "Customer and Social Services and Transportation and Logistics",
      "Sheet1"
    ];
    
    // Search for job in all sheets
    let jobData = null;
    
    // Normalize the job ID for comparison
    // Remove any index suffix (e.g., "_0" from "Senior_Fullstack_Engineer_Tabby_0")
    const normalizedJobId = jobId.replace(/_\d+$/, '');
    const dashJobId = normalizedJobId.replace(/_/g, '-');
    const underscoreJobId = normalizedJobId.replace(/-/g, '_');
    
    console.log(`Searching for job with normalized ID: ${normalizedJobId}`);
    console.log(`Also checking dash format: ${dashJobId}`);
    console.log(`Also checking underscore format: ${underscoreJobId}`);
    
    for (const sheet of sheets) {
      const range = `${sheet}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Error fetching data from sheet ${sheet}:`, await response.text());
        continue;
      }
      
      const result = await response.json();
      
      if (!result.values || result.values.length === 0) {
        continue;
      }
      
      const headers = result.values[0];
      const rows = result.values.slice(1);
      
      // Find title and company_name column indices
      const titleIndex = headers.findIndex((h: string) => h.toLowerCase() === 'title');
      const companyIndex = headers.findIndex((h: string) => h.toLowerCase() === 'company_name');
      
      if (titleIndex === -1 || companyIndex === -1) {
        continue;
      }
      
      // Search for job by ID
      const job = rows.find((row: any[]) => {
        if (!row[titleIndex] || !row[companyIndex]) return false;
        
        const title = row[titleIndex];
        const company = row[companyIndex];
        
        // Create different formats of job IDs for comparison
        const dashFormat = `${title}-${company}`.replace(/\s+/g, '-');
        const underscoreFormat = `${title}_${company}`.replace(/\s+/g, '_');
        
        // Normalize for comparison
        const normalizedDashFormat = dashFormat.toLowerCase();
        const normalizedUnderscoreFormat = underscoreFormat.toLowerCase();
        const normalizedSearchId = normalizedJobId.toLowerCase();
        const normalizedDashSearchId = dashJobId.toLowerCase();
        const normalizedUnderscoreSearchId = underscoreJobId.toLowerCase();
        
        // Check all possible formats
        return normalizedDashFormat === normalizedSearchId || 
               normalizedDashFormat === normalizedDashSearchId ||
               normalizedUnderscoreFormat === normalizedSearchId ||
               normalizedUnderscoreFormat === normalizedUnderscoreSearchId;
      });
      
      if (job) {
        // Convert row to object using headers
        jobData = headers.reduce((obj: any, header: string, index: number) => {
          obj[header.toLowerCase()] = job[index] || '';
          return obj;
        }, {});
        
        // Add job ID
        jobData.id = jobId;
        
        break;
      }
    }
    
    if (!jobData) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(jobData);
  } catch (error: any) {
    console.error('Error fetching job details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job details' },
      { status: 500 }
    );
  }
} 