'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { ResumeData, PersonalInfo } from '../types/resume';
import { loadResume, saveResume } from '../utils/resumeStorage';
import { pollAutoApplyStatus } from '../utils/polling';

// Import components
import PageHeader from '../components/auto-apply/PageHeader';
import ProgressBar from '../components/resume/ProgressBar';
import ResumeUpload from '../components/auto-apply/ResumeUpload';
import JobDetailsForm from '../components/auto-apply/JobDetailsForm';
import ApiKeyConfiguration from '../components/auto-apply/ApiKeyConfiguration';
import TailoredResume from '../components/resume/TailoredResume';
import ActionButtons from '../components/auto-apply/ActionButtons';
import ErrorDisplay from '../components/resume/ErrorDisplay';
import AutoApplyStatus from '../components/auto-apply/AutoApplyStatus';
import ActionButton from '../components/ActionButton';
import { Download } from 'lucide-react';

// Define the props for the components to fix type errors
interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  steps?: string[];
}

interface ResumeUploadProps {
  onUploadResume?: (resumeData: ResumeData) => void;
  onUploadPdf?: (pdfData: string) => void;
  onNext?: () => void;
  hasExistingResume?: boolean;
  personalInfo?: PersonalInfo;
  onPersonalInfoChange?: (info: PersonalInfo) => void;
}

interface JobDetailsFormProps {
  selectedJob: any;
  onJobDataChange?: (jobData: any) => void;
}

interface ApiKeyConfigurationProps {
  apiKey: string;
  onChange?: (apiKey: string) => void;
}

function AutoApplyContent(): React.ReactElement {
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
    url?: string;
    company_website?: string;
    location?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [generatedResume, setGeneratedResume] = useState<ResumeData | null>(null);
  const [tailoringNotes, setTailoringNotes] = useState<string>('');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  });
  
  // Auto-apply specific states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string>('');
  const [uploadPrompt, setUploadPrompt] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

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

  // Debug function to list all localStorage keys and values related to resumes
  const debugLocalStorage = () => {
    console.log('===== DEBUG: Checking localStorage for resume data =====');
    
    // List all keys in localStorage
    console.log('All localStorage keys:');
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    console.log(allKeys);
    
    // Check for resume-related keys
    console.log('Resume-related keys:');
    const resumeKeys = allKeys.filter(key => 
      key.startsWith('masterResume') || 
      key.includes('resume') || 
      key === 'resumeData'
    );
    console.log(resumeKeys);
    
    // Log the content of each resume-related key
    resumeKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        console.log(`Key: ${key}, Value preview:`, value ? value.substring(0, 50) + '...' : 'null');
      } catch (e) {
        console.error(`Error reading key ${key}:`, e);
      }
    });
    
    console.log('===== END DEBUG =====');
  };

  // Create a sample resume if none is found
  const createSampleResume = () => {
    console.log('Creating a sample resume for testing');
    
    // Create a basic sample resume
    const sampleResume: ResumeData = {
      name: 'John Doe',
      contact: {
        email: 'john.doe@example.com',
        phone: '(123) 456-7890',
        location: 'San Francisco, CA',
        linkedin: 'linkedin.com/in/johndoe',
        website: 'johndoe.com'
      },
      summary: 'Experienced software engineer with expertise in web development and cloud technologies.',
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Company',
          location: 'San Francisco, CA',
          dates: 'January 2020 - Present',
          highlights: ['Led development of cloud-based applications using React and Node.js.']
        },
        {
          title: 'Software Developer',
          company: 'Startup Inc.',
          location: 'San Francisco, CA',
          dates: 'March 2018 - December 2019',
          highlights: ['Developed and maintained web applications using modern JavaScript frameworks.']
        }
      ],
      education: [
        {
          institution: 'University of Technology',
          degree: 'Bachelor of Science in Computer Science',
          location: 'San Francisco, CA',
          dates: '2014 - 2018',
          details: ['GPA: 3.8']
        }
      ]
    };
    
    // Save the sample resume
    saveResume(sampleResume, null);
    console.log('Sample resume created and saved');
    
    return sampleResume;
  };

  // Load job data from URL parameters
  useEffect(() => {
    if (jobId) {
      // Check if we have full job data in URL parameters
      const jobDataParam = searchParams.get('jobData');
      
      if (jobDataParam) {
        try {
          // Parse job data directly from URL parameter
          const decodedJobData = decodeURIComponent(jobDataParam);
          const parsedJobData = JSON.parse(decodedJobData);
          console.log('Job data loaded from URL parameter:', parsedJobData);
          
          // Set the job data directly
          setSelectedJob(parsedJobData);
          
          // Pre-fill upload prompt with job URL if available
          if (parsedJobData.company_website) {
            setUploadPrompt(
              `Resume and personal information needed for the application form.` 
            );
          } 
          setStep(2); // Move to job details step
        } catch (error) {
          console.error('Error parsing job data from URL:', error);

        }
      }  
    }
    
    // Debug localStorage
    debugLocalStorage();
    
    // Load API key from cookies or localStorage
    const cookieApiKey = Cookies.get('geminiApiKey');
    const localStorageApiKey = localStorage.getItem('geminiApiKey');
    
    if (cookieApiKey) {
      setApiKey(cookieApiKey);
      console.log('API key loaded from cookie');
    } else if (localStorageApiKey) {
      setApiKey(localStorageApiKey);
      console.log('API key loaded from localStorage');
      // Also save to cookie for cross-page consistency
      Cookies.set('geminiApiKey', localStorageApiKey, { expires: 30 });
    }
    
    // Check for existing resume - improved implementation
    try {
      console.log('Loading resume from storage...');
      const { resumeData, resumePdfData: pdfData } = loadResume();
      
      console.log('Resume data loaded:', resumeData ? 'Yes' : 'No');
      console.log('PDF data loaded:', pdfData ? 'Yes' : 'No');
      
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
        
        toast.success('Your PDF resume has been loaded from storage');
      } else {
        // No resume found, create a sample one for testing
        console.log('No resume found in storage, creating a sample resume');
        const sampleResume = createSampleResume();
        
        // Set the sample resume as the master resume
        setMasterResume(sampleResume);
        
        // Pre-fill personal info from the sample resume
        setPersonalInfo({
          name: sampleResume.name || '',
          email: sampleResume.contact?.email || '',
          phone: sampleResume.contact?.phone || '',
          location: sampleResume.contact?.location || '',
          linkedin: sampleResume.contact?.linkedin || '',
          website: sampleResume.contact?.website || ''
        });
        
        toast.success('A sample resume has been created for testing');
      }
    } catch (e) {
      console.error('Error loading stored resume:', e);
      // Create a sample resume on error
      console.log('Error occurred, creating a sample resume');
      const sampleResume = createSampleResume();
      
      // Set the sample resume as the master resume
      setMasterResume(sampleResume);
      
      // Pre-fill personal info from the sample resume
      setPersonalInfo({
        name: sampleResume.name || '',
        email: sampleResume.contact?.email || '',
        phone: sampleResume.contact?.phone || '',
        location: sampleResume.contact?.location || '',
        linkedin: sampleResume.contact?.linkedin || '',
        website: sampleResume.contact?.website || ''
      });
      
      toast.success('A sample resume has been created for testing');
    }
  }, [jobId, searchParams]);



  // Helper function to normalize URLs
  const normalizeUrl = (url: string): string => {
    if (!url) return '';
    
    // Trim whitespace
    url = url.trim();
    
    // Return empty string if URL is empty after trimming
    if (!url) return '';
    
    // Add https:// if no protocol is specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    
    return url;
  };

  // Handle API key change
  const handleApiKeyChange = (apiKey: string) => {
    setApiKey(apiKey);
    
    // Store the API key in both cookie and localStorage for cross-page consistency
    Cookies.set('geminiApiKey', apiKey, { expires: 30 });
    localStorage.setItem('geminiApiKey', apiKey);
  };

  // Generate tailored resume
  const handleGenerateResume = async () => {
    if (!selectedJob) {
      setError('Please provide job details first');
      return;
    }
    
    if (!masterResume && !resumePdfData) {
      setError('Please upload your resume first');
      return;
    }
    
    if (!apiKey) {
      setError('Please enter your Gemini API key');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Parse skills if they're in JSON string format
      let parsedSkills = selectedJob.skills;
      if (typeof selectedJob.skills === 'string' && selectedJob.skills.trim().startsWith('[')) {
        try {
          parsedSkills = JSON.parse(selectedJob.skills);
        } catch (e) {
          console.error('Failed to parse skills JSON:', e);
        }
      }

      console.log('Sending resume generation request with:', {
        hasMasterResume: !!masterResume,
        hasResumePdfData: !!resumePdfData,
        jobTitle: selectedJob.title || selectedJob.job_title,
        jobCompany: selectedJob.company_name || selectedJob.company,
        jobUrl: selectedJob.url || selectedJob.company_website || 'None',
        jobSkills: parsedSkills || 'None',
        hasPersonalInfo: !!personalInfo
      });
      
      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData: masterResume,
          resumePdfData: resumePdfData,
          jobData: {
            ...selectedJob,
            skills: parsedSkills
          },
          apiKey: apiKey,
          personalInfo: personalInfo
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from resume API:', errorData);
        throw new Error(errorData.error || 'Failed to generate resume');
      }
      
      const data = await response.json();
      console.log('Resume API response:', data);
      
      // Check if we received valid data - the API returns the resume data directly
      if (data && data.name && data.contact) {
        // This is a valid resume data object
        console.log('Valid resume data received directly');
        setGeneratedResume(data);
        setTailoringNotes(data.tailoringNotes || '');
        
        // Generate PDF for auto-apply
        console.log('Generating PDF...');
        const pdfResponse = await fetch('/api/resume/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumeData: data
          }),
        });
        
        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          console.log('PDF generated successfully:', pdfData.pdfUrl ? 'URL received' : 'No URL');
          setGeneratedPdfUrl(pdfData.pdfUrl);
        } else {
          console.error('Error generating PDF:', await pdfResponse.text());
        }
        
        setStep(3);
      } else if (data.resumeData) {
        // Handle legacy response format where data is nested under resumeData
        console.log('Legacy resume data format received (nested under resumeData)');
        setGeneratedResume(data.resumeData);
        setTailoringNotes(data.resumeData.tailoringNotes || '');
        
        // Generate PDF for auto-apply
        console.log('Generating PDF with legacy format...');
        const pdfResponse = await fetch('/api/resume/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumeData: data.resumeData
          }),
        });
        
        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          console.log('PDF generated successfully:', pdfData.pdfUrl ? 'URL received' : 'No URL');
          setGeneratedPdfUrl(pdfData.pdfUrl);
        } else {
          console.error('Error generating PDF:', await pdfResponse.text());
        }
        
        setStep(3);
      } else if (data.error) {
        // Handle error response
        console.error('Error in resume data:', data.error);
        throw new Error(data.error);
      } else {
        // Handle unexpected response format
        console.error('Unexpected response format:', data);
        throw new Error('Invalid response format from resume API');
      }
    } catch (error: any) {
      console.error('Error generating resume:', error);
      setError(error.message || 'Failed to generate resume');
    } finally {
      setIsLoading(false);
    }
  };

  // Start auto-apply process
  const handleStartAutoApply = async () => {
    if (!resumePdfData && !masterResume) {
      toast.error('Please upload a resume first');
      return;
    }

    if (!selectedJob || !selectedJob.url) {
      toast.error('Please enter job details with a valid URL');
      return;
    }

    try {
      setIsUploading(true);
      setUploadStatus('starting');
      setUploadError('');
      setUploadResult(null);

      // Prepare the prompt for auto-apply
      const finalPrompt = uploadPrompt || `Apply to the job using my resume information. Fill out all required fields.`;

      // Get the generated PDF URL if available, otherwise use the master resume
      const pdfUrl = generatedPdfUrl || resumePdfData;

      if (!pdfUrl) {
        setUploadError('No resume PDF available');
        setIsUploading(false);
        setUploadStatus('failed');
        return;
      }

      // Make the API call to start the auto-apply process
      const response = await fetch('/api/resume/auto-apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfUrl,
          prompt: finalPrompt,
          apiKey,
          jobData: selectedJob,
          url: selectedJob.url
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start auto-apply process');
      }

      const data = await response.json();
      
      // Check if we got a task ID for polling
      if (data.task_id) {
        setTaskId(data.task_id);
        // Start polling for status
        pollForStatus(data.task_id);
      } else {
        // Handle legacy response without polling
        setUploadResult(data.result);
        setUploadStatus('completed');
        setIsUploading(false);
        toast.success('Application submitted successfully!');
      }
    } catch (error: any) {
      console.error('Error starting auto-apply:', error);
      setUploadError(error.message || 'Failed to start auto-apply process');
      setIsUploading(false);
      setUploadStatus('failed');
    }
  };

  // Poll for upload status using our utility function
  const pollForStatus = async (id: string) => {
    try {
      // Set initial status to in_progress
      setUploadStatus('in_progress');
      
      // Use our polling utility
      pollAutoApplyStatus(id)
        .then(statusData => {
          console.log('Auto apply status:', statusData);
          setUploadStatus(statusData.status);
          
          if (typeof statusData.progress === 'number') {
            // Update progress if available
            setUploadProgress(statusData.progress);
          }
          
          if (statusData.status === 'completed') {
            setUploadResult(statusData.result);
            setIsUploading(false);
            setUploadProgress(100); // Ensure 100% on completion
            toast.success('Application submitted successfully!');
            
            // Mark job as applied if we have job details
            if (selectedJob && selectedJob.title && selectedJob.company_name) {
              const jobId = `${selectedJob.title}-${selectedJob.company_name}`.replace(/\s+/g, '-');
              
              // Get existing applied jobs from cookies
              const appliedJobsStr = Cookies.get('appliedJobs');
              const appliedJobs = appliedJobsStr ? JSON.parse(appliedJobsStr) : [];
              
              if (!appliedJobs.includes(jobId)) {
                appliedJobs.push(jobId);
                Cookies.set('appliedJobs', JSON.stringify(appliedJobs), { expires: 30 });
                console.log(`Marked job "${selectedJob.title}" as applied`);
              }
            }
          } else if (statusData.status === 'failed') {
            setUploadError(statusData.error || 'Upload failed');
            setIsUploading(false);
            toast.error('Application submission failed');
          }
        })
        .catch(error => {
          console.error('Error polling status:', error);
          setUploadError(error.message || 'Failed to check upload status');
          setIsUploading(false);
          setUploadStatus('failed');
        });
    } catch (error: any) {
      console.error('Error setting up polling:', error);
      setUploadError(error.message || 'Failed to check upload status');
      setIsUploading(false);
      setUploadStatus('failed');
    }
  };

  // Handle prompt change
  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadPrompt(e.target.value);
  };

  // Start over
  const handleStartOver = () => {
    setStep(1);
    setSelectedJob(null);
    setGeneratedResume(null);
    setTailoringNotes('');
    setUploadStatus('');
    setUploadResult(null);
    setUploadError('');
    setTaskId('');
    setGeneratedPdfUrl('');
    setUploadPrompt('');
  };

  // Handle PDF download
  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!generatedResume) {
      toast.error('No resume available to download');
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (format === 'pdf') {
        // If we already have a PDF URL, use it
        if (generatedPdfUrl) {
          // Create an anchor element and trigger download
          const link = document.createElement('a');
          link.href = generatedPdfUrl;
          link.download = `${generatedResume.name.replace(/\s+/g, '_')}_Resume.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast.success('PDF downloaded successfully');
        } else {
          // Generate a new PDF
          const pdfResponse = await fetch('/api/resume/generate-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              resumeData: generatedResume
            }),
          });
          
          if (pdfResponse.ok) {
            const pdfData = await pdfResponse.json();
            
            if (pdfData.pdfUrl) {
              setGeneratedPdfUrl(pdfData.pdfUrl);
              
              // Create an anchor element and trigger download
              const link = document.createElement('a');
              link.href = pdfData.pdfUrl;
              link.download = `${generatedResume.name.replace(/\s+/g, '_')}_Resume.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              
              toast.success('PDF downloaded successfully');
            } else {
              throw new Error('Failed to generate PDF');
            }
          } else {
            throw new Error('Failed to generate PDF');
          }
        }
      } else if (format === 'docx') {
        // For DOCX, we need to call a different endpoint
        const docxResponse = await fetch('/api/resume/generate-docx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumeData: generatedResume
          }),
        });
        
        if (docxResponse.ok) {
          const docxData = await docxResponse.json();
          
          if (docxData.docxUrl) {
            // Create an anchor element and trigger download
            const link = document.createElement('a');
            link.href = docxData.docxUrl;
            link.download = `${generatedResume.name.replace(/\s+/g, '_')}_Resume.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('DOCX downloaded successfully');
          } else {
            throw new Error('Failed to generate DOCX');
          }
        } else {
          throw new Error('Failed to generate DOCX');
        }
      }
    } catch (error: any) {
      console.error(`Error downloading ${format}:`, error);
      toast.error(`Failed to download ${format.toUpperCase()}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Toaster position="top-center" />
      
      {/* Page Header */}
      <PageHeader />
      
      {/* Progress Bar */}
      <ProgressBar 
        currentStep={step} 
        totalSteps={3} 
        steps={['Upload Resume', 'Job Details', 'Auto Apply']} 
      />
      
      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}
      
      {/* Step 1: Resume Upload */}
      {step === 1 && (
        <ResumeUpload
          onUploadResume={setMasterResume}
          onUploadPdf={setResumePdfData}
          onNext={() => setStep(2)}
          hasExistingResume={!!masterResume || !!resumePdfData}
          personalInfo={personalInfo}
          onPersonalInfoChange={setPersonalInfo}
        />
      )}
      
      {/* Step 2: Job Details */}
      {step === 2 && (
        <>
          <JobDetailsForm
            selectedJob={selectedJob}
            onJobDataChange={setSelectedJob}
          />
          
          <ApiKeyConfiguration
            apiKey={apiKey}
            onChange={handleApiKeyChange}
          />
          
          <ActionButtons
            onBack={() => setStep(1)}
            onNext={handleGenerateResume}
            nextLabel="Generate Resume"
            isLoading={isLoading}
          />
        </>
      )}
      
      {/* Step 3: Auto Apply */}
      {step === 3 && generatedResume && (
        <>
          <TailoredResume
            generatedResume={generatedResume}
            tailoringNotes={tailoringNotes}
            isLoading={isLoading}
            formatSkills={formatSkills}
            onDownload={handleDownload}
          />
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <ActionButton 
              onClick={() => handleDownload('pdf')} 
              icon={Download} 
              color="green" 
              disabled={isLoading}
            >
              {isLoading ? 'Downloading...' : 'Download as PDF'}
            </ActionButton>
            <ActionButton 
              onClick={() => handleDownload('docx')} 
              icon={Download} 
              color="blue" 
              disabled={isLoading}
            >
              {isLoading ? 'Downloading...' : 'Download as DOCX'}
            </ActionButton>
          </div>
          
          <div className="mt-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Auto-Apply to Job</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload Prompt
              </label>
              <input
                type="text"
                value={uploadPrompt}
                onChange={handlePromptChange}
                placeholder="Upload this resume to apply for the position at..."
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isUploading || uploadStatus === 'completed'}
              />
            </div>
            
            <AutoApplyStatus
              isUploading={isUploading}
              status={uploadStatus}
              result={uploadResult}
              error={uploadError}
              progress={uploadProgress}
            />
            
            {/* Completion Message */}
            {uploadStatus === 'completed' && (
              <div className="mt-6 bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-green-800 dark:text-green-300 text-sm">
                <h4 className="font-medium mb-2">Application Submitted Successfully!</h4>
                <p className="mb-3">
                  Your application has been submitted. Here's what you can do next:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Check your email for confirmation from the employer</li>
                  <li>Prepare for potential interviews</li>
                  <li>Continue applying to other jobs</li>
                </ul>
                <div className="mt-4 flex gap-3">
                  <ActionButton
                    onClick={() => window.location.href = '/'}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700"
                  >
                    Return to Job Listings
                  </ActionButton>
                  <ActionButton
                    onClick={() => window.location.href = '/applied-jobs'}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700"
                  >
                    View Applied Jobs
                  </ActionButton>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <ActionButtons
                onBack={() => setStep(2)}
                onNext={handleStartAutoApply}
                nextLabel={isUploading ? "Applying..." : "Start Auto-Apply"}
                isLoading={isUploading}
                onStartOver={handleStartOver}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AutoApplyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AutoApplyContent />
    </Suspense>
  );
} 