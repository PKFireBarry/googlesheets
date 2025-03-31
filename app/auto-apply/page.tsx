"use client"

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { toast } from 'react-hot-toast'
import { 
  Briefcase, 
  Globe, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Building,
  Bot,
  Calendar,
  Link2,
  ListFilter,
  MapPin,
  DollarSign,
  ExternalLink,
  MessageSquare,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FileUp,
  ChevronRight,
  Key
} from 'lucide-react'

import { loadResume, resumeExists } from '../utils/resumeStorage'
import { prepareResumeTextForAPI } from '../utils/resumeAdapter'
import { autoApplyToJob, AutoApplyResult } from '../utils/autoApply'

// Function to extract spreadsheet ID from URL
const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

// Function to ensure URLs have proper protocol
const formatUrl = (url: string): string => {
  if (!url || url === 'n/a' || url === 'N/A') return '';
  
  url = url.trim();
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  return `https://${url}`;
};

export default function AutoApplyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Job information
  const jobId = searchParams.get('jobId')
  const [jobData, setJobData] = useState<Record<string, unknown> | null>(null)
  const [jobUrl, setJobUrl] = useState('')
  const [customJobUrl, setCustomJobUrl] = useState('')
  const [useCustomUrl, setUseCustomUrl] = useState(false)
  
  // Resume information
  const [hasResume, setHasResume] = useState(false)
  const [resumeInfo, setResumeInfo] = useState<string | null>(null)
  
  // API key
  const [apiKey, setApiKey] = useState('')
  const [showApiForm, setShowApiForm] = useState(false)
  
  // Application status
  const [isApplying, setIsApplying] = useState(false)
  const [applicationStarted, setApplicationStarted] = useState(false)
  const [taskStatus, setTaskStatus] = useState<string>('idle')
  const [taskProgress, setTaskProgress] = useState<number>(0)
  const [taskElapsedTime, setTaskElapsedTime] = useState<number>(0)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [applicationResult, setApplicationResult] = useState<AutoApplyResult | null>(null)
  const [jobApplied, setJobApplied] = useState(false)
  
  // Error handling
  const [error, setError] = useState<string | null>(null)
  
  // Load job data from URL params and API key from cookies
  useEffect(() => {
    // Load API key from cookie if available
    const savedApiKey = Cookies.get("geminiApiKey") || ''
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
    
    // Check if resume exists
    const resumeExists = checkIfResumeExists()
    setHasResume(resumeExists)
    
    // Load job data if jobId is provided
    if (jobId) {
      loadJobFromStorage(jobId)
    }
  }, [jobId])
  
  // Check if a resume exists in shared storage
  const checkIfResumeExists = (): boolean => {
    const exists = resumeExists()
    
    if (exists) {
      const { resumeData, resumePdfData } = loadResume()
      if (resumePdfData) {
        setResumeInfo('PDF Resume available in shared storage')
      } else if (resumeData) {
        setResumeInfo('Resume available in shared storage')
      }
      return true
    }
    
    return false
  }
  
  // Load job data from localStorage
  const loadJobFromStorage = (id: string) => {
    try {
      // Try to get job data from localStorage
      const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}')
      if (savedJobs[id]) {
        console.log('Found saved job data:', savedJobs[id])
        setJobData(savedJobs[id])
        
        // Extract job URL from job data
        let url = ''
        if (savedJobs[id].url) {
          url = savedJobs[id].url as string
        } else if (savedJobs[id].company_website) {
          url = savedJobs[id].company_website as string
          // Add careers or jobs path for company websites
          if (!url.includes('/career') && !url.includes('/job')) {
            url = `${url.replace(/\/$/, '')}/careers`
          }
        }
        
        setJobUrl(formatUrl(url))
      } else {
        console.log('No saved job data found for jobId:', id)
        setError('Job not found. Please enter a job URL manually.')
      }
    } catch (error) {
      console.error('Error loading job data:', error)
      setError('Error loading job data. Please try again or enter a job URL manually.')
    }
  }
  
  // Save API key to cookie
  const saveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key')
      return
    }
    
    Cookies.set("geminiApiKey", apiKey.trim(), { expires: 30 })
    toast.success('API key saved successfully')
    setShowApiForm(false)
  }
  
  // Handle API key input change
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
  }
  
  // Handle custom job URL input change
  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomJobUrl(e.target.value)
  }
  
  // Toggle custom URL input
  const toggleCustomUrl = () => {
    setUseCustomUrl(!useCustomUrl)
  }
  
  // Get effective job URL (either from job data or custom input)
  const getEffectiveJobUrl = (): string => {
    if (useCustomUrl && customJobUrl) {
      return formatUrl(customJobUrl)
    }
    return jobUrl
  }
  
  // Start the auto-apply process
  const startAutoApply = async () => {
    const effectiveUrl = getEffectiveJobUrl()
    
    // Validate inputs
    if (!effectiveUrl) {
      toast.error('Please provide a job application URL')
      return
    }
    
    if (!hasResume) {
      toast.error('A resume is required. Please upload one in the Resume Builder section.')
      return
    }
    
    // Set application states
    setError(null)
    setIsApplying(true)
    setApplicationStarted(true)
    setApplicationResult(null)
    setTaskStatus('starting')
    setTaskProgress(0)
    setTaskElapsedTime(0)
    setStatusMessage('Preparing to apply...')
    
    try {
      // Load resume data
      const { resumeData, resumePdfData } = loadResume()
      const jobTitle = jobData?.title as string || 'the position'
      const companyName = jobData?.company_name as string || 'the company'
      
      // Status update callback
      const onStatusUpdate = (update: {
        status: string;
        progress: number;
        elapsedTime: number;
        message?: string;
      }) => {
        setTaskStatus(update.status)
        setTaskProgress(update.progress)
        setTaskElapsedTime(update.elapsedTime)
        if (update.message) {
          setStatusMessage(update.message)
        }
      }
      
      // Start the auto-apply process with auto-populate features
      const result = await autoApplyToJob(
        effectiveUrl,
        jobTitle,
        companyName,
        resumeData,
        resumePdfData,
        apiKey || undefined,
        180000, // 3 minute timeout
        onStatusUpdate
      )
      
      console.log('Auto-apply completed with result:', result)
      setApplicationResult(result)
      
      // If application was successful or partially successful, mark job as applied
      if (result.status === 'success' || (result.status === 'partial' && result.resumeSubmitted)) {
        // Mark job as applied in cookies
        if (jobData && jobData.title && jobData.company_name) {
          const jobTitle = jobData.title as string
          const companyName = jobData.company_name as string
          const jobIdentifier = `${jobTitle}-${companyName}`.replace(/\s+/g, '-')
          
          // Get existing applied jobs
          const appliedJobs = JSON.parse(Cookies.get('appliedJobs') || '[]')
          
          // Add job to applied jobs if not already included
          if (!appliedJobs.includes(jobIdentifier)) {
            appliedJobs.push(jobIdentifier)
            Cookies.set('appliedJobs', JSON.stringify(appliedJobs), { expires: 30 })
            setJobApplied(true)
            
            // Show success toast
            toast.success('Job marked as applied')
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-apply process:', error)
      setError(error instanceof Error ? error.message : 'An unknown error occurred')
      
      // Set application result for failed attempt
      setApplicationResult({
        status: 'failed',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        details: 'The automated job application process failed. You may want to try applying manually.',
        steps: ['Application process failed to start'],
        resumeSubmitted: false,
        formsFilled: false,
        obstacles: [error instanceof Error ? error.message : 'Unknown error']
      })
    } finally {
      setIsApplying(false)
    }
  }
  
  // Reset the application process
  const resetApplication = () => {
    setApplicationStarted(false)
    setApplicationResult(null)
    setTaskStatus('idle')
    setTaskProgress(0)
    setTaskElapsedTime(0)
    setStatusMessage('')
    setError(null)
  }
  
  // Go back to the job list
  const goToJobList = () => {
    router.push('/')
  }
  
  // View applied jobs
  const viewAppliedJobs = () => {
    router.push('/applied-jobs')
  }
  
  // User-friendly time format
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  
  // Get application status class for styling
  const getStatusClass = (): string => {
    if (applicationResult) {
      if (applicationResult.status === 'success') {
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
      } else if (applicationResult.status === 'partial') {
        return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20'
      } else {
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
      }
    }
    
    return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
  }
  
  // Get application status icon
  const StatusIcon = () => {
    if (applicationResult) {
      if (applicationResult.status === 'success') {
        return <CheckCircle2 className="w-5 h-5" />
      } else if (applicationResult.status === 'partial') {
        return <AlertTriangle className="w-5 h-5" />
      } else {
        return <X className="w-5 h-5" />
      }
    }
    
    return <Clock className="w-5 h-5" />
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-8 sm:mb-12">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl shadow-xl p-6 sm:p-10 text-white mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Auto Apply
          </h1>
          <p className="text-purple-100 text-lg max-w-2xl">
            Automatically apply to jobs using your resume from shared storage. This feature uses AI to fill out job applications for you.
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Card */}
      {jobData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Job Details
            </h2>
          </div>
          
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {jobData.title as string}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {jobData.company_name as string} • {jobData.location as string || 'Remote'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {typeof jobData?.location === 'string' && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                  <span>{jobData.location as string}</span>
                </div>
              )}
              
              {typeof jobData?.salary === 'string' && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                  <span>{jobData.salary as string}</span>
                </div>
              )}
              
              {typeof jobData?.date_posted === 'string' && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                  <span>Posted: {jobData.date_posted as string}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Application Control Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Application Controls
          </h2>
        </div>
        
        <div className="p-4">
          {/* Job URL Configuration */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Job Application URL</h3>
              <button 
                onClick={toggleCustomUrl}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
              >
                {useCustomUrl ? 'Use Detected URL' : 'Enter Custom URL'} <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${useCustomUrl ? 'rotate-90' : ''}`} />
              </button>
            </div>
            
            {useCustomUrl ? (
              <div className="mt-2">
                <input
                  type="url"
                  value={customJobUrl}
                  onChange={handleCustomUrlChange}
                  placeholder="Enter job application URL"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            ) : (
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <Link2 className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate">{jobUrl || 'No job URL detected'}</span>
                {jobUrl && (
                  <a 
                    href={jobUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
          
          {/* Resume Information */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Resume</h3>
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <FileText className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
              {hasResume ? (
                <div className="flex items-center">
                  <span className="text-green-600 dark:text-green-400 flex items-center">
                    <Check className="w-4 h-4 mr-1" />
                    {resumeInfo}
                  </span>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="text-red-600 dark:text-red-400">No resume found in shared storage.</span>
                  <button
                    onClick={() => router.push('/resume-builder')}
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                  >
                    Create Resume
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* API Key Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">API Key</h3>
              <button 
                onClick={() => setShowApiForm(!showApiForm)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
              >
                {showApiForm ? 'Hide' : apiKey ? 'Change API Key' : 'Configure API Key'} 
                <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showApiForm ? 'rotate-90' : ''}`} />
              </button>
            </div>
            
            {showApiForm ? (
              <div className="mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Enter your Gemini API key to improve the accuracy of the auto-apply feature.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder="Enter your Gemini API key"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  <button 
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <Key className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
                {apiKey ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center">
                    <Check className="w-4 h-4 mr-1" />
                    API key configured
                  </span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    No API key configured (optional)
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            {!applicationStarted ? (
              <button
                onClick={startAutoApply}
                disabled={isApplying || !hasResume || (!jobUrl && !customJobUrl)}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bot className="w-4 h-4 mr-2" />
                Start Auto Apply
              </button>
            ) : applicationResult ? (
              <>
                <button
                  onClick={resetApplication}
                  className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </button>
                
                {jobApplied && (
                  <button
                    onClick={viewAppliedJobs}
                    className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    View Applied Jobs
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={resetApplication}
                disabled={isApplying}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
            )}
            
            <button
              onClick={goToJobList}
              className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Back to Jobs
            </button>
          </div>
        </div>
      </div>
      
      {/* Application Progress */}
      {applicationStarted && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 mb-6">
          <div className={`p-4 flex items-center ${getStatusClass()}`}>
            <div className="mr-3">
              {isApplying ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current"></div>
              ) : (
                <StatusIcon />
              )}
            </div>
            <div>
              <h3 className="font-medium">
                {applicationResult 
                  ? applicationResult.message 
                  : `Auto Apply in progress (${formatTime(taskElapsedTime)})`}
              </h3>
              <p className="text-sm opacity-80">
                {applicationResult 
                  ? (applicationResult.status === 'success' 
                      ? 'Application completed successfully.' 
                      : applicationResult.status === 'partial' 
                        ? 'Application partially completed.' 
                        : 'Application could not be completed.')
                  : statusMessage || 'Automating the job application process...'}
              </p>
            </div>
          </div>
          
          {isApplying && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${taskProgress}%` }}
                ></div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                {taskProgress}% complete
              </div>
            </div>
          )}
          
          {applicationResult && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Application Details</h4>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                    applicationResult.resumeSubmitted 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {applicationResult.resumeSubmitted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">Resume submitted</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                    applicationResult.formsFilled 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {applicationResult.formsFilled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-gray-700 dark:text-gray-300">Application forms filled</p>
                  </div>
                </div>
              </div>
              
              {/* Application Steps */}
              {applicationResult.steps.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Steps Completed</h4>
                  <ul className="space-y-2">
                    {applicationResult.steps.map((step, index) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-2 mt-0.5">
                          <span className="text-xs font-medium text-blue-800 dark:text-blue-300">{index + 1}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{step}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Obstacles */}
              {applicationResult.obstacles.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Obstacles Encountered</h4>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-3">
                    <ul className="space-y-2 text-sm text-red-700 dark:text-red-300">
                      {applicationResult.obstacles.map((obstacle, index) => (
                        <li key={index} className="flex items-start">
                          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                          <span>{obstacle}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Information about auto-apply */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <InfoIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            About Auto Apply
          </h2>
        </div>
        
        <div className="p-4">
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <p>
              <strong>How it works:</strong> Auto Apply uses AI to automate the job application process. It attempts to navigate job application forms, fill them out with your resume information, and submit them on your behalf.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                  Benefits
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Save time by automating repetitive application processes</span>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Apply to more positions in less time</span>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Automatic tracking of applied positions</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-400" />
                  Limitations
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span>May not work with all application systems, especially those requiring login</span>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span>Cannot complete CAPTCHA challenges or phone verification</span>
                  </li>
                  <li className="flex items-start">
                    <div className="flex-shrink-0 h-4 w-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mr-2 mt-0.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <span>May have difficulty with complex multi-step applications</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> For best results, ensure your resume is up-to-date in the Resume Builder and you have provided a direct application URL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Info icon component
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
} 