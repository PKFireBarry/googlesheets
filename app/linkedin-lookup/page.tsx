"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CookieUtil from '../utils/cookies'
import { Loader2, Search, Linkedin, Globe, Settings, ArrowRight, Plus, Key, ExternalLink, HelpCircle, X, Copy, Check, MessageSquare, ChevronDown, Sparkles, Briefcase, Building, MapPin, DollarSign, Clock, RefreshCw } from 'lucide-react'
import { lookupLinkedInHR, LinkedInContactData } from '../utils/webhook'

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
  const [autoSearchDone, setAutoSearchDone] = useState(false) // Track if auto-search has been done
  const [geminiApiKey, setGeminiApiKey] = useState('')
  
  // Add state variables for tracking the task status
  const [taskStatus, setTaskStatus] = useState<string>('idle')
  const [taskProgress, setTaskProgress] = useState<number>(0)
  const [taskElapsedTime, setTaskElapsedTime] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string>('')
  
  // State for API info modal
  const [showApiInfoModal, setShowApiInfoModal] = useState(false)
  
  const [selectedJob, setSelectedJob] = useState<Record<string, unknown> | null>(null)
  const [copiedMessageIds, setCopiedMessageIds] = useState<Record<string, boolean>>({})
  
  // We only need the referral template
  const [messageTemplate] = useState('referral')
  
  // State for editable messages
  const [editableMessages, setEditableMessages] = useState<Record<string, string>>({})
  const [isEditingMessage, setIsEditingMessage] = useState<Record<string, boolean>>({})
  
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
      // We'll use the RANGE and API_KEY from environment variables if available
      const RANGE = process.env.NEXT_PUBLIC_RANGE || 'Sheet1!A:Z'
      const API_KEY = process.env.NEXT_PUBLIC_API_KEY
      
      if (!API_KEY) {
        throw new Error("API key not found. Please set NEXT_PUBLIC_API_KEY in your environment variables.")
      }
      
      // Call the Google Sheets API
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${RANGE}?key=${API_KEY}`
      const response = await fetch(url)
      
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
    const companyToSearch = companyParam || selectedCompany;
    const shouldAutoSearch = 
      companyToSearch && 
      !isSearching && 
      !autoSearchDone && 
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
  }, [companyParam, selectedCompany, isSearching, autoSearchDone, searchParams]);
  
  const handleSaveSettings = () => {
    try {
      // Save Gemini API key if provided
      if (geminiApiKey) {
        // Use secure cookie storage with 30-day expiration
        CookieUtil.setSecure("geminiApiKey", geminiApiKey, 30);
      }
      
      // Clear any previous errors
      setError(null)
      
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
    
    // For LinkedIn direct method, we need a Gemini API key
    if (!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError('Please configure the Gemini API key first')
      return
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
      console.log(`Starting search for company: ${companyToSearch}`);
      
      // Pass the full job data from selectedJob if available
      const jobInfo = selectedJob || extractJobInfo();
      console.log('Job data for lookup:', jobInfo);
      
      try {
        // Define the status update callback
        const statusUpdateCallback = (update: { 
          status: string; 
          progress: number; 
          elapsedTime: number; 
          message?: string;
        }) => {
          console.log('Status update:', update);
          setTaskStatus(update.status);
          setTaskProgress(update.progress);
          setTaskElapsedTime(update.elapsedTime);
          if (update.message) {
            setStatusMessage(update.message);
          }
        };
        
        // Use the direct LinkedIn lookup method with polling and status updates
        // Pass the job data as the third parameter
        const responseData = await lookupLinkedInHR(
          companyToSearch, 
          geminiApiKey,
          jobInfo, // Pass job data to enhance personalization
          180000, // 3 minutes timeout
          statusUpdateCallback
        );
        console.log('LinkedIn search completed, response data:', responseData);
        
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
    if (!job || !job.skills) return [];
    
    if (typeof job.skills === 'string') {
      return job.skills.split(',').map(s => s.trim());
    }
    
    if (Array.isArray(job.skills)) {
      return job.skills.map(s => String(s).trim());
    }
    
    return [];
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
    <div className="max-w-6xl mx-auto">
      {/* API Key Information Modal */}
      {showApiInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Key className="w-6 h-6 mr-2 text-blue-600" />
                  Getting Your Free Gemini API Key
                </h2>
                <button 
                  onClick={() => setShowApiInfoModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Why Use Your Own API Key?</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                    <li>It's completely <span className="font-medium">FREE</span> to get and use</li>
                    <li>Unlimited LinkedIn searches with no additional cost</li>
                    <li>Faster results without relying on our shared API resources</li>
                    <li>More reliable service without quota limitations</li>
                    <li>Better privacy as all AI processing happens with your own key</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">How to Get Your API Key:</h3>
                  <ol className="list-decimal pl-5 space-y-3 text-gray-700 dark:text-gray-300">
                    <li>
                      <p>Visit the Google AI Studio API Key page:</p>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline inline-flex items-center mt-1"
                      >
                        https://aistudio.google.com/app/apikey
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </li>
                    <li>Sign in with your Google Account (or create one if needed)</li>
                    <li>Click on "Create API Key" button</li>
                    <li>Give your key a name (e.g., "LinkedIn Lookup")</li>
                    <li>Copy the generated API key</li>
                    <li>Paste it in the API Key field on this page</li>
                    <li>Click "Save Configuration" to securely store your key</li>
                  </ol>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 rounded-md">
                  <h3 className="text-md font-medium text-blue-800 dark:text-blue-300 mb-1">Your API Key is Stored Securely</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Your API key is stored only in your browser's cookies with secure settings.
                    We never store your API key on our servers or share it with third parties.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowApiInfoModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">LinkedIn HR Lookup</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find HR personnel and recruiters at companies to help with your job applications
        </p>
      </div>
      
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          {/* API Key Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center mb-4">
              <Settings className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">LinkedIn Lookup Configuration</h2>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gemini API Key
                </label>
                <button
                  onClick={() => setShowApiInfoModal(true)}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center text-xs"
                >
                  <HelpCircle className="w-3 h-3 mr-1" />
                  How to get an API key
                </button>
              </div>
              <div className="relative">
                <input
                  id="gemini-api-key"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Google Gemini API key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <Key className="h-4 w-4 text-gray-500" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get a <span className="font-medium">FREE</span> API key from{" "}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Google AI Studio
                  </a>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Using your own API key allows unlimited searches at no cost to you.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Save Configuration
              </button>
            </div>
          </div>
          
          {/* Display Selected Job Details if available */}
          
          {/* Company Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Globe className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Selection</h2>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
                <p>{error}</p>
                {!CookieUtil.get("lastSheetUrl") && (
                  <p className="mt-2 text-sm">Please load a Google Sheet on the home page first.</p>
                )}
              </div>
            ) : companies.length === 0 ? (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-md">
                <p>No companies found</p>
                <p className="mt-2 text-sm">Please load a Google Sheet with company data on the home page or use the custom company input below.</p>
                
                {/* Add custom company input when no companies are found */}
                <div className="mt-4">
                  <label htmlFor="customCompany" className="block text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    Custom Company:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="customCompanyFallback"
                      value={customCompany}
                      onChange={(e) => setCustomCompany(e.target.value)}
                      placeholder="Enter company name"
                      className="flex-1 px-3 py-2 border border-yellow-400 bg-white dark:bg-yellow-900/20 rounded-md shadow-sm text-yellow-800 dark:text-yellow-200"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!customCompany || isSearching}
                      className={`px-4 py-2 rounded-md font-medium flex items-center ${
                        !customCompany || isSearching
                          ? 'bg-yellow-300/50 cursor-not-allowed text-yellow-700/50'
                          : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      }`}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">LinkedIn Lookup</h2>
                  
                  <div className="space-y-4">
                    {/* Company Selection */}
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company
                      </label>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          {useCustomCompany ? (
                            <input
                              type="text"
                              id="customCompany"
                              value={customCompany}
                              onChange={(e) => setCustomCompany(e.target.value)}
                              placeholder="Enter company name"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                            />
                          ) : (
                            <select
                              id="company"
                              value={selectedCompany}
                              onChange={(e) => setSelectedCompany(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                            >
                              <option value="">Select a company</option>
                              {companies.map((company) => (
                                <option key={company} value={company}>
                                  {company}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setUseCustomCompany(!useCustomCompany)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          {useCustomCompany ? "Use List" : "Custom"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSearch}
                  disabled={!selectedCompany || isSearching}
                  className={`w-full px-4 py-2 rounded-md font-medium flex items-center justify-center ${
                    !selectedCompany || isSearching
                      ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find HR Contacts
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="md:col-span-2">
          {/* Job Details Section */}
          {selectedJob && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Selected Job Details
                </h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-5">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      {selectedJob.company_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={typeof selectedJob.company_image === 'string' ? selectedJob.company_image : ''} 
                          alt={`${getJobValue(selectedJob, ['company_name', 'company'])} logo`}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                      )}
                    </div>
                    
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {getJobValue(selectedJob, ['title', 'job_title'])}
                      </h2>
                      <div className="flex items-center text-gray-600 dark:text-gray-300">
                        <Building className="w-4 h-4 mr-1.5 flex-shrink-0" />
                        <span className="font-medium">{getJobValue(selectedJob, ['company_name', 'company'])}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {getJobValue(selectedJob, ['location']) && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                      <span>{getJobValue(selectedJob, ['location'])}</span>
                    </div>
                  )}
                  
                  {getJobValue(selectedJob, ['salary']) && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <DollarSign className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                      <span>{getJobValue(selectedJob, ['salary'])}</span>
                    </div>
                  )}
                  
                  {getJobValue(selectedJob, ['experience']) && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Briefcase className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                      <span>{getJobValue(selectedJob, ['experience'])}</span>
                    </div>
                  )}
                  
                  {getJobValue(selectedJob, ['job_type', 'type']) && (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                      <span>{getJobValue(selectedJob, ['job_type', 'type'])}</span>
                    </div>
                  )}
                </div>
                
                {getSkillsArray(selectedJob).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required Skills:</h4>
                    <div className="flex flex-wrap gap-2">
                      {getSkillsArray(selectedJob).map((skill, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 text-xs rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {getJobValue(selectedJob, ['description']) && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description:</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-line">
                      {getJobValue(selectedJob, ['description'])}
                    </div>
                    <button
                      className="text-blue-600 dark:text-blue-400 text-xs mt-2 hover:underline"
                      onClick={() => alert(getJobValue(selectedJob, ['description']))}
                    >
                      View Full Description
                    </button>
                  </div>
                )}
                
                <div className="mt-4 flex justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-md flex-1">
                    <p className="font-medium mb-1">Looking for HR contacts at {getJobValue(selectedJob, ['company_name', 'company'])}</p>
                    <p>Click the search button below to find HR personnel for this company.</p>
                  </div>
                  
                  {getJobValue(selectedJob, ['url']) && (
                    <a
                      href={getJobValue(selectedJob, ['url'])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 self-center flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      View Job
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Search Results */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <Linkedin className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">LinkedIn HR Contacts</h2>
            </div>
            
            {/* Display based on search state */}
            {!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY ? (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-md">
                <p className="font-medium">Gemini API Key not configured</p>
                <p className="mt-2 text-sm">Please enter and save your Google Gemini API key to enable LinkedIn lookups.</p>
                <div className="mt-3">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Get a free API key from Google AI Studio
                  </a>
                </div>
              </div>
            ) : isSearching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-700 dark:text-gray-300">Searching for HR contacts at {selectedCompany}...</p>
                
                {/* Show current task status */}
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  {statusMessage || 'Initializing search...'}
                </p>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {taskElapsedTime > 0 ? `${taskElapsedTime} seconds elapsed` : 'This may take 2-3 minutes to complete'}
                </p>
                
                {/* Progress bar */}
                <div className="mt-4 w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                    style={{ width: `${Math.min(taskProgress, 100)}%` }}
                  ></div>
                </div>
                
                {/* Show additional status info based on current stage */}
                {taskStatus === 'polling' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Checking if browser automation is complete...
                  </p>
                )}
                
                {taskStatus === 'processing' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Browser automation complete! Processing data with AI...
                  </p>
                )}
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
                <p className="font-medium">Lookup unsuccessful</p>
                <p className="mt-2 text-sm">{error}</p>
                {error.includes('timeout') && (
                  <div className="mt-4">
                    <p className="font-medium">What happened?</p>
                    <p className="text-sm mt-1">
                      The search is still running, but our server timed out waiting for a response.
                      This happens because free Vercel hosting has a 10-second timeout limit.
                    </p>
                    <p className="text-sm mt-1">
                      Your search might complete in the background. You can try again in a few minutes.
                    </p>
                  </div>
                )}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((contact, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        {contact.profileImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={contact.profileImage} 
                            alt={`${contact.name} profile`}
                            className="w-12 h-12 rounded-full mr-3 object-cover"
                            onError={(e) => {
                              // Handle image load errors by hiding the image
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{contact.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{contact.title}</p>
                          {contact.location && (
                            <p className="text-sm text-gray-500 dark:text-gray-500">{contact.location}</p>
                          )}
                        </div>
                      </div>
                      {contact.linkedinUrl && (
                        <a 
                          href={formatUrl(contact.linkedinUrl)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 dark:text-blue-400 text-sm hover:underline"
                        >
                          View Profile
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                    
                    {contact.email && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Email: </span>
                        <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    
                    {contact.linkedinUrl && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">LinkedIn: </span>
                        <a 
                          href={formatUrl(contact.linkedinUrl)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {contact.linkedinUrl}
                        </a>
                      </div>
                    )}
                    
                    {contact.phone && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Phone: </span>
                        <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    
                    {contact.website && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Website: </span>
                        <a href={formatUrl(contact.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                          {contact.website}
                        </a>
                      </div>
                    )}
                    
                    {contact.birthday && typeof contact.birthday === 'string' && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Birthday: </span>
                        <span className="text-gray-600 dark:text-gray-400">{String(contact.birthday)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Actions</h3>
                      <div className="flex flex-wrap gap-2">
                        {contact.linkedinUrl && contact.linkedinUrl !== 'n/a' && (
                          <a 
                            href={formatUrl(contact.linkedinUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                          >
                            <Linkedin className="w-3.5 h-3.5 mr-1.5" />
                            View Profile
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* LinkedIn Outreach Message Generator */}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Job Referral Message</h3>
                        
                        <div className="flex items-center gap-2">
                          {/* Edit/Save Button */}
                          <button
                            onClick={() => handleEditMessage(contact.linkedinUrl || contact.name)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                          >
                            {isEditingMessage[contact.linkedinUrl || contact.name] ? (
                              <>Save</>
                            ) : (
                              <>Edit Message</>
                            )}
                          </button>
                          
                          {/* Copy Button */}
                          <button
                            onClick={() => copyMessageToClipboard(
                              editableMessages[contact.linkedinUrl || contact.name] || generateOutreachMessage(
                                contact, 
                                selectedJob
                              ),
                              contact.linkedinUrl || contact.name
                            )}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                          >
                            {copiedMessageIds[contact.linkedinUrl || contact.name] ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                Copy Message
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {isEditingMessage[contact.linkedinUrl || contact.name] ? (
                        <div className="mt-3">
                          <textarea
                            value={editableMessages[contact.linkedinUrl || contact.name] || generateOutreachMessage(
                              contact, 
                              selectedJob
                            )}
                            onChange={(e) => handleMessageChange(contact.linkedinUrl || contact.name, e.target.value)}
                            className="w-full p-3 text-xs bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 font-mono"
                            rows={10}
                          />
                          <div className="mt-2 flex justify-end space-x-2">
                            <button
                              onClick={() => handleRegenerateMessage(contact.linkedinUrl || contact.name, contact)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleSaveMessage(contact.linkedinUrl || contact.name)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="p-3 text-xs bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap">
                            {editableMessages[contact.linkedinUrl || contact.name] || generateOutreachMessage(
                              contact, 
                              selectedJob
                            )}
                          </div>
                          <div className="mt-2 flex justify-end space-x-2">
                            <button
                              onClick={() => handleRegenerateMessage(contact.linkedinUrl || contact.name, contact)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Regenerate
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 flex justify-end">
                        {contact.linkedinUrl && contact.linkedinUrl !== 'n/a' && (
                          <a 
                            href={`${formatUrl(contact.linkedinUrl)}/message`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                            Message on LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedCompany ? (
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-md">
                <p>Click &quot;Find HR Contacts" to search for HR personnel at {selectedCompany}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-700 dark:text-gray-300">Select a company and click "Find HR Contacts"</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  This will use browser automation to find HR contacts on LinkedIn
                </p>
              </div>
            )}
          </div>
          
          {/* How It Works */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">How It Works</h2>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 mr-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Configure API Key</h3>
                  <p className="text-gray-600 dark:text-gray-400">Set up your Google Gemini API key to enable AI processing</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 mr-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Select Company</h3>
                  <p className="text-gray-600 dark:text-gray-400">Choose a company from your Google Sheet</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 mr-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Automated Search</h3>
                  <p className="text-gray-600 dark:text-gray-400">The system uses browser automation to search LinkedIn for HR personnel</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 mr-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">AI Processing</h3>
                  <p className="text-gray-600 dark:text-gray-400">Google's Gemini Flash 2.0 processes the results into structured data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main page component that wraps the content with Suspense
export default function LinkedInLookupPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto p-8 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-700 dark:text-gray-300">Loading...</span>
      </div>
    }>
      <LinkedInLookupContent />
    </Suspense>
  )
}