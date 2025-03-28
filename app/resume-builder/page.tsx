'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseResumeFile } from '../utils/resumeParser';
import { generateResumeFile } from '../utils/resumeGenerator';
import { ResumeData, PersonalInfo } from '../types/resume';
import { toast, Toaster } from 'react-hot-toast';

// Component for the Resume Builder page
function ResumeBuilderContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  
  // State variables
  const [step, setStep] = useState<number>(1);
  const [masterResume, setMasterResume] = useState<ResumeData | null>(null);
  const [resumePdfData, setResumePdfData] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<{
    title?: string;
    job_title?: string;
    description?: string;
    job_description?: string;
    requirements?: string;
    skills?: string;
    company?: string;
    company_name?: string;
    id?: string;
    jobId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [generatedResume, setGeneratedResume] = useState<ResumeData | null>(null);
  const [tailoringNotes, setTailoringNotes] = useState<string>('');
  
  // Personal info state
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load jobs and job details directly from the URL parameter
  useEffect(() => {
    const loadJobs = async () => {
      try {
        // If jobId is provided in the URL, load just that job
        if (jobId) {
          let jobData = null;
          
          // Try to find the job in different storage locations
        const savedJobsData = localStorage.getItem('savedJobs');
        if (savedJobsData) {
          try {
            const savedJobs = JSON.parse(savedJobsData);
            if (savedJobs && typeof savedJobs === 'object') {
                // Find the job with the matching id
                const job = savedJobs[jobId];
                if (job) {
                  console.log('Found job from URL parameter:', job.title || job.job_title);
                  setSelectedJob(job);
                  // No need to load all other jobs since we're going directly to customize step
                  return;
                }
            }
          } catch (e) {
            console.error('Error parsing savedJobs:', e);
          }
        }
        
          // If job not found in savedJobs, look in other storage locations
          const storedData = localStorage.getItem('jobData');
          if (storedData) {
            try {
              const parsedData = JSON.parse(storedData);
              if (Array.isArray(parsedData) && parsedData.length > 0) {
                // Find the job with the matching id
                const job = parsedData.find(j => j.id === jobId || j.jobId === jobId);
                if (job) {
                  console.log('Found job from URL parameter in jobData:', job.title || job.job_title);
                  setSelectedJob(job);
                  return;
                }
            }
          } catch (e) {
              console.error('Error parsing jobData:', e);
            }
          }
          
          console.warn('Job not found with ID:', jobId);
        } else {
          console.log('No job ID provided, user will need to choose a job manually');
        }
      } catch (error) {
        console.error('Error loading job data:', error);
        setError('Failed to load job data. Please try again.');
      }
    };
    
    // Load API key from various sources
    const loadApiKey = () => {
      // First, check if API key is in URL query params
      const apiKeyParam = searchParams.get('apiKey') || searchParams.get('geminiApiKey') || searchParams.get('key');
      if (apiKeyParam) {
        console.log('Found API key in URL query parameters');
        setApiKey(apiKeyParam);
        // Save to localStorage for future use
        localStorage.setItem('geminiApiKey', apiKeyParam);
        return;
      }
      
      // Check localStorage and cookies for the API key
      const storedApiKey = localStorage.getItem('geminiApiKey');
      if (storedApiKey) {
        console.log('Found API key in localStorage');
        setApiKey(storedApiKey);
        return;
      }
      
      // Try other common API key storage locations
      ['apiKey', 'googleApiKey', 'GEMINI_API_KEY', 'gemini_api_key'].forEach(keyName => {
        const keyValue = localStorage.getItem(keyName);
        if (keyValue && !apiKey) {
          console.log(`Found API key in localStorage (${keyName})`);
          setApiKey(keyValue);
        }
      });
      
      // Check cookies for API key
      const getCookieValue = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return parts.pop()?.split(';').shift() || '';
        }
        return '';
      };
      
      const cookieValue = getCookieValue('geminiApiKey');
        if (cookieValue) {
        console.log('Found API key in cookies');
          setApiKey(cookieValue);
      }
    };
    
    loadJobs();
    loadApiKey();
  }, [jobId, searchParams, apiKey]);
  
  // Handle resume file upload
  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (file.type === 'application/pdf') {
        // For PDF files, convert to base64 and keep the binary data for the API
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
          try {
            const base64Data = e.target?.result?.toString().split(',')[1]; // Extract base64 content
            
            // Store the PDF data for later API call
            if (base64Data) {
              setResumePdfData(base64Data);
              
              // Clear any previously parsed resume data
              setMasterResume(null);
              
              // Show success message
              toast.success(`PDF "${file.name}" will be sent to Gemini for processing`, {
                icon: "📄",
                duration: 3000
              });
              
              // Pre-fill personal info with empty values
              // We'll extract this from the PDF during AI processing
              setPersonalInfo({
                name: '',
                email: '',
                phone: '',
                location: '',
                linkedin: '',
                website: ''
              });
              
              // Skip directly to step 2 (customize - was step 3 before)
              setStep(2);
            } else {
              toast.error("Failed to extract PDF data");
              setError('Failed to extract PDF data. Please try a different file.');
            }
          } catch (error) {
            console.error("Error processing PDF:", error);
            setError('Error processing PDF. Please try a different file.');
          } finally {
            setIsLoading(false);
          }
        };
        
        fileReader.onerror = () => {
          toast.error("Failed to read PDF file");
          setError('Failed to read PDF file. Please try a different file.');
          setIsLoading(false);
        };
        
        fileReader.readAsDataURL(file);
      } else {
        // For other formats, use the existing parser
      const parsedResume = await parseResumeFile(file);
      setMasterResume(parsedResume);
        
        // Clear any previously stored PDF data
        setResumePdfData(null);
      
      // Pre-fill personal info from the parsed resume
      setPersonalInfo({
        name: parsedResume.name || '',
        email: parsedResume.contact.email || '',
        phone: parsedResume.contact.phone || '',
        location: parsedResume.contact.location || '',
        linkedin: parsedResume.contact.linkedin || '',
        website: parsedResume.contact.website || ''
      });
      
        // Skip directly to step 2 (customize - was step 3 before)
      setStep(2);
      }
    } catch (error) {
      console.error('Error processing resume:', error);
      setError('Failed to process the resume. Please try a different file or format.');
      setIsLoading(false);
    }
  };
  
  // Handle API key input
  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setApiKey(value);
    
    // Store the API key in localStorage for future use
    if (value) {
      localStorage.setItem('geminiApiKey', value);
    }
  };
  
  // Generate the tailored resume
  const handleGenerateResume = async () => {
    if ((!masterResume && !resumePdfData) || !selectedJob || (!apiKey && !localStorage.getItem('geminiApiKey'))) {
      setError('Please upload a resume, select a job, and provide a Gemini API key.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Extract job data to send to the API
      const jobData = {
        title: selectedJob.title || selectedJob.job_title,
        description: selectedJob.description || selectedJob.job_description,
        requirements: selectedJob.requirements || '',
        skills: selectedJob.skills || '',
        company: selectedJob.company_name || selectedJob.company
      };
      
      // Call the resume API
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData: masterResume,
          resumePdfData: resumePdfData,
          jobData,
          apiKey,
          personalInfo,
          preserveEmploymentHistory: true // Add this flag to preserve accurate employment dates
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate resume');
      }
      
      const data = await response.json();
      
      // Store the tailoring notes and set the generated resume
      setTailoringNotes(data.tailoringNotes || '');
      setGeneratedResume(data);
      
      // Move to the next step
      setStep(3);
    } catch (error) {
      console.error('Error generating resume:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle downloading the resume
  const handleDownloadResume = async (format: 'pdf' | 'docx') => {
    if (!generatedResume) {
      setError('No resume to download. Please generate a resume first.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Generate a filename based on the job and person's name
      const jobTitle = selectedJob?.title || selectedJob?.job_title || 'job';
      const company = selectedJob?.company_name || selectedJob?.company || 'company';
      
      const cleanJobTitle = jobTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const cleanCompany = company.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const firstName = personalInfo?.name ? personalInfo.name.split(' ')[0] : 'resume';
      const filename = `${firstName}-${cleanJobTitle}-${cleanCompany}`;
      
      // Generate the file and trigger the download
      await generateResumeFile(generatedResume, { format, filename });
    } catch (error) {
      console.error('Error downloading resume:', error);
      setError('Failed to download the resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle starting over
  const handleStartOver = () => {
    // Reset all state
    setStep(1);
    setMasterResume(null);
    setSelectedJob(null);
    setGeneratedResume(null);
    setTailoringNotes('');
    setError(null);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Render different steps of the process
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Step 1: Upload Your Resume</h2>
            <p className="text-gray-600 mb-6">
              Upload your resume in PDF or DOCX format. This will be used to create a tailored resume
              that matches the job description.
            </p>
            
            {/* PDF support info box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-blue-800 dark:text-blue-300 text-sm flex items-start mt-2 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">📄 PDF Processing Feature</p>
                <p>Upload your resume as a PDF file to have it processed directly by Gemini AI. This allows for better recognition of formatting, tables, and visual elements in your resume!</p>
              </div>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="hidden"
                id="resume-upload"
              />
              <label
                htmlFor="resume-upload"
                className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-700 transition"
              >
                Select Resume File
              </label>
              <p className="mt-2 text-sm text-gray-500">Supported formats: PDF (recommended), DOCX</p>
              
              {resumePdfData && (
                <div className="flex items-center justify-center text-sm text-green-600 mt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  PDF uploaded and ready for processing with Gemini AI
                </div>
              )}
            </div>
            
            {selectedJob && (
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-800">Selected Job</h3>
                <p className="text-blue-700">
                  {selectedJob.title || selectedJob.job_title} at {selectedJob.company_name || selectedJob.company}
                </p>
              </div>
            )}
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Why Tailor Your Resume?</h3>
              <p className="text-gray-700 text-sm">
                Studies show that 61% of employees believe tailoring your resume for each specific job is the best way to ensure its effectiveness.
                Recruiters often spend as little as 5 seconds on initial screening, and applications that do not contain relevant keywords may be
                filtered out by Applicant Tracking Systems (ATS) before a human even sees them.
              </p>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Step 2: Customize Your Resume</h2>
            <p className="text-gray-600 mb-6">
              Provide your Gemini API key to generate your tailored resume.
            </p>
            
            <div className="mb-6 bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">Contact Information</h3>
              <p className="text-blue-700">
                Your contact information will be automatically extracted from your uploaded {resumePdfData ? 'PDF' : 'resume'}.
                You don't need to enter it manually.
              </p>
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Gemini API Key</h3>
              <div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter your Gemini API key"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Your API key is stored locally and never sent to our servers. You can get a free Gemini API key from{' '}
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Google&apos;s Maker Suite
                  </a>.
                </p>
              </div>
            </div>
            
            {selectedJob && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-blue-800">Selected Job</h3>
              <p className="text-blue-700">
                {selectedJob.title || selectedJob.job_title} at {selectedJob.company_name || selectedJob.company}
              </p>
            </div>
            )}
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
              >
                Back
              </button>
              
              <button
                onClick={handleGenerateResume}
                disabled={isLoading}
                className={`${
                  isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-4 py-2 rounded transition flex items-center`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate Tailored Resume'
                )}
              </button>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Step 3: Your Tailored Resume</h2>
            <p className="text-gray-600 mb-6">
              Your tailored resume is ready! Review the changes and download it in your preferred format.
            </p>
            
            {tailoringNotes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-800 mb-2">Tailoring Notes</h3>
                <p className="text-yellow-700 text-sm">{tailoringNotes}</p>
              </div>
            )}
            
            <div className="border rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-xl mb-3">{generatedResume?.name}</h3>
              
              <div className="text-sm text-gray-600 mb-4">
                {generatedResume?.contact.email} • {generatedResume?.contact.phone} • {generatedResume?.contact.location}
                {generatedResume?.contact.linkedin && ` • ${generatedResume.contact.linkedin}`}
                {generatedResume?.contact.website && ` • ${generatedResume.contact.website}`}
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-1">Summary</h4>
                <p className="text-gray-700">{generatedResume?.summary}</p>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-1">Skills</h4>
                <p className="text-gray-700">{generatedResume?.skills.join(', ')}</p>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Experience</h4>
                {generatedResume?.experience.map((exp, index) => (
                  <div key={index} className="mb-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium">{exp.title}</div>
                      <div className="text-sm text-gray-500">{exp.dates}</div>
                    </div>
                    <div className="text-sm text-gray-600 italic">{exp.company}, {exp.location}</div>
                    <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                      {exp.highlights.map((highlight, i) => (
                        <li key={i}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              
              <div className="preview-truncated text-center py-4 border-t border-dashed">
                <p className="text-gray-500">Resume preview is truncated. Download to see the full resume.</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <button
                onClick={() => handleDownloadResume('pdf')}
                disabled={isLoading}
                className={`${
                  isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
                } text-white px-6 py-3 rounded transition flex items-center justify-center`}
              >
                {isLoading ? 'Downloading...' : 'Download as PDF'}
              </button>
              
              <button
                onClick={() => handleDownloadResume('docx')}
                disabled={isLoading}
                className={`${
                  isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-6 py-3 rounded transition flex items-center justify-center`}
              >
                {isLoading ? 'Downloading...' : 'Download as DOCX'}
              </button>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
              >
                Back
              </button>
              
              <button
                onClick={handleStartOver}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
              >
                Start Over
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Builder</h1>
          <p className="text-gray-600">Create a tailored resume for your job application</p>
        </div>
        
        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex justify-between mb-2">
            {['Upload Resume', 'Customize', 'Download'].map((stepTitle, index) => (
              <div
                key={index}
                className={`text-sm font-medium ${
                  step > index + 1 ? 'text-blue-600' : step === index + 1 ? 'text-blue-800' : 'text-gray-400'
                }`}
              >
                {stepTitle}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {/* Step content */}
        {renderStep()}
      </div>
    </div>
  );
}

export default function ResumeBuilderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResumeBuilderContent />
    </Suspense>
  );
} 