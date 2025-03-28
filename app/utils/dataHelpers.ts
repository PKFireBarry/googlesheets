/**
 * Helper utilities for handling job data across the application
 */

export interface RowData {
  data?: string[];
  originalIndex?: number;
  [key: number]: string | number | boolean | null | undefined;
}

/**
 * Gets a field value from job data based on field name and column headers
 */
export const getFieldValue = (
  row: RowData | string[] | undefined,
  fieldName: string,
  headers?: string[]
): string => {
  if (!row) return "";
  
  // If headers are provided, use them to find the column index
  if (headers) {
    const index = headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase()
    );
    
    if (index !== -1) {
      const rowData = Array.isArray(row) ? row : row.data;
      return rowData && rowData[index] ? rowData[index] : "";
    }
    
    return "";
  }
  
  // If no headers provided but row is an array, treat the row as data directly
  if (Array.isArray(row)) {
    // We can't reliably get the field without headers in this case
    console.warn("getFieldValue called with array but no headers");
    return "";
  }
  
  // For objects with direct property access
  if (typeof row === 'object') {
    // @ts-expect-error - dynamic property access
    return row[fieldName] || "";
  }
  
  return "";
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