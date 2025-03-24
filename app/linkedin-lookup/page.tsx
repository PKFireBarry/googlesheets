"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CookieUtil from '../utils/cookies'
import { Loader2, Search, Linkedin, Globe, Settings, ArrowRight, Plus, Key } from 'lucide-react'
import { lookupLinkedInHR } from '../utils/webhook'

// Import LinkedInContactData type from webhook.ts
import type { LinkedInContactData } from '../utils/webhook'

// Helper function to extract spreadsheet ID from URL
const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

// Helper function to ensure URLs have the proper protocol prefix
const formatUrl = (url: string): string => {
  if (!url || url === 'n/a' || url === 'N/A') return '';
  
  // If the URL already has a protocol, return it as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // For LinkedIn URLs, add https://www. if needed
  if (url.includes('linkedin.com')) {
    if (url.startsWith('www.')) {
      return `https://${url}`;
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
  
  const [loading, setLoading] = useState(false)
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
  const [taskStatus, setTaskStatus] = useState<string | null>(null)
  const [taskProgress, setTaskProgress] = useState<number>(0)
  const [taskElapsedTime, setTaskElapsedTime] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string>('')
  
  useEffect(() => {
    // Load Gemini API key from cookies
    const savedApiKey = CookieUtil.get("geminiApiKey") || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    setGeminiApiKey(savedApiKey);
    
    // Load companies from Google Sheet
    const savedSheetUrl = CookieUtil.get("lastSheetUrl")
    if (savedSheetUrl) {
      const id = extractSpreadsheetId(savedSheetUrl)
      if (id) {
        fetchCompanies(id)
      }
    }
    
    // If a company was provided in the URL, select it
    if (companyParam) {
      setSelectedCompany(companyParam)
      setUseCustomCompany(false)
    }
  }, [companyParam])
  
  // Debug search results when they change
  useEffect(() => {
    if (searchResults.length > 0) {
      console.log('Current search results:', searchResults);
    }
  }, [searchResults]);
  
  // Auto-trigger search when company is provided in URL
  useEffect(() => {
    // Only auto-search if:
    // 1. We have a company parameter
    // 2. We're not already searching
    // 3. We haven't done an auto-search yet
    // 4. The URL has an 'autoSearch=true' parameter
    const shouldAutoSearch = 
      companyParam && 
      !isSearching && 
      !autoSearchDone && 
      searchParams.get('autoSearch') === 'true';
    
    if (shouldAutoSearch) {
      console.log('Auto-triggering search for company:', companyParam);
      handleSearch();
      setAutoSearchDone(true); // Mark auto-search as done
    }
  }, [companyParam, isSearching, autoSearchDone, searchParams]);
  
  const fetchCompanies = async (spreadsheetId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const API_KEY = process.env.NEXT_PUBLIC_API_KEY
      const RANGE = process.env.NEXT_PUBLIC_RANGE
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${RANGE}?key=${API_KEY}`
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "Failed to fetch data")
      }
      
      const result = await response.json()
      
      if (!result.values || result.values.length === 0) {
        throw new Error("No data found in sheet")
      }
      
      const headers = result.values[0]
      const rows = result.values.slice(1)
      
      // Find company name column
      const companyIndex = headers.findIndex((header: string) => 
        header.toLowerCase() === 'company_name' || 
        header.toLowerCase() === 'company'
      )
      
      if (companyIndex === -1) {
        throw new Error("Could not find company name column in sheet")
      }
      
      // Extract unique company names
      const uniqueCompanies = Array.from(new Set(
        rows
          .map((row: any) => row[companyIndex])
          .filter(Boolean)
          .sort()
      ))
      
      setCompanies(uniqueCompanies as string[])
      
    } catch (error: any) {
      console.error("Error fetching companies:", error)
      setError(error.message || "Failed to fetch companies")
    } finally {
      setLoading(false)
    }
  }
  
  const handleSaveSettings = () => {
    try {
      // Save Gemini API key if provided
      if (geminiApiKey) {
        CookieUtil.set("geminiApiKey", geminiApiKey, { expires: 30 })
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
    const companyToSearch = useCustomCompany ? customCompany : selectedCompany
    
    if (!companyToSearch) return
    
    // For LinkedIn direct method, we need a Gemini API key
    if (!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      setError('Please configure the Gemini API key first')
      return
    }
    
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
        const responseData = await lookupLinkedInHR(
          companyToSearch, 
          geminiApiKey,
          180000, // 3 minutes timeout
          statusUpdateCallback
        );
        console.log('LinkedIn search completed, response data:', responseData);
        
        // Check if we got valid results
        if (responseData && responseData.length > 0) {
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
  
  return (
    <div className="max-w-6xl mx-auto">
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
              <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gemini API Key
              </label>
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
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Required for LinkedIn search with Gemini Flash 2.0 parsing
              </p>
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
                <p className="mt-2 text-sm">Please load a Google Sheet with company data on the home page.</p>
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
                          href={contact.linkedinUrl} 
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
                          href={contact.linkedinUrl} 
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
                        <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                          {contact.website}
                        </a>
                      </div>
                    )}
                    
                    {contact.birthday && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Birthday: </span>
                        <span className="text-gray-600 dark:text-gray-400">{contact.birthday}</span>
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