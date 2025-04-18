"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CookieUtil from '../utils/cookies'
import { Linkedin, HelpCircle, ChevronDown } from 'lucide-react'
import { lookupLinkedInHR, LinkedInContactData } from '../utils/webhook'
import ApiKeyConfiguration from '../components/linkedin/ApiKeyConfiguration'
import CompanySelector from '../components/linkedin/CompanySelector'
import JobDetails from '../components/linkedin/JobDetails'
import LinkedInContacts from '../components/linkedin/LinkedInContacts'
import HowItWorksModal from '../components/linkedin/HowItWorksModal'
import ApiInfoModal from '../components/linkedin/ApiInfoModal'
import PageHeader from '../components/linkedin/PageHeader'
import ActionButton from '../components/ActionButton'

// Helper function to extract spreadsheet ID from URL
function extractSpreadsheetId(url: string): string | null {
  // Standard Google Sheets URL format
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Helper function to ensure URLs have the proper protocol prefix
const formatUrl = (url: string): string => {
  if (!url || url === 'n/a' || url === 'N/A') return '';
  
  // Remove any whitespace
  url = url.trim();
  
  // If the URL already has a protocol, return it as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // For LinkedIn URLs, handle various formats
  if (url.includes('linkedin.com')) {
    // Remove any leading slashes or www.
    url = url.replace(/^\/+/, '').replace(/^www\./, '');
    
    // Make sure it doesn't already start with linkedin.com and add https://www.
    if (!url.startsWith('linkedin.com')) {
      return `https://www.${url}`;
    } else {
    return `https://www.${url}`;
    }
  }
  
  // For other URLs, just add https://
  return `https://${url}`;
}

// This component uses the useSearchParams hook and is wrapped in Suspense
function LinkedInLookupContent() {
  const searchParams = useSearchParams()
  const companyParam = searchParams.get('company')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState(companyParam || '')
  const [customCompany, setCustomCompany] = useState('')
  const [useCustomCompany, setUseCustomCompany] = useState(false)
  const [searchResults, setSearchResults] = useState<LinkedInContactData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [autoSearchDone, setAutoSearchDone] = useState(false)
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false)
  
  // Add state variables for tracking the task status
  const [taskStatus, setTaskStatus] = useState<string>('idle')
  const [taskProgress, setTaskProgress] = useState<number>(0)
  const [taskElapsedTime, setTaskElapsedTime] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string>('')
  
  // State for API info modal
  const [showApiInfoModal, setShowApiInfoModal] = useState(false)
  
  const [selectedJob, setSelectedJob] = useState<Record<string, unknown> | null>(null)
  const [copiedMessageIds, setCopiedMessageIds] = useState<Record<string, boolean>>({})
  
  // State for editable messages
  const [editableMessages, setEditableMessages] = useState<Record<string, string>>({})
  const [isEditingMessage, setIsEditingMessage] = useState<Record<string, boolean>>({})
  
  // Add state for how it works modal
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false)
  
  useEffect(() => {
    // Load companies from cookie or search params on mount
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load Gemini API key from cookie if available
        const savedApiKey = CookieUtil.get("geminiApiKey")
        if (savedApiKey) {
          console.log('Found saved Gemini API key, loading...')
          setGeminiApiKey(savedApiKey)
          
          // Add debug log to verify the API key is being loaded correctly
          console.log(`API key loaded from cookie: ${savedApiKey.substring(0, 3)}...`)
        }
        
        // Check if we have a jobId in the URL - if so, try to load from localStorage first
        const jobId = searchParams.get("jobId")
        if (jobId) {
          console.log('JobID found in URL:', jobId)
          try {
            // Try to get job data from localStorage
            const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}')
            if (savedJobs[jobId]) {
              console.log('Found saved job data in localStorage:', savedJobs[jobId])
              setSelectedJob(savedJobs[jobId])
              
              // If we have a company name, set it as the selected company
              if (savedJobs[jobId].company_name) {
                setSelectedCompany(savedJobs[jobId].company_name)
              }
            } else {
              console.log('No saved job data found for jobId:', jobId)
            }
          } catch (error) {
            console.error('Error loading job data from localStorage:', error)
          }
        }
        
        // Load or extract company names
        const sheetUrl = CookieUtil.get("lastSheetUrl") || searchParams.get("sheetUrl")
        if (!sheetUrl) {
          console.log('No sheet URL found in cookies or search params')
          setLoading(false)
          return
        }
        
        console.log('Found sheet URL:', sheetUrl)
        
        // Try to extract companies using different approaches
        
        // Approach 1: Use sheetData cookie if available
        const sheetData = CookieUtil.get("sheetData")
        if (sheetData) {
          console.log('Found sheet data in cookies, length:', sheetData.length)
          
          // Parse the sheet data to extract companies
          try {
            const data = JSON.parse(sheetData)
            console.log('Successfully parsed sheet data, found', data.length, 'rows')
            
            // Extract company names
            const companyNames = extractCompanyNames(data)
            
            if (companyNames.length > 0) {
              console.log('Setting', companyNames.length, 'unique companies from sheet data cookie')
              setCompanies(companyNames)
              
              // Try to find matching job for selected company (if any)
              if (companyParam) {
                console.log('Selected company from URL:', companyParam);
                const jobInfo = extractJobInfo(companyParam, data);
                setSelectedJob(jobInfo);
              }
              
              setLoading(false)
              return
            } else {
              console.log('No companies found in sheet data cookie')
            }
          } catch (parseError) {
            console.error("Error parsing sheet data from cookie:", parseError)
            // Continue to Approach 2 if this fails
          }
        } else {
          console.log('No sheet data found in cookies')
        }
        
        // Approach 2: Try to fetch directly from the spreadsheet if we have a URL
        try {
          // Extract spreadsheet ID from the URL
          const id = extractSpreadsheetId(sheetUrl)
          if (!id) {
            console.error('Could not extract spreadsheet ID from URL:', sheetUrl)
            setLoading(false)
            return
          }
          
          console.log('Extracted spreadsheet ID:', id)
          
          // Try to fetch data directly from the Google Sheets API
          await fetchDataFromSheet(id)
        } catch (fetchError) {
          console.error("Error fetching directly from sheet:", fetchError)
          setError("Could not load company data. Please check your Google Sheet.")
        } finally {
          setLoading(false)
        }
      } catch (loadError) {
        console.error("Error in loadData:", loadError)
        setError(loadError instanceof Error ? loadError.message : "Failed to fetch companies")
        setLoading(false)
      }
    }
    
    loadData()
  }, [searchParams, companyParam])
  
  // Helper function to extract company names from data
  const extractCompanyNames = (data: Record<string, any>[]) => {
    // Extract unique company names from the data - handle multiple possible field names
    const companyNames = data.flatMap((row: Record<string, any>) => {
      // Try different possible company name fields
      let companyField = '';
      
      // Check common field names for company
      const possibleFields = ['company', 'company_name', 'companyname', 'Company', 'COMPANY', 'company name'];
      
      for (const field of possibleFields) {
        if (row[field] && typeof row[field] === 'string' && row[field].trim()) {
          companyField = row[field].trim();
          break;
        }
      }
      
      // If nothing found in common fields, try to infer from other fields
      if (!companyField) {
        // Sometimes company is indicated in other fields
        for (const key of Object.keys(row)) {
          if (
            key.toLowerCase().includes('company') || 
            key.toLowerCase().includes('employer') ||
            key.toLowerCase().includes('organization')
          ) {
            if (row[key] && typeof row[key] === 'string' && row[key].trim()) {
              companyField = row[key].trim();
              break;
            }
          }
        }
      }
      
      return companyField ? [companyField] : [];
    });
    
    // Deduplicate and sort
    return Array.from(new Set(
      companyNames.filter(Boolean).sort()
    )) as string[];
  }
  
  // Helper function to fetch and process the Google Sheet directly
  const fetchDataFromSheet = async (spreadsheetId: string) => {
    console.log('Fetching data directly from Google Sheet API...')
    
    try {
      // Try to fetch the spreadsheet metadata first to discover available sheets
      const API_KEY = process.env.NEXT_PUBLIC_API_KEY
      
      if (!API_KEY) {
        throw new Error("API key not found. Please set NEXT_PUBLIC_API_KEY in your environment variables.")
      }
      
      // First, get the metadata to see what sheets are available
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${API_KEY}`
      console.log('Fetching spreadsheet metadata:', metadataUrl)
      const metadataResponse = await fetch(metadataUrl)
      
      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json()
        throw new Error(errorData.error?.message || "Failed to fetch spreadsheet information")
      }
      
      const metadata = await metadataResponse.json()
      
      if (!metadata.sheets || metadata.sheets.length === 0) {
        throw new Error("No sheets found in this spreadsheet")
      }
      
      // Get the first sheet's title
      const firstSheetName = metadata.sheets[0].properties.title
      console.log(`Found first sheet name: "${firstSheetName}"`)
      
      // Now fetch the data from the discovered sheet
      const range = `${firstSheetName}!A:Z`
      const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`
      console.log('Fetching LinkedIn data from URL:', dataUrl)
      const response = await fetch(dataUrl)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Failed to fetch data from Google Sheet")
      }
      
      const result = await response.json()
      
      if (!result.values || result.values.length === 0) {
        throw new Error("No data found in sheet")
      }
      
      console.log('Successfully fetched data from sheet, found', result.values.length - 1, 'rows')
      
      // Process the data to extract companies
      const headers = result.values[0].map((header: string) => header.toLowerCase())
      const rows = result.values.slice(1)
      
      // Convert rows to objects with headers as keys
      const processedData = rows.map((row: any[]) => {
        const obj: Record<string, any> = {}
        headers.forEach((header: string, index: number) => {
          obj[header.toLowerCase()] = row[index]
        })
        return obj
      })
      
      // Extract company names
      const companyNames = extractCompanyNames(processedData)
      
      console.log('Extracted', companyNames.length, 'companies directly from sheet')
      
      if (companyNames.length > 0) {
        setCompanies(companyNames)
      } else {
        console.log('No companies found in direct sheet data')
        setError('No companies found in your Google Sheet. Make sure your sheet contains a column with company names.')
      }
    } catch (error) {
      console.error('Error fetching sheet data:', error)
      throw error
    }
  }
  
  // Debug search results when they change
  useEffect(() => {
    if (searchResults.length > 0) {
      console.log('Current search results:', searchResults);
    }
  }, [searchResults]);
  
  // Auto-trigger search when company is provided in URL
  useEffect(() => {
    // Only auto-search if:
    // 1. We have a company parameter (either from URL or selected from our company list)
    // 2. We're not already searching
    // 3. We haven't done an auto-search yet
    // 4. Either autoSearch=true parameter is present OR jobId is present
    // 5. Auto-search is explicitly enabled via URL parameter
    const companyToSearch = companyParam || selectedCompany;
    const shouldAutoSearch = 
      companyToSearch && 
      !isSearching && 
      !autoSearchDone && 
      autoSearchEnabled && // Only auto-search if explicitly enabled
      (searchParams.get('autoSearch') === 'true' || searchParams.get('jobId'));
    
    if (shouldAutoSearch) {
      console.log('Auto-triggering search for company:', companyToSearch);
      // Set a slight delay to allow the company to be set
      setTimeout(() => {
      handleSearch();
      setAutoSearchDone(true); // Mark auto-search as done
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyParam, selectedCompany, isSearching, autoSearchDone, searchParams, autoSearchEnabled]);
  
  // Check for autoSearch parameter in URL to enable/disable auto-search
  useEffect(() => {
    const autoSearchParam = searchParams.get('autoSearch');
    if (autoSearchParam === 'true') {
      setAutoSearchEnabled(true);
    }
  }, [searchParams]);
  
  const handleSaveSettings = () => {
    try {
      // Save Gemini API key if provided
      if (geminiApiKey) {
        // Use secure cookie storage with 30-day expiration
        CookieUtil.setSecure("geminiApiKey", geminiApiKey, 30);
        console.log('Saved Gemini API key to cookie:', geminiApiKey.substring(0, 3) + '...')
      }
      
      // Clear any previous errors
      setError(null)
      
      // Show success message
      setStatusMessage('Settings saved successfully')
      setTimeout(() => setStatusMessage(''), 3000)
      
      console.log('Settings saved:', {
        geminiApiKey: geminiApiKey ? '[API KEY SET]' : '[NOT SET]'
      })
    } catch (error) {
      // Invalid settings
      setError('Failed to save settings')
    }
  }
  
  const handleSearch = async () => {
    // Use either the selected company from dropdown or the custom company input
    let companyToSearch = useCustomCompany ? customCompany : selectedCompany
    
    // If we're using the custom input from the fallback section (when no companies)
    const customCompanyInput = document.getElementById('customCompanyFallback') as HTMLInputElement
    if (customCompanyInput && customCompanyInput.value) {
      companyToSearch = customCompanyInput.value
      // Update the state for consistency
      setCustomCompany(customCompanyInput.value)
      setUseCustomCompany(true)
    }
    
    // If no company is selected but we have a custom company input, use that instead
    if (!companyToSearch && customCompany) {
      companyToSearch = customCompany
      setUseCustomCompany(true)
    }
    
    if (!companyToSearch) {
      setError('Please select a company or enter a custom company name')
      return
    }
    
    // Check if we have any API key available
    if (!geminiApiKey) {
      const cookieApiKey = CookieUtil.get("geminiApiKey")
      if (cookieApiKey) {
        // Use the cookie value directly
        setGeminiApiKey(cookieApiKey)
        // Continue with the search using the cookie value
      } else if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        console.log('Using environment API key for search')
      } else {
        setError('Please configure the Gemini API key first')
        return
      }
    }
    
    console.log(`Starting search for company: ${companyToSearch}`)
    
    setIsSearching(true)
    setSearchResults([])
    setError(null) // Clear any previous errors
    
    // Reset task status tracking
    setTaskStatus('preparing')
    setTaskProgress(0)
    setTaskElapsedTime(0)
    setStatusMessage('Preparing search...')
    
    try {
      // Pass the full job data from selectedJob if available
      const jobInfo = selectedJob || extractJobInfo();
      
      try {
        // Define the status update callback
        const statusUpdateCallback = (update: { 
          status: string; 
          progress: number; 
          elapsedTime: number; 
          message?: string;
        }) => {
          setTaskStatus(update.status);
          setTaskProgress(update.progress);
          setTaskElapsedTime(update.elapsedTime);
          if (update.message) {
            setStatusMessage(update.message);
          }
        };
        
        // Use the cookie value if state is not set yet
        const apiKeyToUse = geminiApiKey || CookieUtil.get("geminiApiKey") || undefined
        
        // Use the direct LinkedIn lookup method with polling and status updates
        // Pass the job data as the third parameter
        const responseData = await lookupLinkedInHR(
          companyToSearch, 
          apiKeyToUse,
          jobInfo, // Pass job data to enhance personalization
          180000, // 3 minutes timeout
          statusUpdateCallback
        );
        
        // Check if we got valid results
        if (responseData && responseData.length > 0) {
          // If the API returned a suggested message, default to the AI template
          if (responseData[0].suggestedMessage) {
            // Initialize editable message with the suggested message
            setEditableMessages(prev => ({
              ...prev,
              [responseData[0].linkedinUrl || responseData[0].name]: responseData[0].suggestedMessage as string
            }));
          }
          
          setSearchResults(responseData);
        } else {
          throw new Error('No valid contacts found for this company');
        }
      } catch (lookupError: any) {
        console.error('LinkedIn lookup error:', lookupError);
        
        // Check if this is a timeout or network error
        if (lookupError.message && (
            lookupError.message.includes('timeout') || 
            lookupError.message.includes('Gateway Timeout') ||
            lookupError.message.includes('network') ||
            lookupError.message.includes('failed to fetch')
        )) {
          // This is likely a timeout issue on Vercel - show a more helpful message
          throw new Error(
            'The search is taking longer than expected. This might be due to server timeout limits. ' +
            'The search may still be running in the background. You can try refreshing the page in a few minutes to see results.'
          );
        }
        
        // For other errors, just rethrow
        throw lookupError;
      } finally {
        // Reset task status on completion or error
        setTaskStatus('done');
      }
    } catch (error) {
      console.error('Error searching for HR contacts:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsSearching(false)
    }
  }
  
  // Helper function to extract job information for message generation
  const extractJobInfo = (companyName: string | null = null, data: any[] | null = null) => {
    try {
      const targetCompany = companyName || selectedCompany;
      let parsedData = data;
      
      if (!parsedData) {
      const sheetData = CookieUtil.get("sheetData")
      if (!sheetData) {
          return null;
      }
      
        parsedData = JSON.parse(sheetData);
      }
      
      // For simplicity, we'll use the first job in the list that matches the company
      // In a more advanced implementation, you could add a job selector
      if (targetCompany && parsedData && Array.isArray(parsedData)) {
        const matchingJob = parsedData.find((job: Record<string, unknown>) => {
          const jobCompany = (job.company_name || job.company || '') as string;
          return jobCompany.toLowerCase().includes(targetCompany.toLowerCase());
        });
        
        return matchingJob || null;
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting job info:", error);
      return null;
    }
  }
  
  // Helper function to safely get string value from job object
  const getJobValue = (job: Record<string, unknown> | null, keys: string[]): string => {
    if (!job) return '';
    
    for (const key of keys) {
      if (job[key] !== undefined && job[key] !== null) {
        if (typeof job[key] === 'string') return job[key] as string;
        return String(job[key]);
      }
    }
    
    return '';
  }
  
  // Helper function to safely get skills array from job object
  const getSkillsArray = (job: Record<string, unknown> | null): string[] => {
    console.log("getSkillsArray called with job:", job);
    if (!job || !job.skills) {
      console.log("getSkillsArray: No job or no job.skills found.");
      return [];
    }

    const rawSkills: any = job.skills;
    console.log("getSkillsArray: Raw skills input:", rawSkills, "(Type:", typeof rawSkills, ")");
    let skillsList: string[] = [];

    // Function to remove surrounding quotes (single/double) and trim whitespace
    const cleanSkill = (s: string) => {
      if (!s) return '';
      return s.trim().replace(/^["']|["']$/g, '').trim();
    };

    // Function to process a string potentially containing multiple skills
    const processSkillString = (skillStr: string): string[] => {
      console.log("processSkillString processing:", skillStr);
      const trimmed = skillStr.trim();

      // Handle formats like "["Skill A" or "Skill B"]"
      if (trimmed.startsWith('["') && trimmed.endsWith('"]') && trimmed.includes('" or "')) {
        console.log("processSkillString: Using 'or' logic");
        const content = trimmed.substring(2, trimmed.length - 2);
        return content.split('" or "').map(cleanSkill).filter(Boolean);
      }

      // Handle formats like ['Skill A', 'Skill B'] or ["Skill A", "Skill B"]
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          console.log("processSkillString: Trying JSON parse");
          const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
          if (Array.isArray(parsed)) {
            console.log("processSkillString: JSON parse successful, got array:", parsed);
            return parsed.map(s => cleanSkill(String(s))).filter(Boolean);
          }
        } catch (e) {
          console.log("processSkillString: JSON parse failed, using bracket fallback");
          const content = trimmed.substring(1, trimmed.length - 1);
          return content.split(',').map(cleanSkill).filter(Boolean);
        }
      }

      // Default handler: Assume comma-separated values
      console.log("processSkillString: Using default comma split logic");
      const result = trimmed.split(',').map(cleanSkill).filter(Boolean);
      console.log("processSkillString: Default split result:", result);
      return result;
    };

    // Process rawSkills based on its type
    if (typeof rawSkills === 'string') {
      skillsList = processSkillString(rawSkills);
    } else if (Array.isArray(rawSkills)) {
      console.log("getSkillsArray: Input is an array, processing items...");
      skillsList = rawSkills.flat().flatMap(item => {
        if (typeof item === 'string') {
          return processSkillString(item);
        }
        const cleanedItem = cleanSkill(String(item));
        console.log(`getSkillsArray: Processed non-string array item '${item}' to '${cleanedItem}'`);
        return [cleanedItem];
      }).filter(Boolean);
    } else {
       console.log("getSkillsArray: Input skills is neither string nor array, returning empty.");
    }

    console.log("getSkillsArray: Intermediate skillsList before final filter:", skillsList);

    // Final cleanup: Filter out generic terms and ensure uniqueness
    const finalSkills = skillsList
      .filter(s => s && s.toLowerCase() !== 'skill' && s.toLowerCase() !== 'n/a');

    console.log("getSkillsArray: Returning final skills:", finalSkills);
    return Array.from(new Set(finalSkills));
  }
  
  // Generate outreach message based on job and contact details
  const generateOutreachMessage = (
    contact: LinkedInContactData, 
    job: Record<string, unknown> | null
  ) => {
    // We'll use the original referral template
    const contactName = contact.name !== 'n/a' ? contact.name.split(' ')[0] : 'Hiring Manager'
    const jobTitle = (job?.title || job?.job_title || 'the open position') as string
    const companyName = contact.company || selectedCompany || 'your company'
    
    let skills: string[] = []
    if (job?.skills) {
      if (typeof job.skills === 'string') {
        skills = job.skills.split(',').slice(0, 3)
      } else if (Array.isArray(job.skills)) {
        skills = job.skills.slice(0, 3).map(skill => String(skill))
      }
    }
    
    // Original job referral template
      return `Hello ${contactName},

I hope I'm reaching out to the right person. I'm interested in the ${jobTitle} position at ${companyName} and was wondering if you're involved in the hiring process.

I've carefully reviewed the job description and believe my background in ${skills.length > 0 ? skills.join(', ') : 'this field'} makes me a strong candidate.

Could you kindly let me know if you're the appropriate contact for this role or if you could refer me to the right person? I'd be grateful for any guidance you can provide.

Thank you for your assistance,`
  }
  
  // Handle copy message to clipboard
  const copyMessageToClipboard = (message: string, contactId: string) => {
    navigator.clipboard.writeText(message)
      .then(() => {
        setCopiedMessageIds(prev => ({ ...prev, [contactId]: true }))
        setTimeout(() => {
          setCopiedMessageIds(prev => ({ ...prev, [contactId]: false }))
        }, 2000)
      })
      .catch(err => {
        console.error('Failed to copy message: ', err)
      })
  }
  
  // When search results are loaded, try to find matching job info if not already set
  useEffect(() => {
    if (searchResults.length > 0 && !selectedJob) {
      const jobInfo = extractJobInfo();
      if (jobInfo) {
        setSelectedJob(jobInfo);
      }
    }
  }, [searchResults, selectedJob])
  
  // Handle editing a message
  const handleEditMessage = (contactId: string) => {
    // If not currently editing, prepare the editable message first
    if (!isEditingMessage[contactId]) {
      // Use the existing editable message or generate a new one
      const message = editableMessages[contactId] || 
                     generateOutreachMessage(
                       // Find the matching contact
                       searchResults.find(c => (c.linkedinUrl || c.name) === contactId) as LinkedInContactData, 
                       selectedJob
                     );
                     
      // Set the editable message
      setEditableMessages(prev => ({
        ...prev,
        [contactId]: message
      }));
    }
    
    // Toggle editing mode for this contact
    setIsEditingMessage(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  }
  
  // Handle saving edited message
  const handleSaveMessage = (contactId: string) => {
    setIsEditingMessage(prev => ({
      ...prev,
      [contactId]: false
    }))
  }
  
  // Handle message text change
  const handleMessageChange = (contactId: string, newMessage: string) => {
    setEditableMessages(prev => ({
      ...prev,
      [contactId]: newMessage
    }))
  }
  
  // Handle regenerating a message (reset to original)
  const handleRegenerateMessage = (contactId: string, contact: LinkedInContactData) => {
    // Generate a fresh message based on the contact and selected job
    const freshMessage = generateOutreachMessage(contact, selectedJob);
    
    // Update the editable message state
    setEditableMessages(prev => ({
      ...prev,
      [contactId]: freshMessage
    }));
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 no-overflow mobile-container">
      {/* API Key Information Modal */}
      {showApiInfoModal && (
        <ApiInfoModal onClose={() => setShowApiInfoModal(false)} />
      )}
      
      <PageHeader />
      
      {error && (
        <div className="mb-6 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          <div className="flex">
            <div className="py-1">
              <svg className="h-6 w-6 text-red-500 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* How To Use Section - Moved to top */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 mb-6 sm:mb-8">
        <ActionButton 
          onClick={() => setShowHowItWorksModal(true)}
          color="default"
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">How to Use LinkedIn Connection Finder</h2>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </ActionButton>
        
        <div className="mt-4 text-gray-600 dark:text-gray-400">
          <p>Click to learn how this tool works and what you can do with it.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* API Key Configuration - Only show if no API key is available */}
        {(!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) ? (
          <div className="lg:col-span-1">
            <ApiKeyConfiguration 
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              onSave={handleSaveSettings}
              onHelp={() => setShowApiInfoModal(true)}
            />
          </div>
        ) : null}
        
        {/* Company Selection */}
        {!selectedJob && (
          <div className={(!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <CompanySelector
              loading={loading}
              error={error}
              companies={companies}
              selectedCompany={selectedCompany}
              setSelectedCompany={setSelectedCompany}
              customCompany={customCompany}
              setCustomCompany={setCustomCompany}
              useCustomCompany={useCustomCompany}
              setUseCustomCompany={setUseCustomCompany}
              isSearching={isSearching}
              onSearch={handleSearch}
            />
          </div>
        )}
      </div>
      
      {/* Combined Job Details and LinkedIn Contacts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 sm:mb-8 border border-gray-100 dark:border-gray-700">
        {/* Job Details Section (within combined container) */}
        {selectedJob && (
          <JobDetails 
            job={selectedJob}
            getJobValue={getJobValue}
            getSkillsArray={getSkillsArray}
            isSearching={isSearching}
            onSearch={handleSearch}
          />
        )}
        
        {/* Search Results (within combined container) */}
        <LinkedInContacts
          geminiApiKey={geminiApiKey}
          selectedCompany={selectedCompany}
          isSearching={isSearching}
          taskStatus={taskStatus}
          taskProgress={taskProgress}
          taskElapsedTime={taskElapsedTime}
          statusMessage={statusMessage}
          searchResults={searchResults}
          selectedJob={selectedJob}
          error={error}
          editableMessages={editableMessages}
          isEditingMessage={isEditingMessage}
          copiedMessageIds={copiedMessageIds}
          formatUrl={formatUrl}
          onEditMessage={handleEditMessage}
          onSaveMessage={handleSaveMessage}
          onMessageChange={handleMessageChange}
          onRegenerateMessage={handleRegenerateMessage}
          onCopyMessage={copyMessageToClipboard}
          generateOutreachMessage={generateOutreachMessage}
          onSearch={handleSearch}
        />
      </div>
      
      {/* How To Use Modal - Full Screen Version */}
      {showHowItWorksModal && (
        <HowItWorksModal onClose={() => setShowHowItWorksModal(false)} />
      )}
    </div>
  )
}

// Main page component that wraps the content with Suspense
export default function LinkedInLookupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center p-8">
        <div className="text-center">
          <div className="inline-block relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 animate mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Linkedin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Loading LinkedIn Lookup</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we prepare your HR contact finder</p>
        </div>
      </div>
    }>
      <LinkedInLookupContent />
    </Suspense>
  )
}