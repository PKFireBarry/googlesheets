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

  // Try multiple sources to get a sheet ID
  const sources = [
    // First try sheet URL from cookie (where homepage stores it)
    Cookies.get('lastSheetUrl'),
    // Then try localStorage for sheet URL
    localStorage.getItem('lastSheetUrl'),
    // Then try jobData which might contain sheet ID
    localStorage.getItem('jobData'),
    // Finally, look for savedJobs
    localStorage.getItem('savedJobs')
  ];
  
  for (const source of sources) {
    if (!source) continue;
    
    try {
      // Try to extract ID from a URL
      const urlMatch = source.match(/\/d\/([-\w]+)/);
      if (urlMatch && urlMatch[1]) {
        const sheetId = urlMatch[1];
        const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
        return `masterResume_${idHash}`;
      }
      
      // If not a URL, maybe it's JSON with other identifiers we can use
      const parsed = JSON.parse(source);
      
      // If we find a spreadsheetId property
      if (parsed.spreadsheetId) {
        const sheetId = parsed.spreadsheetId;
        const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
        return `masterResume_${idHash}`;
      }
      
      // For arrays of objects (like job listings)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].spreadsheetId) {
        const sheetId = parsed[0].spreadsheetId;
        const idHash = `${sheetId.slice(0, 4)}${sheetId.slice(-4)}`;
        return `masterResume_${idHash}`;
      }
    } catch (e) {
      // Ignore errors from JSON parsing attempts
      console.log('Not JSON or couldn\'t extract ID from source:', e);
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
    const storedResume = localStorage.getItem(storageKey);
    if (!storedResume) {
      return { resumeData: null, resumePdfData: null };
    }
    
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