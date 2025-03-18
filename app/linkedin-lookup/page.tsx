"use client"

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import CookieUtil from '../utils/cookies'
import { Loader2, Search, Linkedin, Globe, Settings, ArrowRight, Plus } from 'lucide-react'
import WebhookTestButton from '../components/WebhookTestButton'
import { WEBHOOK_URL, ensureProperProtocol, lookupHRContacts, testWebhook } from '../utils/webhook'

const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}

// Extract workflow ID from n8n webhook URL
const extractWorkflowId = (url: string): string => {
  const match = url.match(/\/webhook\/([^\/]+)\/([^\/]+)/)
  return match ? match[2] : ''
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

export default function LinkedInLookupPage() {
  const searchParams = useSearchParams()
  const companyParam = searchParams.get('company')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [webhookUrl, setWebhookUrl] = useState(WEBHOOK_URL)
  const [selectedCompany, setSelectedCompany] = useState(companyParam || '')
  const [customCompany, setCustomCompany] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [n8nWorkflowId, setN8nWorkflowId] = useState('')
  const [savedWebhook, setSavedWebhook] = useState('http://localhost:5678/webhook/1f50d8b8-820e-43b4-91a5-5cc31014fc8a')
  const [useCustomCompany, setUseCustomCompany] = useState(!companyParam)
  const [autoSearchDone, setAutoSearchDone] = useState(false) // Track if auto-search has been done
  
  useEffect(() => {
    // Load saved webhook URL from cookies, or use hardcoded URL if none exists
    const savedUrl = CookieUtil.get("linkedinWebhookUrl") || WEBHOOK_URL;
    const processedUrl = ensureProperProtocol(savedUrl);
    
    console.log('Setting webhook URL:', processedUrl);
    setWebhookUrl(processedUrl);
    setSavedWebhook(processedUrl);
    
    const savedWorkflowId = CookieUtil.get("n8nWorkflowId");
    if (savedWorkflowId) {
      setN8nWorkflowId(savedWorkflowId);
    }
    
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
  
  // Auto-trigger search when company is provided in URL and webhook is available
  // But only if explicitly requested via URL parameter
  useEffect(() => {
    // Only auto-search if:
    // 1. We have a company parameter
    // 2. We have a saved webhook
    // 3. We're not already searching
    // 4. We haven't done an auto-search yet
    // 5. The URL has an 'autoSearch=true' parameter
    const shouldAutoSearch = 
      companyParam && 
      savedWebhook && 
      !isSearching && 
      !autoSearchDone && 
      searchParams.get('autoSearch') === 'true';
    
    if (shouldAutoSearch) {
      console.log('Auto-triggering search for company:', companyParam);
      handleSearch();
      setAutoSearchDone(true); // Mark auto-search as done
    }
  }, [companyParam, savedWebhook, isSearching, autoSearchDone, searchParams]);
  
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
  
  const handleSaveWebhook = () => {
    try {
      if (!webhookUrl) {
        setError('Please enter a webhook URL')
        return
      }
      
      // Validate URL format
      new URL(webhookUrl)
      
      // Process the URL to ensure it has the proper protocol
      const processedUrl = ensureProperProtocol(webhookUrl)
      
      // Save to cookies
      CookieUtil.set("linkedinWebhookUrl", processedUrl, { expires: 30 })
      setSavedWebhook(processedUrl)
      
      if (n8nWorkflowId) {
        CookieUtil.set("n8nWorkflowId", n8nWorkflowId, { expires: 30 })
      }
      
      // Clear any previous errors
      setError(null)
      
      console.log('Webhook URL saved:', processedUrl)
    } catch (e) {
      // Invalid URL format
      setError('Please enter a valid URL')
    }
  }
  
  const handleSearch = async () => {
    // Use either the selected company from dropdown or the custom company input
    const companyToSearch = useCustomCompany ? customCompany : selectedCompany
    
    if (!companyToSearch || !savedWebhook) return
    
    setIsSearching(true)
    setSearchResults([])
    setError(null) // Clear any previous errors
    
    try {
      console.log(`Starting search for company: ${companyToSearch} using webhook: ${savedWebhook}`);
      
      // Pass the saved webhook URL to override the default
      const responseData = await lookupHRContacts(companyToSearch, 60000, savedWebhook);
      
      console.log('Search completed, processing response data:', responseData);
      
      // Check if we got valid results
      if (responseData) {
        // Map the webhook response data to our expected format
        // The webhook returns data in the format:
        // { name, title, email, linkedin_url, website, profile_image, birthday }
        
        // Handle different response formats:
        // 1. Array of contacts
        // 2. Object with contacts array property
        // 3. Single contact object
        // 4. String response that might be JSON
        
        let contacts: any[] = []
        
        if (Array.isArray(responseData)) {
          // Direct array of contacts
          console.log('Response is an array with', responseData.length, 'items');
          contacts = responseData
        } else if (typeof responseData === 'object') {
          // Check for nested arrays in common properties
          if (responseData.data && Array.isArray(responseData.data)) {
            console.log('Found data array in data property');
            contacts = responseData.data
          } else if (responseData.output && Array.isArray(responseData.output)) {
            console.log('Found data array in output property');
            contacts = responseData.output
          } else if (responseData.result && Array.isArray(responseData.result)) {
            console.log('Found data array in result property');
            contacts = responseData.result
          } else if (responseData.contacts && Array.isArray(responseData.contacts)) {
            console.log('Found data array in contacts property');
            contacts = responseData.contacts
          } else if (responseData.body && typeof responseData.body === 'object') {
            // Data is in the body property (common in webhook test responses)
            console.log('Found data in body property');
            contacts = [responseData.body]
          } else {
            // Single contact object
            console.log('Treating response as a single contact object');
            contacts = [responseData]
          }
        } else if (typeof responseData === 'string') {
          // Try to parse as JSON
          try {
            console.log('Response is a string, attempting to parse as JSON');
            const parsed = JSON.parse(responseData)
            if (Array.isArray(parsed)) {
              contacts = parsed
            } else if (parsed && typeof parsed === 'object') {
              contacts = [parsed]
            }
          } catch (e) {
            console.error('Failed to parse string response as JSON:', e)
          }
        }
        
        console.log('Extracted contacts:', contacts);
        
        // Map the webhook data to our component's expected format
        const formattedContacts = contacts.map(contact => {
          // For debugging
          console.log('Processing contact:', contact);
          
          // Handle the case where the contact might be in a nested property
          let contactData = contact;
          
          // If the contact has a body property that looks like our data, use that
          if (contact.body && typeof contact.body === 'object') {
            console.log('Contact has body property, using that');
            contactData = contact.body;
          }
          
          // If the contact has a type property that indicates it's our search request, not the result
          if (contactData.type === 'hr_contact_search' && contactData.company) {
            console.log('This appears to be the request object, not the result');
            // Try to find any properties that might contain the actual data
            for (const key in contactData) {
              if (typeof contactData[key] === 'object' && contactData[key] !== null) {
                if (contactData[key].name || contactData[key].email || contactData[key].linkedin_url) {
                  console.log(`Found contact data in ${key} property`);
                  contactData = contactData[key];
                  break;
                }
              }
            }
          }
          
          // If we still have the request object, try to extract any useful information
          if (contactData.type === 'hr_contact_search' && !contactData.name) {
            console.log('Still have request object, creating placeholder contact');
            return {
              name: `HR Contact at ${companyToSearch}`,
              title: 'Human Resources',
              email: '',
              linkedinUrl: '',
              website: '',
              profileImage: '',
              company: companyToSearch,
              phone: '',
              location: '',
              _note: 'Contact details pending - webhook processing'
            };
          }
          
          return {
            name: contactData.name || '',
            title: contactData.title || '',
            email: contactData.email || '',
            linkedinUrl: contactData.linkedin_url || contactData.linkedinUrl || '',
            website: contactData.website || '',
            profileImage: contactData.profile_image || contactData.profileImage || '',
            company: companyToSearch,
            phone: contactData.phone || '',  // Not usually provided in the webhook response
            location: contactData.location || '',  // Not usually provided in the webhook response
          }
        })
        
        console.log('Formatted contacts:', formattedContacts);
        
        if (formattedContacts.length > 0) {
          setSearchResults(formattedContacts)
        } else {
          throw new Error('No valid contacts found for this company')
        }
      } else {
        throw new Error('Invalid webhook response format')
      }
    } catch (error) {
      console.error('Error searching for HR contacts:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsSearching(false)
    }
  }
  
  // Update the Test Connection button to use our improved testWebhook function
  const handleTestConnection = async () => {
    try {
      setIsSearching(true)
      setError(null)
      
      // Use the testWebhook function from the webhook utility
      await testWebhook(savedWebhook, 60000)
      
      console.log('Webhook test successful')
      alert('Webhook connection successful!')
    } catch (error) {
      console.error('Webhook test failed:', error)
      setError(`Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
          {/* Webhook Configuration */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center mb-4">
              <Settings className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Webhook Configuration</h2>
            </div>
            
            <div className="mb-4">
              <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                n8n Webhook URL
              </label>
              <input
                id="webhook-url"
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-n8n-instance.com/webhook/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter your n8n webhook URL for LinkedIn lookups
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="workflow-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workflow ID (Optional)
              </label>
              <input
                id="workflow-id"
                type="text"
                value={n8nWorkflowId}
                onChange={(e) => setN8nWorkflowId(e.target.value)}
                placeholder="Optional: Your n8n workflow ID"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional: Specify a workflow ID to use
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSaveWebhook}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Save Configuration
              </button>
              
              {savedWebhook && (
                <WebhookTestButton 
                  webhookUrl={savedWebhook} 
                  className="mt-0" 
                />
              )}
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
                <div className="mb-4">
                  <label htmlFor="company-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Company
                  </label>
                  <select
                    id="company-select"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a company...</option>
                    {companies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={handleSearch}
                  disabled={!selectedCompany || !savedWebhook || isSearching}
                  className={`w-full px-4 py-2 rounded-md font-medium flex items-center justify-center ${
                    !selectedCompany || !savedWebhook || isSearching
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
            
            {!savedWebhook ? (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-md">
                <p className="font-medium">Webhook not configured</p>
                <p className="mt-2 text-sm">Please enter and save your n8n webhook URL to enable LinkedIn lookups.</p>
              </div>
            ) : isSearching ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-700 dark:text-gray-300">Searching for HR contacts at {selectedCompany}...</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This may take a few moments</p>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
                <p className="font-medium">Lookup unsuccessful</p>
                <p className="mt-2 text-sm">We couldn't find HR contacts for {selectedCompany}. Please try another company or try again later.</p>
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
                          onClick={(e) => {
                            console.log('Opening LinkedIn profile URL:', contact.linkedinUrl);
                          }}
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
                  </div>
                ))}
              </div>
            ) : selectedCompany ? (
              <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-md">
                <p>Click "Find HR Contacts" to search for HR personnel at {selectedCompany}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-700 dark:text-gray-300">Select a company and click "Find HR Contacts"</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  This will use n8n and browser automation to find HR contacts on LinkedIn
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
                  <h3 className="font-medium text-gray-900 dark:text-white">Configure Webhook</h3>
                  <p className="text-gray-600 dark:text-gray-400">Set up your n8n webhook URL to enable LinkedIn automation</p>
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
                  <h3 className="font-medium text-gray-900 dark:text-white">Find HR Contacts</h3>
                  <p className="text-gray-600 dark:text-gray-400">The system will search LinkedIn for HR personnel at the selected company</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}