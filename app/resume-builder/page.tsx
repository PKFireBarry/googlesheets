'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseResumeFile } from '../utils/resumeParser';
import { generateResumeFile } from '../utils/resumeGenerator';
import { ResumeData, PersonalInfo } from '../types/resume';
import { toast, Toaster } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { saveResume, loadResume, deleteResume, resumeExists } from '../utils/resumeStorage';

// Component for the Resume Builder page
function ResumeBuilderContent(): React.ReactElement {
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
    skills?: string | string[];
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
  const [showJobForm, setShowJobForm] = useState<boolean>(false);
  const [manualJobData, setManualJobData] = useState<{
    title: string;
    description: string;
    skills: string;
    company: string;
  }>({
    title: '',
    description: '',
    skills: '',
    company: ''
  });
  
  // Add state for checking if master resume exists
  const [masterResumeExists, setMasterResumeExists] = useState<boolean>(false);
  
  // Add state for confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // Function to load the master resume
  const loadExistingResume = () => {
    try {
      const { resumeData, resumePdfData: pdfData } = loadResume();
      
      if (resumeData) {
        // For parsed resume data
        setMasterResume(resumeData);
        
        // Pre-fill personal info
        setPersonalInfo({
          name: resumeData.name || '',
          email: resumeData.contact?.email || '',
          phone: resumeData.contact?.phone || '',
          location: resumeData.contact?.location || '',
          linkedin: resumeData.contact?.linkedin || '',
          website: resumeData.contact?.website || ''
        });
        
        // Move to step 2
        setStep(2);
        toast.success('Your resume has been loaded from storage');
      } else if (pdfData) {
        // For PDF data
        setResumePdfData(pdfData);
        
        // Pre-fill empty personal info (will be extracted during processing)
        setPersonalInfo({
          name: '',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
          website: ''
        });
        
        // Move to step 2
        setStep(2);
        toast.success('Your PDF resume has been loaded from storage');
      } else {
        throw new Error('No resume found in storage');
      }
    } catch (e) {
      console.error('Error loading stored resume:', e);
      setError('Failed to load your stored resume. Please upload it again.');
    }
  };
  
  // Function to delete the saved resume
  const deleteSavedResume = () => {
    try {
      // Remove the resume from localStorage
      const success = deleteResume();
      
      if (success) {
        // Update UI state
        setMasterResumeExists(false);
        
        // Show success message
        toast.success('Your saved resume has been deleted');
        
        console.log('Deleted resume from localStorage');
      } else {
        throw new Error('Failed to delete resume');
      }
    } catch (e) {
      console.error('Error deleting resume:', e);
      toast.error('Failed to delete your saved resume');
    }
  };
  
  // Format skills for display - helper function
  const formatSkills = (skills: string | string[] | undefined): string => {
    if (!skills) return '';
    
    if (typeof skills === 'string') {
      if (skills.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(skills);
          return Array.isArray(parsed) 
            ? parsed.map((skill: string) => skill.trim()).filter(Boolean).join(', ')
            : skills;
        } catch {
          return skills;
        }
      }
      return skills;
    } 
    
    if (Array.isArray(skills)) {
      return skills.join(', ');
    }
    
    return String(skills);
  };
  
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
  
  // Handle manual job data changes
  const handleManualJobChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setManualJobData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle manual job submission
  const handleManualJobSubmit = () => {
    // Validate required fields
    if (!manualJobData.title || !manualJobData.company) {
      setError('Please fill in at least the job title and company name.');
      return;
    }

    // Format the skills as an array if they were entered as comma-separated
    const formattedSkills = manualJobData.skills
      ? manualJobData.skills
          .split(',')
          .map(skill => skill.trim())
          .filter(Boolean)
      : [];

    // Set the selected job with manual data
    setSelectedJob({
      title: manualJobData.title,
      job_title: manualJobData.title,
      description: manualJobData.description,
      job_description: manualJobData.description,
      requirements: '',
      skills: formattedSkills,
      company: manualJobData.company,
      company_name: manualJobData.company
    });

    // Hide the form
    setShowJobForm(false);
    setError(null);
  };

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
          // Do NOT automatically show job form - leave it collapsed by default
          setShowJobForm(false);
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
    
    // Debug logging for finding sheets
    console.log('Checking for sheet URL in cookie:', Cookies.get('lastSheetUrl'));
    console.log('Checking for sheet URL in localStorage:', localStorage.getItem('lastSheetUrl'));
    
    // Check for existing resume - moved to its own useEffect for focus
    loadJobs();
    loadApiKey();
  }, [jobId, searchParams, apiKey]);
  
  // Dedicated useEffect for checking and loading existing resume
  useEffect(() => {
    console.log('Checking for existing resume...');
    // Debug function to show all storage contents
    const debugStorage = () => {
      console.log('--- DEBUG: LocalStorage Contents ---');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            console.log(`${key}: ${value?.substring(0, 50)}${value && value.length > 50 ? '...' : ''}`);
          } catch (e) {
            console.log(`${key}: [Error reading value]`);
          }
        }
      }
      console.log('--- DEBUG: Cookies ---');
      console.log('Cookie string:', document.cookie);
      console.log('lastSheetUrl from cookie:', Cookies.get('lastSheetUrl'));
      console.log('------------------------');
    };
    
    // Call debug function
    debugStorage();
    
    // Check if resume exists
    const exists = resumeExists();
    setMasterResumeExists(exists);
    
    if (exists) {
      // Auto-load the resume if it exists
      const { resumeData, resumePdfData: pdfData } = loadResume();
      
      if (resumeData) {
        console.log('Auto-loading parsed resume data');
        setMasterResume(resumeData);
        
        // Pre-fill personal info
        setPersonalInfo({
          name: resumeData.name || '',
          email: resumeData.contact?.email || '',
          phone: resumeData.contact?.phone || '',
          location: resumeData.contact?.location || '',
          linkedin: resumeData.contact?.linkedin || '',
          website: resumeData.contact?.website || ''
        });
      } else if (pdfData) {
        console.log('Auto-loading PDF resume data');
        setResumePdfData(pdfData);
        
        // Pre-fill empty personal info (will be extracted during processing)
        setPersonalInfo({
          name: '',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
          website: ''
        });
      }
    } else {
      console.log('No resume found in storage');
    }
  }, []);
  
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
              
              // Store the resume for future use
              setTimeout(() => {
                saveResume(null, base64Data);
                setMasterResumeExists(true);
              }, 500);
              
              // Skip directly to step 2
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
        
        // Store the resume for future use
        setTimeout(() => {
          saveResume(parsedResume, null);
          setMasterResumeExists(true);
        }, 500);
        
        // Skip directly to step 2
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
    // Check if we have a resume and API key
    if ((!masterResume && !resumePdfData)) {
      setError('Please upload a resume before continuing.');
      return;
    }
    
    if (!apiKey && !localStorage.getItem('geminiApiKey')) {
      setError('Please provide a Gemini API key to continue.');
      return;
    }
    
    // Check if we have job details from either selectedJob or manualJobData
    const hasSelectedJob = !!selectedJob;
    const hasManualJobData = !!(manualJobData.title && manualJobData.company);
    
    if (!hasSelectedJob && !hasManualJobData) {
      setError('Please select a job or enter job details manually.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Extract job data to send to the API - either from selectedJob or manualJobData
      const jobData = hasSelectedJob 
        ? {
            title: selectedJob.title || selectedJob.job_title,
            description: selectedJob.description || selectedJob.job_description,
            requirements: selectedJob.requirements || '',
            skills: Array.isArray(selectedJob.skills) 
              ? selectedJob.skills.join(', ') 
              : formatSkills(selectedJob.skills) || '',
            company: selectedJob.company_name || selectedJob.company
          }
        : {
            title: manualJobData.title,
            description: manualJobData.description,
            requirements: '',
            skills: manualJobData.skills,
            company: manualJobData.company
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 max-w-4xl mx-auto border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Step 1: Upload Your Resume</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-mobile-sm">
              Upload your resume in PDF or DOCX format. This will be used to create a tailored resume
              that matches the job description.
            </p>
            
            {/* Display the selected job prominently if it exists */}
            {selectedJob && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Selected Job</h3>
                <div className="text-blue-700 dark:text-blue-300">
                  <p className="font-medium">{selectedJob.title || selectedJob.job_title} at {selectedJob.company_name || selectedJob.company}</p>
                  {(selectedJob.description || selectedJob.job_description) && (
                    <p className="text-sm mt-1 line-clamp-2">{selectedJob.description || selectedJob.job_description}</p>
                  )}
                  {selectedJob.skills && (
                    <p className="text-sm mt-1">
                      <span className="font-medium">Skills:</span> {formatSkills(selectedJob.skills)}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Job Details Form */}
            {showJobForm && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300">Enter Job Details</h3>
                  <button
                    onClick={() => setShowJobForm(false)}
                    className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      id="jobTitle"
                      name="title"
                      value={manualJobData.title}
                      onChange={handleManualJobChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Senior Software Engineer"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={manualJobData.company}
                      onChange={handleManualJobChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Google"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                      Job Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={manualJobData.description}
                      onChange={handleManualJobChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                      rows={4}
                      placeholder="Paste the job description here..."
                    />
                  </div>

                  <div>
                    <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">
                      Skills
                    </label>
                    <textarea
                      id="skills"
                      name="skills"
                      value={manualJobData.skills}
                      onChange={handleManualJobChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                      rows={2}
                      placeholder="JavaScript, React, TypeScript, etc."
                    />
                    <p className="text-xs text-gray-500 mt-1">Separate skills with commas</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleManualJobSubmit}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                    >
                      Save Job Details
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {!showJobForm && !selectedJob && (
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => setShowJobForm(true)}
                  className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Enter Job Details Manually
                </button>
              </div>
            )}
            
            {/* PDF support info box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-blue-800 dark:text-blue-300 text-sm flex items-start mt-2 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">📄 PDF Processing Feature</p>
                <p>Upload your resume as a PDF file to have it processed directly by Gemini AI. This allows for better recognition of formatting, tables, and visual elements in your resume!</p>
              </div>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
              {masterResumeExists ? (
                <div className="flex flex-col items-center">
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md text-green-800 dark:text-green-300 text-sm flex items-start mb-4 w-full max-w-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium">Previously uploaded resume found!</p>
                      <p>You can use your previously uploaded resume or upload a new one.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <button
                      onClick={loadExistingResume}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Use Previous Resume
                    </button>
                    <div className="relative">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf,.docx"
                        onChange={handleResumeUpload}
                        className="hidden"
                        id="resume-upload-new"
                      />
                      <label
                        htmlFor="resume-upload-new"
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload New Resume
                      </label>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Saved Resume
                    </button>
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Supported formats: PDF (recommended), DOCX</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mb-6 text-center w-full max-w-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">Upload Your Resume</h3>
                    <p className="text-blue-700 dark:text-blue-400 mb-4">Upload your resume to get started with personalizing it for job applications.</p>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.docx"
                      onChange={handleResumeUpload}
                      className="hidden"
                      id="resume-upload-new"
                    />
                    <label
                      htmlFor="resume-upload-new"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Select Resume File
                    </label>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Supported formats: PDF (recommended), DOCX</p>
                  </div>
                </div>
              )}
              
              {resumePdfData && (
                <div className="flex items-center justify-center text-sm text-green-600 mt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  PDF uploaded and ready for processing with Gemini AI
                </div>
              )}
            </div>
            
            {/* Delete confirmation dialog */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto shadow-xl border border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Delete Saved Resume?</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Are you sure you want to delete your saved resume? This action cannot be undone.
                  </p>
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        deleteSavedResume();
                        setShowDeleteConfirm(false);
                      }}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 2:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 max-w-4xl mx-auto border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Step 2: Job Details</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-mobile-sm">
              Review the job details below and make sure they're correct before generating your tailored resume.
            </p>
            
            {selectedJob && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Selected Job</h3>
                <div className="text-blue-700 dark:text-blue-300 space-y-2">
                  <p className="font-medium">{selectedJob.title || selectedJob.job_title} at {selectedJob.company_name || selectedJob.company}</p>
                  
                  {(selectedJob.description || selectedJob.job_description) && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Description:</p>
                      <p className="text-sm">{selectedJob.description || selectedJob.job_description}</p>
                    </div>
                  )}
                  
                  {selectedJob.requirements && selectedJob.requirements.trim() !== '' && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Requirements:</p>
                      <p className="text-sm">{selectedJob.requirements}</p>
                    </div>
                  )}
                  
                  {selectedJob.skills && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Skills:</p>
                      <p className="text-sm">
                        {formatSkills(selectedJob.skills)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {!selectedJob && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">No Job Selected</h3>
                <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                  You haven't selected a job or entered job details. Please go back to the previous step and enter job details manually.
                </p>
                <button
                  onClick={() => setStep(1)}
                  className="mt-3 inline-flex items-center px-3 py-1.5 border border-yellow-300 dark:border-yellow-600 rounded-md shadow-sm text-xs font-medium text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/40 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  Go Back
                </button>
              </div>
            )}
            
            <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Contact Information</h3>
              <p className="text-blue-700 dark:text-blue-300">
                Your contact information will be automatically extracted from your uploaded {resumePdfData ? 'PDF' : 'resume'}.
                You don't need to enter it manually.
              </p>
            </div>
            
            {!apiKey && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Gemini API Key</h3>
                <div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your Gemini API key"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Your API key is stored locally and never sent to our servers. You can get a free Gemini API key from{' '}
                    <a
                      href="https://makersuite.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Google&apos;s Maker Suite
                    </a>.
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Back
              </button>
              
              <button
                onClick={handleGenerateResume}
                disabled={isLoading || (!selectedJob && !showJobForm)}
                className={`${
                  isLoading ? 'bg-blue-400' : (!selectedJob && !showJobForm) ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 max-w-4xl mx-auto border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Step 3: Your Tailored Resume</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-mobile-sm">
              Your tailored resume is ready! Review the changes and download it in your preferred format.
            </p>
            
            {tailoringNotes && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tailoring Notes</h3>
                <p className="text-yellow-700 dark:text-yellow-400 text-sm">{tailoringNotes}</p>
              </div>
            )}
            
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-white dark:bg-gray-800 shadow-sm">
              <h3 className="font-semibold text-xl mb-3">{generatedResume?.name}</h3>
              
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {generatedResume?.contact.email} • {generatedResume?.contact.phone} • {generatedResume?.contact.location}
                {generatedResume?.contact.linkedin && ` • ${generatedResume.contact.linkedin}`}
                {generatedResume?.contact.website && ` • ${generatedResume.contact.website}`}
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-1">Summary</h4>
                <p className="text-gray-700 dark:text-gray-300">{generatedResume?.summary}</p>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold mb-1">Skills</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {generatedResume?.skills && Array.isArray(generatedResume.skills) 
                    ? generatedResume.skills.join(', ')
                    : formatSkills(generatedResume?.skills)}
                </p>
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
                } text-white px-4 py-2 sm:px-6 sm:py-3 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
              >
                {isLoading ? 'Downloading...' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download as PDF
                  </>
                )}
              </button>
              
              <button
                onClick={() => handleDownloadResume('docx')}
                disabled={isLoading}
                className={`${
                  isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-4 py-2 sm:px-6 sm:py-3 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {isLoading ? 'Downloading...' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download as DOCX
                  </>
                )}
              </button>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Back
              </button>
              
              <button
                onClick={handleStartOver}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 no-overflow mobile-container">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">Resume Builder</h1>
              <p className="text-mobile-sm text-blue-100 max-w-2xl">
                Studies show that 61% of recruiters spend 5 seconds on initial screening. Tailored resumes with relevant keywords are more likely to pass Applicant Tracking Systems and get you the interview.
              </p>
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex justify-between mb-2">
            {['Upload Resume', 'Job Details', 'Download'].map((stepTitle, index) => (
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative flex items-center" role="alert">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Resume Builder...</p>
        </div>
      </div>
    }>
      <ResumeBuilderContent />
    </Suspense>
  );
} 