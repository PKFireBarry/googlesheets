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
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false) // Control whether auto-search is enabled
  
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
    
    // Log the current API key state to debug
    console.log('Current geminiApiKey state:', geminiApiKey ? `${geminiApiKey.substring(0, 3)}...` : 'not set')
    console.log('Environment API key:', process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'set' : 'not set')
    
    // Check if we have an API key in cookie but not in state
    if (!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      const cookieApiKey = CookieUtil.get("geminiApiKey")
      if (cookieApiKey) {
        console.log('Found API key in cookie but not in state, using cookie value')
        // Use the cookie value directly
        setGeminiApiKey(cookieApiKey)
        // Continue with the search using the cookie value
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 no-overflow mobile-container">
      {/* API Key Information Modal */}
      {showApiInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
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
      
      <div className="mb-4 sm:mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
                LinkedIn Connection Finder
              </h1>
              <p className="text-mobile-sm text-blue-100 max-w-2xl">
                Find recruiters at a company on LinkedIn to help with your job application chances and grow your network in the process.
              </p>
            </div>
          </div>
        </div>
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
      
      {/* How To Use Section - Moved to top */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 mb-6 sm:mb-8">
        <button 
          onClick={() => setShowHowItWorksModal(true)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">How to Use LinkedIn Connection Finder</h2>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        
        <div className="mt-4 text-gray-600 dark:text-gray-400">
          <p>Click to learn how this tool works and what you can do with it.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* API Key Configuration - Only show if no API key is available */}
        {(!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) ? (
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 h-full">
            <div className="flex items-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
                  <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">API Configuration</h2>
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
          </div>
        ) : null}
        
        {/* Company Selection */}
        {!selectedJob && (
          <div className={(!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 h-full">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Selection</h2>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">Loading companies...</p>
                  </div>
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
                        className={`px-4 py-2 rounded-md font-medium flex items-center ${                      !customCompany || isSearching
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
                    <div className="space-y-4">
                      {/* Company Selection */}
                      <div>
                        <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Company
                        </label>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1">
                            {useCustomCompany ? (
                              <input
                                type="text"
                                id="customCompany"
                                value={customCompany}
                                onChange={(e) => setCustomCompany(e.target.value)}
                                placeholder="Enter company name"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                              />
                            ) : (
                              <select
                                id="company"
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
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
                            className="inline-flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-700 shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
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
                    disabled={(!selectedCompany && !customCompany) || isSearching}
                    className={`w-full mt-4 px-4 py-3 rounded-lg font-medium flex items-center justify-center transition-all duration-200 ${                    (!selectedCompany && !customCompany) || isSearching
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
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
        )}
      </div>
      
      {/* Combined Job Details and LinkedIn Contacts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 sm:mb-8 border border-gray-100 dark:border-gray-700">
        {/* Job Details Section (within combined container) */}
        {selectedJob && (
          <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
                <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Selected Job Details
              </h2>
            </div>
            
            <div className="space-y-5">
              {/* Job Header - Title, Company, Logo, Links/Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                    {selectedJob.company_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={typeof selectedJob.company_image === 'string' ? selectedJob.company_image : ''} 
                        alt={`${getJobValue(selectedJob, ['company_name', 'company'])} logo`}
                        className="w-full h-full object-contain p-1 rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Building className="w-10 h-10 text-gray-400 dark:text-gray-500" />
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
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {getJobValue(selectedJob, ['url']) && (
                    <a
                      href={getJobValue(selectedJob, ['url'])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-5 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow whitespace-nowrap"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Job Posting
                    </a>
                  )}
                  
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className={`inline-flex items-center px-5 py-3 text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow whitespace-nowrap ${                    isSearching
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Linkedin className="w-4 h-4 mr-2" />
                        Find HR Contacts
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Job Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {getJobValue(selectedJob, ['location']) && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <MapPin className="w-5 h-5 mr-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <span>{getJobValue(selectedJob, ['location'])}</span>
                  </div>
                )}
                
                {getJobValue(selectedJob, ['salary']) && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <DollarSign className="w-5 h-5 mr-3 text-green-500 dark:text-green-400 flex-shrink-0" />
                    <span>{getJobValue(selectedJob, ['salary'])}</span>
                  </div>
                )}
                
                {getJobValue(selectedJob, ['experience']) && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <Briefcase className="w-5 h-5 mr-3 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                    <span>{getJobValue(selectedJob, ['experience'])}</span>
                  </div>
                )}
                
                {getJobValue(selectedJob, ['job_type', 'type']) && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <Clock className="w-5 h-5 mr-3 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                    <span>{getJobValue(selectedJob, ['job_type', 'type'])}</span>
                  </div>
                )}
              </div>
              
              {/* Skills and Description */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {getSkillsArray(selectedJob).length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2 text-yellow-500 dark:text-yellow-400" />
                      Required Skills
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {getSkillsArray(selectedJob).map((skill, index) => (
                        <span 
                          key={index}
                          className="px-3 py-1.5 text-xs rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {getJobValue(selectedJob, ['description']) && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                      Description
                    </h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-line bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      {getJobValue(selectedJob, ['description'])}
                    </div>
                    <button
                      className="text-blue-600 dark:text-blue-400 text-xs mt-2 hover:underline flex items-center"
                      onClick={() => alert(getJobValue(selectedJob, ['description']))}
                    >
                      <ArrowRight className="w-3 h-3 mr-1" />
                      View Full Description
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Search Results (within combined container) */}
        <div>
          <div className="flex items-center mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
              <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">LinkedIn HR Contacts</h2>
          </div>
          
          {/* Display based on search state */}
          {!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY ? (
            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-6 py-4 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-yellow-200 dark:bg-yellow-800 p-3 rounded-full">
                  <Key className="h-6 w-6 text-yellow-700 dark:text-yellow-300" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Gemini API Key not configured</p>
                  <p className="mt-2">Please enter and save your Google Gemini API key to enable LinkedIn lookups.</p>
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
              </div>
            </div>
          ) : isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
                Searching for HR contacts at {selectedCompany}
              </h3>
              
              {/* Status indicator */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3 mt-4 w-full max-w-md">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2 text-center">
                    {statusMessage || 'Initializing search...'}
                  </p>
                  
                {/* Progress bar with animation */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-700 ease-in-out"
                    style={{ width: `${Math.min(taskProgress, 100)}%` }}
                  ></div>
                </div>
                
                {/* Time indicator */}
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {taskStatus === 'processing' ? 'Processing data' : 
                     taskStatus === 'polling' ? 'Searching LinkedIn' : 
                     'Starting search'}
                  </span>
                  <span>
                    {taskElapsedTime > 0 ? `${taskElapsedTime}s elapsed` : ''}
                  </span>
                </div>
              </div>
              
              {/* Status explanation */}
              <div className="mt-6 text-center max-w-md">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {taskStatus === 'polling' && (
                    <p>Our automated browser is searching LinkedIn for HR contacts at {selectedCompany}...</p>
                  )}
                  
                  {taskStatus === 'processing' && (
                    <p>Browser automation complete! Now using AI to analyze and structure the data...</p>
                  )}
                  
                  {taskStatus === 'preparing' && (
                    <p>Setting up the search process. This typically takes 2-3 minutes to complete.</p>
                  )}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-red-200 dark:bg-red-800 p-3 rounded-full">
                  <X className="h-6 w-6 text-red-700 dark:text-red-300" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Lookup unsuccessful</p>
                  <p className="mt-2">{error}</p>
                  {error.includes('timeout') && (
                    <div className="mt-4 bg-white dark:bg-gray-700 p-4 rounded-lg">
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
              </div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {searchResults.map((contact, index) => {
                // Create a safely typed contact object for rendering
                const safeContact = {
                  name: typeof contact.name === 'string' ? contact.name : String(contact.name || 'Unknown'),
                  title: typeof contact.title === 'string' ? contact.title : String(contact.title || ''),
                  location: typeof contact.location === 'string' ? contact.location : String(contact.location || ''),
                  email: typeof contact.email === 'string' ? contact.email : String(contact.email || ''),
                  linkedinUrl: typeof contact.linkedinUrl === 'string' ? contact.linkedinUrl : String(contact.linkedinUrl || ''),
                  phone: typeof contact.phone === 'string' ? contact.phone : String(contact.phone || ''),
                  website: typeof contact.website === 'string' ? contact.website : String(contact.website || ''),
                  profileImage: typeof contact.profileImage === 'string' ? contact.profileImage : '',
                  birthday: typeof contact.birthday === 'string' ? contact.birthday : 
                           (contact.birthday ? String(contact.birthday) : '')
                };
                
                return (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        {safeContact.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={safeContact.profileImage} 
                            alt={`${safeContact.name} profile`}
                            className="w-16 h-16 rounded-full mr-4 object-cover border-2 border-gray-200 dark:border-gray-700"
                            onError={(e) => {
                              // Handle image load errors by hiding the image
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full mr-4 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <Linkedin className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{safeContact.name}</h3>
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{safeContact.title}</p>
                          {safeContact.location && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 flex items-center">
                              <MapPin className="w-3.5 h-3.5 mr-1 inline" />
                              {safeContact.location}
                            </p>
                          )}
                        </div>
                      </div>
                      {safeContact.linkedinUrl && (
                        <a 
                          href={formatUrl(safeContact.linkedinUrl)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline bg-blue-50 dark:bg-blue-900/20 py-1.5 px-3 rounded-lg"
                        >
                          <Linkedin className="w-4 h-4 mr-1.5" />
                          View Profile
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                    
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                      {safeContact.email && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Email: </span>
                          <a href={`mailto:${safeContact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {safeContact.email}
                          </a>
                        </div>
                      )}
                      
                      {safeContact.linkedinUrl && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">LinkedIn: </span>
                          <a 
                            href={formatUrl(safeContact.linkedinUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-[200px]"
                          >
                            {safeContact.linkedinUrl}
                          </a>
                        </div>
                      )}
                      
                      {safeContact.phone && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Phone: </span>
                          <a href={`tel:${safeContact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {safeContact.phone}
                          </a>
                        </div>
                      )}
                      
                      {safeContact.website && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Website: </span>
                          <a href={formatUrl(safeContact.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-[200px]">
                            {safeContact.website}
                          </a>
                        </div>
                      )}
                      
                      {safeContact.birthday && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Birthday: </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {safeContact.birthday}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* LinkedIn Outreach Message Generator */}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-5 pt-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                          Job Referral Message
                        </h3>
                        
                        <div className="flex items-center gap-2">
                          {/* Edit/Save Button */}
                          <button
                            onClick={() => handleEditMessage(safeContact.linkedinUrl || safeContact.name)}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 ${                            isEditingMessage[safeContact.linkedinUrl || safeContact.name] 
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            }`}
                          >
                            {isEditingMessage[safeContact.linkedinUrl || safeContact.name] ? (
                              <>Save Changes</>
                            ) : (
                              <>Edit Message</>
                            )}
                          </button>
                          
                          {/* Copy Button */}
                          <button
                            onClick={() => copyMessageToClipboard(
                              editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                                contact, 
                                selectedJob
                              ),
                              safeContact.linkedinUrl || safeContact.name
                            )}
                            className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 ${                            copiedMessageIds[safeContact.linkedinUrl || safeContact.name]
                                ? 'bg-green-600 text-white'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            }`}
                          >
                            {copiedMessageIds[safeContact.linkedinUrl || safeContact.name] ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1.5" />
                                Copy Message
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {isEditingMessage[safeContact.linkedinUrl || safeContact.name] ? (
                        <div className="mt-3">
                          <div className="relative">
                            <textarea
                              value={editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                                contact, 
                                selectedJob
                              )}
                              onChange={(e) => handleMessageChange(safeContact.linkedinUrl || safeContact.name, e.target.value)}
                              className="w-full p-4 text-sm bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-700 font-mono shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={10}
                              style={{resize: "vertical"}}
                            />
                            <div className="absolute top-2 right-2 bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
                              Editing
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end space-x-3">
                            <button
                              onClick={() => handleRegenerateMessage(safeContact.linkedinUrl || safeContact.name, contact)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center transition-colors duration-200"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleSaveMessage(safeContact.linkedinUrl || safeContact.name)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="p-4 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap relative overflow-hidden shadow-inner">
                            {editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                              contact, 
                              selectedJob
                            )}
                          </div>
                          <div className="mt-3 flex justify-end space-x-3">
                            <button
                              onClick={() => handleRegenerateMessage(safeContact.linkedinUrl || safeContact.name, contact)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center transition-colors duration-200"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleEditMessage(safeContact.linkedinUrl || safeContact.name)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
                            >
                              Edit Message
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 flex justify-end">
                        {safeContact.linkedinUrl && safeContact.linkedinUrl !== 'n/a' && (
                          <a 
                            href={`${formatUrl(safeContact.linkedinUrl)}/message`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow"
                          >
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                            Message on LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : selectedCompany ? (
            <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-700 dark:text-blue-300 p-6 rounded-lg flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="bg-blue-200 dark:bg-blue-800 p-3 rounded-full">
                <Search className="h-6 w-6 text-blue-700 dark:text-blue-300" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="font-medium text-lg">Ready to search</p>
                <p className="mt-1">Click "Find HR Contacts" to search for HR personnel at {selectedCompany}</p>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 inline-flex items-center"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Find HR Contacts
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-full mb-6">
                <Search className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No search results yet</p>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Select a company and click "Find HR Contacts" to search for HR personnel on LinkedIn
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* How To Use Modal - Full Screen Version */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <HelpCircle className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
                How to Use LinkedIn Connection Finder
              </h2>
              <button 
                onClick={() => setShowHowItWorksModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column - Process Steps */}
                <div className="space-y-8">
                  <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                    <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Configure Your API Key</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Get a <span className="font-medium text-blue-600 dark:text-blue-400">free</span> Gemini API key from Google AI Studio and enter it in the API Configuration section. This unlocks unlimited searches with no usage limits.
                    </p>
                    <div className="mt-3 flex items-center text-blue-600 dark:text-blue-400 text-sm">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        Get your free API key
                      </a>
                    </div>
                  </div>
                  
                  <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                    <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Select a Target Company</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Choose from your imported job list or enter any company name manually. Looking for HR contacts at a specific company? Just type it in and start your search.
                    </p>
                    <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Pro tip:</span> Import your job tracking spreadsheet first for a seamless workflow.
                    </div>
                  </div>
                  
                  <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                    <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">3</span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Find HR Personnel</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Our system uses advanced AI to search LinkedIn for HR contacts, recruiters, and hiring managers at your target company. The search is powered by browser automation and Google's Gemini AI.
                    </p>
                    <div className="mt-3 flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      <span>Searches typically take 2-3 minutes to complete</span>
                    </div>
                  </div>
                  
                  <div className="relative pl-8">
                    <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">4</span>
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Personalize & Reach Out</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Once contacts are found, review their profiles and edit the AI-generated outreach messages. One click sends you directly to LinkedIn messaging to make your connection.
                    </p>
                  </div>
                </div>
                
                {/* Right Column - Feature Highlights */}
                <div className="bg-gray-50 dark:bg-gray-750 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    What You Can Do
                  </h3>
                  
                  <div className="space-y-5">
                    <div className="flex">
                      <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mr-3 mt-1">
                        <Linkedin className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-md">Find the Right People</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          Automatically discover HR contacts, recruiters, and hiring managers who can help with your job applications.
                        </p>
                </div>
              </div>
              
                    <div className="flex">
                      <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg mr-3 mt-1">
                        <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-md">Personalized Messages</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          Get AI-generated outreach messages tailored to each contact and job. Edit them to add your personal touch.
                        </p>
                </div>
              </div>
              
                    <div className="flex">
                      <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg mr-3 mt-1">
                        <RefreshCw className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-md">Regenerate & Refine</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          Not happy with a message? Regenerate it with one click or make your own edits for the perfect outreach.
                        </p>
                </div>
              </div>
              
                    <div className="flex">
                      <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg mr-3 mt-1">
                        <ArrowRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                        <h4 className="font-medium text-gray-900 dark:text-white text-md">Direct Contact</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                          Go straight to LinkedIn messaging with one click. Copy your personalized message and make that connection.
                        </p>
                </div>
              </div>
            </div>
                  
                  {/* Call to Action */}
                  <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Ready to find your hiring manager?</h4>
                    <p className="text-blue-600/80 dark:text-blue-400/80 text-sm mb-3">
                      Enter a company name above and click "Find HR Contacts" to get started with your job search outreach.
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setShowHowItWorksModal(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center transition-colors duration-200"
                      >
                        <Search className="w-4 h-4 mr-1.5" />
                        Start Searching
                      </button>
          </div>
        </div>
      </div>
              </div>
            </div>
          </div>
        </div>
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