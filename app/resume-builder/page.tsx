'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseResumeFile } from '../utils/resumeParser';
import { generateResumeFile } from '../utils/resumeGenerator';
import { ResumeData, PersonalInfo } from '../types/resume';
import { toast, Toaster } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { saveResume, loadResume, deleteResume, resumeExists, getResumeStorageKey } from '../utils/resumeStorage';
import ResumeStorageUI from '../components/ResumeStorageUI';

// Import our new components
import PageHeader from '../components/resume/PageHeader';
import ProgressBar from '../components/resume/ProgressBar';
import ResumeUpload from '../components/resume/ResumeUpload';
import JobDetailsForm from '../components/resume/JobDetailsForm';
import ApiKeyConfiguration from '../components/resume/ApiKeyConfiguration';
import TailoredResume from '../components/resume/TailoredResume';
import ActionButtons from '../components/resume/ActionButtons';
import DeleteConfirmDialog from '../components/resume/DeleteConfirmDialog';
import ErrorDisplay from '../components/resume/ErrorDisplay';
import ResumeEditor from '../components/resume/ResumeEditor';
import ResumePreview from '../components/resume/ResumePreview';

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
  
  // Add state for active tab in the upload section
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Personal info state
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  });
  
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
    
    // Load API key from localStorage or cookie
    const loadApiKey = () => {
      // First try from cookie (cross-page consistency)
      const cookieApiKey = Cookies.get('geminiApiKey');
      if (cookieApiKey) {
        setApiKey(cookieApiKey);
        console.log('API key loaded from cookie');
        return;
      }
      
      // Fall back to localStorage
      const localStorageApiKey = localStorage.getItem('geminiApiKey');
      if (localStorageApiKey) {
        setApiKey(localStorageApiKey);
        console.log('API key loaded from localStorage');
        
        // Also save to cookie for cross-page consistency
        Cookies.set('geminiApiKey', localStorageApiKey, { expires: 30 });
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
    // Check if resume exists
    const exists = resumeExists();
    setMasterResumeExists(exists);
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
      
      console.log('🚀 Starting resume generation...');
      console.log('📋 Request payload:');
      console.log('  - Master resume:', masterResume ? 'Present' : 'Missing');
      console.log('  - PDF data:', resumePdfData ? 'Present' : 'Missing');
      console.log('  - Job data:', jobData);
      console.log('  - API key:', apiKey ? 'Present' : 'Missing');
      console.log('  - Personal info:', personalInfo);

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
      
      console.log('📡 API Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || 'Failed to generate resume');
      }
      
      const data = await response.json();
      console.log('✅ Received tailored resume data from API:');
      console.log('📊 Response structure:');
      console.log('  - Name:', data.name);
      console.log('  - Contact:', data.contact ? 'Present' : 'Missing');
      console.log('  - Summary length:', data.summary ? data.summary.length : 0, 'characters');
      console.log('  - Skills count:', Array.isArray(data.skills) ? data.skills.length : 0);
      console.log('  - Experience entries:', Array.isArray(data.experience) ? data.experience.length : 0);
      console.log('  - Education entries:', Array.isArray(data.education) ? data.education.length : 0);
      console.log('  - Project entries:', Array.isArray(data.projects) ? data.projects.length : 0);
      console.log('  - Certification entries:', Array.isArray(data.certifications) ? data.certifications.length : 0);
      console.log('  - Tailoring notes:', data.tailoringNotes ? 'Present' : 'Missing');
      
      // Log detailed structure
      if (Array.isArray(data.experience)) {
        data.experience.forEach((exp: any, index: number) => {
          console.log(`  📋 Experience ${index + 1}:`, exp.title, 'at', exp.company);
          console.log(`    - Dates:`, exp.dates);
          console.log(`    - Location:`, exp.location);
          console.log(`    - Highlights:`, Array.isArray(exp.highlights) ? exp.highlights.length : 0, 'items');
        });
      }
      
      if (Array.isArray(data.education)) {
        data.education.forEach((edu: any, index: number) => {
          console.log(`  🎓 Education ${index + 1}:`, edu.degree, 'from', edu.institution);
          console.log(`    - Location:`, edu.location);
          console.log(`    - Dates:`, edu.dates);
          console.log(`    - Details:`, Array.isArray(edu.details) ? edu.details.length : 0, 'items');
        });
      }
      
      if (Array.isArray(data.projects)) {
        data.projects.forEach((project: any, index: number) => {
          console.log(`  🚀 Project ${index + 1}:`, project.name);
          console.log(`    - Technologies:`, Array.isArray(project.technologies) ? project.technologies.length : 0, 'items');
          console.log(`    - Highlights:`, Array.isArray(project.highlights) ? project.highlights.length : 0, 'items');
          console.log(`    - Description:`, project.description ? 'Present' : 'Missing');
        });
      }
      
      // Store the tailoring notes and set the generated resume
      setTailoringNotes(data.tailoringNotes || '');
      setGeneratedResume(data);
      
      console.log('💾 Stored resume data in state');
      
      // Move to the edit step (step 3)
      setStep(3);
    } catch (error) {
      console.error('Error generating resume:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle saving edited resume
  const handleSaveEditedResume = (updatedResume: ResumeData) => {
    setGeneratedResume(updatedResume);
    // Move to the preview and download step
    setStep(4);
    toast.success('Your changes have been saved');
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
  
  // Render the resume builder
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 no-overflow mobile-container">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <PageHeader />
        
        {/* Progress Bar */}
        <div className="mb-8">
          <ProgressBar 
            currentStep={step} 
            totalSteps={4} 
            stepTitles={['Upload Resume', 'Job Details', 'Edit Resume', 'Preview & Download']} 
          />
        </div>
        
        {/* Error Display */}
        <ErrorDisplay error={error} />
        
        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-5xl mx-auto border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
          {step === 1 && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Step 1: Upload or Create a Resume</h2>
                <p className="text-gray-600 dark:text-gray-400">Get started by uploading your existing resume or entering job details manually.</p>
              </div>
              
              <div className="mb-6">
                <ResumeUpload 
                  onUpload={handleResumeUpload}
                  isLoading={isLoading}
                  resumePdfData={resumePdfData}
                  masterResumeExists={masterResumeExists}
                  onLoadExisting={loadExistingResume}
                  onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
                  activeTab={activeTab}
                  onTabChange={(tab) => setActiveTab(tab)}
                />
                
                {activeTab === 'manual' && (
                  <JobDetailsForm 
                    manualJobData={manualJobData}
                    onChange={handleManualJobChange}
                    onSubmit={handleManualJobSubmit}
                    selectedJob={selectedJob}
                    formatSkills={formatSkills}
                  />
                )}
              </div>
            </>
          )}
          
          {step === 2 && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Step 2: Job Details</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Review the job details below and make sure they're correct before generating your tailored resume.
                </p>
              </div>
              
              <JobDetailsForm 
                manualJobData={manualJobData}
                onChange={handleManualJobChange}
                onSubmit={handleManualJobSubmit}
                selectedJob={selectedJob}
                formatSkills={formatSkills}
              />
              
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Contact Information</h3>
                <p className="text-blue-700 dark:text-blue-300">
                  Your contact information will be automatically extracted from your uploaded {resumePdfData ? 'PDF' : 'resume'}.
                  You don't need to enter it manually.
                </p>
              </div>
              
              {!apiKey && (
                <ApiKeyConfiguration
                  apiKey={apiKey}
                  onChange={handleApiKeyChange}
                />
              )}
              
              <ActionButtons 
                step={step}
                onPrevious={() => setStep(1)}
                onNext={handleGenerateResume}
                nextLabel="Generate Tailored Resume"
                isLoading={isLoading}
                isNextDisabled={!selectedJob && !showJobForm}
                nextDisabledReason="Please select a job or enter job details"
              />
            </>
          )}
          
          {step === 3 && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Step 3: Edit Your Resume</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Your tailored resume has been generated. Make any necessary edits before proceeding to the preview.
                </p>
              </div>
              
              {tailoringNotes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tailoring Notes</h3>
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm">{tailoringNotes}</p>
                </div>
              )}
              
              <ResumeEditor 
                generatedResume={generatedResume}
                onSaveChanges={handleSaveEditedResume}
                isLoading={isLoading}
              />
              
              <ActionButtons 
                step={step}
                onPrevious={() => setStep(2)}
                onNext={() => setStep(4)}
                nextLabel="Continue to Preview"
                isLoading={isLoading}
              />
            </>
          )}
          
          {step === 4 && (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Step 4: Preview & Download</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Your tailored resume is ready! Preview how it will look and download it in your preferred format.
                </p>
              </div>
              
              <ResumePreview 
                resumeData={generatedResume}
                isLoading={isLoading}
              />
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={() => handleDownloadResume('pdf')}
                  disabled={isLoading}
                  className={`${
                    isLoading 
                      ? 'bg-green-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transform hover:scale-105'
                  } text-white px-6 py-4 border border-transparent rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-green-500/50 space-x-2`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download as PDF</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleDownloadResume('docx')}
                  disabled={isLoading}
                  className={`${
                    isLoading 
                      ? 'bg-blue-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105'
                  } text-white px-6 py-4 border border-transparent rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-blue-500/50 space-x-2`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Downloading...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download as DOCX</span>
                    </>
                  )}
                </button>
              </div>
              
              <ActionButtons 
                step={step}
                onPrevious={() => setStep(3)}
                onStartOver={handleStartOver}
              />
            </>
          )}
        </div>
        
        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          show={showDeleteConfirm}
          onConfirm={() => {
            deleteSavedResume();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
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