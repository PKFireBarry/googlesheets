/**
 * Utility for shared resume storage across the application
 * Provides functions to save, load, and delete resumes from localStorage and cookies
 */

import { ResumeData } from '../types/resume';
import Cookies from 'js-cookie';

/**
 * Interface for stored resume data
 */
export interface StoredResume {
  type: 'parsed' | 'pdf';
  data: ResumeData | string; // ResumeData for parsed, base64 string for PDF
  timestamp: number;
}

// Helper function to check if we're in a browser environment
const isBrowser = () => typeof window !== 'undefined';

/**
 * Generates a consistent storage key based on the Google Sheet ID
 * This ensures that saved resumes are associated with the current sheet context
 */
export function getResumeStorageKey(): string {
  if (!isBrowser()) return 'masterResume_default';

  // Debug logging
  console.log('Getting resume storage key...');
  
  // Try to get the spreadsheet ID from the URL if we're on a specific page
  if (typeof window !== 'undefined') {
    const url = window.location.href;
    console.log('Current URL:', url);
    
    // Check if we're on the auto-apply page with a job ID
    if (url.includes('/auto-apply')) {
      // First try to get job ID from URL parameter
      const jobIdMatch = url.match(/jobId=([^&]+)/);
      if (jobIdMatch && jobIdMatch[1]) {
        const jobId = decodeURIComponent(jobIdMatch[1]);
        console.log('Found job ID in URL:', jobId);
        // Use a consistent key for this job
        return `masterResume_job_${jobId}`;
      }
      
      // If no job ID in URL, use a default key for auto-apply page
      console.log('No job ID found in URL, using default key for auto-apply');
      return 'masterResume_default';
    }
    
    // Check if we're on the resume-builder page with a job ID
    if (url.includes('/resume-builder')) {
      const jobIdMatch = url.match(/jobId=([^&]+)/);
      if (jobIdMatch && jobIdMatch[1]) {
        const jobId = decodeURIComponent(jobIdMatch[1]);
        console.log('Found job ID in URL:', jobId);
        // Use a consistent key for this job
        return `masterResume_job_${jobId}`;
      }
    }
  }

  // Try multiple sources to get a sheet ID
  const sources = [
    // First try sheet URL from cookie (where homepage stores it)
    Cookies.get('lastSheetUrl'),
    // Then try localStorage for sheet URL
    localStorage.getItem('lastSheetUrl'),
    // Try to get the industry from cookie
    Cookies.get('lastIndustry'),
    // Then try jobData which might contain sheet ID
    localStorage.getItem('jobData'),
    // Finally, look for savedJobs
    localStorage.getItem('savedJobs')
  ];
  
  console.log('Checking sources for sheet ID:', sources.map(s => s ? s.substring(0, 30) + '...' : 'null').join(', '));
  
  for (const source of sources) {
    if (!source) continue;
    
    try {
      // Try to extract ID from a URL
      const urlMatch = source.match(/\/d\/([-\w]+)/);
      if (urlMatch && urlMatch[1]) {
        const sheetId = urlMatch[1];
        const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
        console.log('Found sheet ID in URL:', sheetId, 'using hash:', idHash);
        return `masterResume_${idHash}`;
      }
      
      // Check if it's an industry name
      if (source === 'Tech Jobs' || 
          source === 'Business Operations Jobs' || 
          source === 'Healthcare Jobs' || 
          source === 'Customer and Social Services and Transportation and Logistics') {
        console.log('Found industry name:', source);
        return `masterResume_${source.replace(/\s+/g, '_')}`;
      }
      
      // If not a URL, maybe it's JSON with other identifiers we can use
      try {
        const parsed = JSON.parse(source);
        
        // If we find a spreadsheetId property
        if (parsed.spreadsheetId) {
          const sheetId = parsed.spreadsheetId;
          const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
          console.log('Found spreadsheetId in JSON:', sheetId, 'using hash:', idHash);
          return `masterResume_${idHash}`;
        }
        
        // For arrays of objects (like job listings)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].spreadsheetId) {
          const sheetId = parsed[0].spreadsheetId;
          const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
          console.log('Found spreadsheetId in JSON array:', sheetId, 'using hash:', idHash);
          return `masterResume_${idHash}`;
        }
      } catch {
        // Not valid JSON, continue to next source
      }
    } catch (e) {
      // Ignore errors from JSON parsing attempts
      console.log('Error processing source for resume storage key:', e);
    }
  }
  
  // Fallback - if we can't find a sheet ID, use a fixed key
  console.log('Using fallback storage key for resume');
  return 'masterResume_default';
}

/**
 * Saves a resume to localStorage
 * 
 * @param resumeData The parsed resume data (if available)
 * @param resumePdfData The PDF data as base64 string (if available)
 * @returns void
 */
export function saveResume(resumeData: ResumeData | null, resumePdfData: string | null): void {
  if (!isBrowser()) return;

  const storageKey = getResumeStorageKey();
  if (!storageKey) {
    console.error('Could not determine storage key for resume');
    return;
  }
  
  try {
    if (resumeData) {
      // Store parsed resume data
      const storedResume: StoredResume = {
        type: 'parsed',
        data: resumeData,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(storedResume));
      console.log('Stored parsed resume in localStorage');
    } else if (resumePdfData) {
      // Store PDF data
      const storedResume: StoredResume = {
        type: 'pdf',
        data: resumePdfData,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(storedResume));
      console.log('Stored PDF resume in localStorage');
    }
  } catch (e) {
    console.error('Error storing resume:', e);
  }
}

/**
 * Checks if a resume exists in localStorage
 * 
 * @returns boolean indicating if a valid resume exists
 */
export function resumeExists(): boolean {
  if (!isBrowser()) return false;

  const storageKey = getResumeStorageKey();
  if (!storageKey) return false;
  
  // Try to get stored resume
  const storedResume = localStorage.getItem(storageKey);
  if (!storedResume) return false;
  
  try {
    // Check if it's valid JSON for a stored resume
    const parsedResume: StoredResume = JSON.parse(storedResume);
    return !!(parsedResume.type === 'parsed' && parsedResume.data) || 
           !!(parsedResume.type === 'pdf' && parsedResume.data);
  } catch (e) {
    console.error('Error parsing stored resume:', e);
    return false;
  }
}

/**
 * Loads a resume from localStorage
 * 
 * @returns An object containing the parsed resume data and/or PDF data
 */
export function loadResume(): { resumeData: ResumeData | null, resumePdfData: string | null } {
  if (!isBrowser()) {
    return { resumeData: null, resumePdfData: null };
  }

  const storageKey = getResumeStorageKey();
  if (!storageKey) {
    console.error('Could not determine storage key for resume');
    return { resumeData: null, resumePdfData: null };
  }
  
  try {
    // Try with the determined storage key first
    const storedResume = localStorage.getItem(storageKey);
    
    if (storedResume) {
      console.log(`Found resume data with key: ${storageKey}`);
      const parsedResume: StoredResume = JSON.parse(storedResume);
      
      if (parsedResume.type === 'parsed') {
        return { 
          resumeData: parsedResume.data as ResumeData, 
          resumePdfData: null 
        };
      } else if (parsedResume.type === 'pdf') {
        return { 
          resumeData: null, 
          resumePdfData: parsedResume.data as string 
        };
      }
    } else {
      console.log(`No resume found with key: ${storageKey}, trying fallback keys`);
      
      // If not found with the primary key, try fallback keys
      const fallbackKeys = [
        'masterResume_default',
        'masterResume'
      ];
      
      // Also try to find any keys that start with masterResume_
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('masterResume_') && !fallbackKeys.includes(key) && key !== storageKey) {
          fallbackKeys.push(key);
        }
      }
      
      console.log('Checking fallback keys:', fallbackKeys);
      
      // Try each fallback key
      for (const fallbackKey of fallbackKeys) {
        const fallbackResume = localStorage.getItem(fallbackKey);
        if (fallbackResume) {
          console.log(`Found resume with fallback key: ${fallbackKey}`);
          try {
            const parsedFallback: StoredResume = JSON.parse(fallbackResume);
            
            if (parsedFallback.type === 'parsed') {
              // Copy to the current key for future consistency
              localStorage.setItem(storageKey, fallbackResume);
              console.log(`Copied resume from ${fallbackKey} to ${storageKey} for consistency`);
              
              return { 
                resumeData: parsedFallback.data as ResumeData, 
                resumePdfData: null 
              };
            } else if (parsedFallback.type === 'pdf') {
              // Copy to the current key for future consistency
              localStorage.setItem(storageKey, fallbackResume);
              console.log(`Copied resume from ${fallbackKey} to ${storageKey} for consistency`);
              
              return { 
                resumeData: null, 
                resumePdfData: parsedFallback.data as string 
              };
            }
          } catch (e) {
            console.error(`Error parsing fallback resume from ${fallbackKey}:`, e);
          }
        }
      }
    }
    
    return { resumeData: null, resumePdfData: null };
  } catch (e) {
    console.error('Error loading stored resume:', e);
    return { resumeData: null, resumePdfData: null };
  }
}

/**
 * Deletes a stored resume from localStorage
 * 
 * @returns boolean indicating success
 */
export function deleteResume(): boolean {
  if (!isBrowser()) return false;

  const storageKey = getResumeStorageKey();
  if (!storageKey) {
    console.error('Could not determine storage key for resume');
    return false;
  }
  
  try {
    localStorage.removeItem(storageKey);
    console.log('Deleted resume from localStorage');
    return true;
  } catch (e) {
    console.error('Error deleting resume:', e);
    return false;
  }
} 