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
 * Generates a consistent storage key for the master resume
 * CRITICAL: This should ALWAYS return the same key regardless of job context
 * Job-specific data should NEVER be saved to storage - only the master resume
 */
export function getResumeStorageKey(): string {
  if (!isBrowser()) return 'masterResume_default';

  console.log('Getting master resume storage key...');
  
  // ALWAYS use the same master resume key - no job-specific keys!
  // The master resume is the source of truth that gets tailored temporarily
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