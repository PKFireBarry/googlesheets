/**
 * Helper utilities for handling job data across the application
 */

import { RowData, RowDataObject, SalaryType } from '../types/data';

/**
 * Validates and formats an image URL
 */
export const validateImageUrl = (url: string): string => {
  if (!url) return "";
  
  try {
    // Remove any whitespace
    url = url.trim();
    
    // If it's a data URL, return as is
    if (url.startsWith('data:')) return url;
    
    // If it's a relative URL starting with /, assume it's from the same domain
    if (url.startsWith('/')) return url;

    // Handle problematic domains that block hotlinking
    const problematicDomains = [
      'glassdoor.com',
      'media.glassdoor.com',
      // Add other problematic domains here
    ];

    // Check if URL is from a problematic domain
    if (problematicDomains.some(domain => url.includes(domain))) {
      // For Glassdoor specifically, try to get company name from URL
      if (url.includes('glassdoor.com')) {
        const companyName = url.split('/').pop()?.split('-')[0] || '';
        if (companyName) {
          // Use Clearbit as a fallback for company logos
          return `https://logo.clearbit.com/${companyName}.com`;
        }
      }
      return ""; // Return empty if we can't get a fallback
    }
    
    // If it doesn't start with http(s), add https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Try to construct a URL to validate it
    new URL(url);
    
    return url;
  } catch {
    console.warn(`Invalid image URL: ${url}`);
    return "";
  }
};

/**
 * Gets a field value from job data based on field name and column headers
 * Handles both array and object data structures
 */
export const getFieldValue = (
  row: RowData | string[] | undefined,
  fieldName: string,
  headers?: string[]
): string => {
  if (!row) return "";
  
  let value = "";
  
  // If headers are provided, use them to find the column index
  if (headers) {
    const index = headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase()
    );
    
    if (index !== -1) {
      const rowData = Array.isArray(row) ? row : row.data;
      value = rowData && rowData[index] ? rowData[index] : "";
    }
  }
  // If row is an array but no headers provided
  else if (Array.isArray(row)) {
    console.warn("getFieldValue called with array but no headers");
  }
  // For objects with direct property access
  else if (typeof row === 'object') {
    // Try both camelCase and snake_case versions of the field name
    const camelCase = fieldName.replace(/_([a-z])/g, g => g[1].toUpperCase());
    const snakeCase = fieldName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    // @ts-expect-error - dynamic property access
    value = row[fieldName] || row[camelCase] || row[snakeCase] || "";
  }
  
  // For image URLs, validate and format them
  if (fieldName === 'company_image' && value) {
    return validateImageUrl(value);
  }
  
  return value;
};

/**
 * Validates a job listing has required fields
 */
export const validateJobListing = (row: string[], headers: string[]): boolean => {
  return Boolean(
    getFieldValue(row, "title", headers)?.trim() &&
    getFieldValue(row, "company_name", headers)?.trim()
  );
};

/**
 * Generates a unique job ID based on title and company name
 */
export const generateJobId = (row: RowData | string[], index: number, headers?: string[]): string => {
  const title = getFieldValue(row, "title", headers);
  const company = getFieldValue(row, "company_name", headers);
  
  // If we have title and company, use them
  if (title && company) {
    // Create a composite ID that includes title and company
    return `${title.trim()}_${company.trim()}_${index}`.replace(/\s+/g, '_');
  }
  
  // Fallback to using row index
  return `job_${index}`;
};

/**
 * Extracts spreadsheet ID from a Google Sheets URL
 */
export const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

/**
 * Extracts source website name from a URL
 */
export const extractSourceFromUrl = (url: string): string => {
  if (!url) return 'Unknown';
  
  try {
    let domain = url.replace(/^(https?:\/\/)?(www\.)?/i, '');
    domain = domain.split('/')[0];
    
    if (domain.includes('linkedin')) return 'LinkedIn';
    if (domain.includes('indeed')) return 'Indeed';
    if (domain.includes('ziprecruiter')) return 'ZipRecruiter';
    if (domain.includes('monster')) return 'Monster';
    if (domain.includes('glassdoor')) return 'Glassdoor';
    if (domain.includes('dice')) return 'Dice';
    if (domain.includes('simplyhired')) return 'SimplyHired';
    if (domain.includes('careerbuilder')) return 'CareerBuilder';
    
    return domain;
  } catch {
    return 'Unknown';
  }
};

/**
 * Formats a date string safely
 */
export const formatDateSafely = (dateString: string | undefined): string => {
  if (!dateString) return "Unknown";
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Helper function to get row data safely
export const getRowData = (row: RowData): string[] => {
  if (Array.isArray(row)) {
    return row;
  }
  const rowObj = row as RowDataObject;
  return rowObj.data ?? [];
};

// Helper function to get row index safely
export const getRowIndex = (row: RowData, index: number): number => {
  if (Array.isArray(row)) {
    return index + 2;
  }
  const rowObj = row as RowDataObject;
  return rowObj.originalIndex ?? (index + 2);
};

// Helper function to check if a job is applied
export const isJobApplied = (jobId: string, title: string, company: string, appliedJobs: string[]): boolean => {
  return appliedJobs.includes(jobId) || 
         appliedJobs.includes(title) || 
         appliedJobs.some(id => company ? id.startsWith(`${title}-${company}`) : id === title);
};

// Helper function to parse salary
export const parseSalary = (salary: string, type: SalaryType): number => {
  const match = salary.match(/\d+/);
  const value = match ? parseInt(match[0], 10) : 0;
  return type === 'hourly' ? value * 2080 : value;
}; 