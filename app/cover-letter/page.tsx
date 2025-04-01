"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import Cookies from "js-cookie";
import { loadResume, saveResume, deleteResume, resumeExists } from '../utils/resumeStorage';
import { convertToCoverLetterFormat, prepareResumeTextForAPI } from '../utils/resumeAdapter';
import ResumeStorageUI from '../components/ResumeStorageUI';
import ResumeForm, { 
  getInitialResumeData, 
  generateResumeText,
  saveResumeData
} from "./resume-form";

// Import our components
import PageHeader from '../components/coverletter/PageHeader';
import JobDetailsForm from '../components/coverletter/JobDetailsForm';
import ApiKeyConfig from '../components/coverletter/ApiKeyConfig';
import ResumeUpload from '../components/coverletter/ResumeUpload';
import CoverLetterOutput from '../components/coverletter/CoverLetterOutput';
import GenerateButton from '../components/coverletter/GenerateButton';
import LoadingState from '../components/coverletter/LoadingState';
import ErrorDisplay from '../components/resume/ErrorDisplay';

// Create a client component that uses useSearchParams
function CoverLetterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for job details
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [location, setLocation] = useState("");
  
  // State for resume and cover letter
  const [resumeContent, setResumeContent] = useState("");
  const [resumePdfData, setResumePdfData] = useState<string | null>(null);
  const [coverLetterText, setCoverLetterText] = useState("");
  const [savedResumes, setSavedResumes] = useState<{[key: string]: string}>({});
  
  // Resume form state
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [resumeData, setResumeData] = useState(getInitialResumeData);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
  const [jobDetailsEditable, setJobDetailsEditable] = useState(false);
  
  // Handle saving resume data
  const handleSaveResumeData = () => {
    saveResumeData(resumeData, (text) => {
      setResumeContent(text);
      
      // Also save as a named resume in localStorage
      const resumeName = resumeData.fullName ? `${resumeData.fullName}'s Resume` : "My Resume";
      const newSavedResumes = { ...savedResumes, [resumeName]: text };
      setSavedResumes(newSavedResumes);
      localStorage.setItem("savedResumes", JSON.stringify(newSavedResumes));
    });
    
    // Close the form after saving
    setShowResumeForm(false);
  };
  
  // Load data from URL parameters and local storage
  useEffect(() => {
    // Get job details from URL parameters
    const title = searchParams?.get("title") || "";
    const company = searchParams?.get("company") || "";
    const desc = searchParams?.get("description") || "";
    const jobSkills = searchParams?.get("skills") || "";
    const jobLocation = searchParams?.get("location") || "";
    const jobId = searchParams?.get("jobId") || "";
    
    // Set job details from URL parameters
    setJobTitle(title);
    setCompanyName(company);
    setJobDescription(desc);
    setSkills(jobSkills);
    setLocation(jobLocation);
    
    // If we don't have URL parameters, check if there's a jobId to load from localStorage
    if (jobId && (!title || !company)) {
      try {
        const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}');
        const job = savedJobs[jobId];
        
        if (job) {
          setJobTitle(job.title || "");
          setCompanyName(job.company_name || "");
          setJobDescription(job.description || "");
          setSkills(job.skills || "");
          setLocation(job.location || "");
        }
      } catch (error) {
        console.error("Error loading job data from localStorage:", error);
      }
    }
    
    // Set job details editable if we don't have enough information
    if (!title || !company || !desc) {
      setJobDetailsEditable(true);
    }
    
    // Load API key from cookies
    const savedApiKey = Cookies.get("geminiApiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
      console.log("API key loaded from cookies");
    } else {
      // Try to load from localStorage as fallback
      const localStorageApiKey = localStorage.getItem("geminiApiKey");
      if (localStorageApiKey) {
        setApiKey(localStorageApiKey);
        console.log("API key loaded from localStorage");
      }
    }
    
    // Load resume from shared storage if it exists
    if (resumeExists()) {
      const { resumeData, resumePdfData } = loadResume();
      if (resumeData) {
        // Convert the main resume format to cover letter format
        const formattedContent = prepareResumeTextForAPI(resumeData, null);
        if (formattedContent) {
          setResumeContent(formattedContent);
          
          // Also update resume form data
          const coverLetterFormat = convertToCoverLetterFormat(resumeData);
          setResumeData(coverLetterFormat);
          
          toast.success("Your resume has been loaded from shared storage");
        }
      } else if (resumePdfData) {
        setResumePdfData(resumePdfData);
        setResumeContent(`[PDF resume loaded from storage] - PDF will be processed directly by Gemini AI`);
        toast.success("Your PDF resume has been loaded from shared storage");
      }
    }
    
    // Load saved resume data from cookies
    try {
      const savedResumeData = Cookies.get("resumeData");
      if (savedResumeData) {
        const parsedData = JSON.parse(savedResumeData);
        setResumeData(parsedData);
        
        // If we have existing resume data, automatically generate the text version
        if (parsedData.fullName || parsedData.experience || parsedData.skills) {
          const formattedContent = generateResumeText(parsedData);
          setResumeContent(formattedContent);
        }
      }
    } catch (error) {
      console.error("Error loading resume data from cookies:", error);
    }
    
    // Load saved resumes from localStorage
    try {
      const saved = localStorage.getItem("savedResumes");
      if (saved) {
        setSavedResumes(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading saved resumes:", error);
    }
  }, [searchParams]);
  
  // Handle resume upload from file
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    
    try {
      if (file.type === 'application/pdf') {
        // For PDF files, we'll convert to base64 and keep the binary data for the API
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
          try {
            const base64Data = e.target?.result?.toString().split(',')[1]; // Extract base64 content
            
            // Store the PDF data for later API call
            if (base64Data) {
              setResumePdfData(base64Data);
              
              // Also save to shared storage
              saveResume(null, base64Data);
              
            } else {
              toast.error("Failed to extract PDF data");
              setLoading(false);
              return;
            }
            
            // Show a toast to indicate we're using the PDF directly
            toast.success(`PDF "${file.name}" will be sent to Gemini for processing`, {
              icon: "📄",
              duration: 4000
            });
            
            // Extract text from PDF if possible for display in textarea
            try {
              // For now just show a placeholder in the textarea
              setResumeContent(`[PDF uploaded: ${file.name}] - PDF will be processed directly by Gemini AI`);
            } catch (error) {
              console.error("Error extracting PDF text:", error);
              // Still store the PDF, but mention the text extraction issue
              setResumeContent(`[PDF uploaded: ${file.name}] - Text extraction failed, but PDF will be processed by Gemini AI`);
            }
          } catch (error) {
            console.error("Error processing PDF:", error);
            toast.error("Failed to process PDF file");
          } finally {
            setLoading(false);
          }
        };
        
        fileReader.onerror = () => {
          toast.error("Failed to read PDF file");
          setLoading(false);
        };
        
        fileReader.readAsDataURL(file);
      } else {
        // For text-based files, we'll extract the text content
        const text = await file.text();
        setResumeContent(text);
        // Clear any previously stored PDF data
        setResumePdfData(null);
        
        // We could try to parse this text into a structured resume,
        // but for now we'll just save the text as is
        
        toast.success(`Resume "${file.name}" uploaded successfully!`);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error handling file upload:", error);
      toast.error("Failed to process file");
      setLoading(false);
    }
  };
  
  // Load a saved resume
  const loadSavedResume = (name: string) => {
    const resume = savedResumes[name];
    if (resume) {
      setResumeContent(resume);
      toast.success(`Loaded resume: ${name}`);
    }
  };
  
  // Generate cover letter
  const generateCoverLetter = async () => {
    setError(null);
    
    // Validate job details
    if (!jobTitle || !companyName || !jobDescription) {
      setError("Job title, company name, and description are required");
      return;
    }
    
    // Validate API key
    if (!apiKey) {
      setError("Please enter your Gemini API key");
      setShowApiKeyInfo(true);
      return;
    }
    
    setLoading(true);
    
    // If we have resume data but no resume content, generate it from the form
    let finalResumeContent = resumeContent;
    if (!resumeContent && (resumeData.fullName || resumeData.experience || resumeData.skills)) {
      finalResumeContent = generateResumeText(resumeData);
      toast.success("Using resume data from your saved profile");
    }
    
    try {
      const response = await fetch("/api/coverletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle,
          companyName,
          jobDescription,
          resumeContent: finalResumeContent,
          resumePdfData: resumePdfData,
          skills,
          location,
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate cover letter");
      }

      setCoverLetterText(data.coverLetterText);
      
      // Save API key for future use
      Cookies.set("geminiApiKey", apiKey, { expires: 30 });
      
      // If we have resume data, save it for future use
      if (resumeData.fullName || resumeData.skills || resumeData.experience) {
        Cookies.set("resumeData", JSON.stringify(resumeData), { expires: 30 });
      }
      
      toast.success("Cover letter generated successfully!");
      
      // Scroll to the results section
      setTimeout(() => {
        document.getElementById("cover-letter-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error generating cover letter:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };
  
  // Download as PDF
  const downloadAsPDF = () => {
    if (!coverLetterText) return;
    
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(`Cover Letter for ${jobTitle} at ${companyName}`, 20, 20);
    
    // Add content with word wrapping
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(coverLetterText, 170);
    doc.text(splitText, 20, 30);
    
    // Save the PDF
    doc.save(`CoverLetter-${companyName}-${jobTitle.replace(/\s+/g, "-")}.pdf`);
    
    toast.success("Cover letter downloaded as PDF");
  };
  
  // Download as DOCX
  const downloadAsDocx = () => {
    if (!coverLetterText) return;
    
    // In a real implementation, you would use a library like docx.js
    // For this demo, we'll create a simple HTML blob with the content
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 1in; }
            h1 { font-size: 18px; margin-bottom: 20px; }
            p { margin-bottom: 15px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>Cover Letter for ${jobTitle} at ${companyName}</h1>
          ${coverLetterText.split('\n\n').map(para => `<p>${para}</p>`).join('')}
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CoverLetter-${companyName}-${jobTitle.replace(/\s+/g, "-")}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Cover letter downloaded as DOCX");
  };
  
  // Copy to clipboard
  const copyToClipboard = () => {
    if (!coverLetterText) return;
    
    navigator.clipboard.writeText(coverLetterText)
      .then(() => {
        toast.success("Cover letter copied to clipboard");
      })
      .catch(err => {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy to clipboard");
      });
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <PageHeader />
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-8">
          {/* Job Details Section */}
          <JobDetailsForm 
            jobTitle={jobTitle}
            companyName={companyName}
            jobDescription={jobDescription}
            skills={skills}
            location={location}
            jobDetailsEditable={jobDetailsEditable}
            onJobTitleChange={(e) => setJobTitle(e.target.value)}
            onCompanyNameChange={(e) => setCompanyName(e.target.value)}
            onJobDescriptionChange={(e) => setJobDescription(e.target.value)}
            onSkillsChange={(e) => setSkills(e.target.value)}
            onLocationChange={(e) => setLocation(e.target.value)}
            onToggleEdit={() => setJobDetailsEditable(true)}
            onSaveJobDetails={() => setJobDetailsEditable(false)}
          />
          
          {/* API Key Section */}
          <ApiKeyConfig 
            apiKey={apiKey}
            showApiKeyInfo={showApiKeyInfo}
            onApiKeyChange={(e) => setApiKey(e.target.value)}
            onToggleApiKeyInfo={() => setShowApiKeyInfo(!showApiKeyInfo)}
          />
          
          {/* Resume Section */}
          <ResumeUpload 
            resumeContent={resumeContent}
            resumePdfData={resumePdfData}
            savedResumes={savedResumes}
            showResumeForm={showResumeForm}
            onResumeContentChange={(e) => {
              setResumeContent(e.target.value);
              // Clear PDF data if user manually edits the textarea
              if (resumePdfData) {
                setResumePdfData(null);
              }
            }}
            onResumeUpload={handleResumeUpload}
            onLoadSavedResume={loadSavedResume}
            onToggleResumeForm={() => setShowResumeForm(!showResumeForm)}
          />
          
          {showResumeForm && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <ResumeForm 
                resumeData={resumeData} 
                onChangeResumeData={setResumeData} 
                onSave={handleSaveResumeData} 
              />
            </div>
          )}
          
          {/* Storage UI - Use as a component */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <ResumeStorageUI 
              onResumeLoaded={(text, isPdf) => {
                setResumeContent(text);
                setResumePdfData(isPdf ? text : null);
              }}
              onResumeDeleted={() => {
                setResumeContent('');
                setResumePdfData(null);
              }}
              onApiKeyLoad={(apiKey) => setApiKey(apiKey)}
            />
          </div>
          
          {/* Generate Button */}
          <GenerateButton 
            loading={loading}
            error={error}
            disabled={!jobTitle || !companyName || !jobDescription}
            onGenerate={generateCoverLetter}
          />
        </div>
        
        {/* Cover Letter Result */}
        {coverLetterText && (
          <CoverLetterOutput 
            coverLetterText={coverLetterText}
            jobTitle={jobTitle}
            companyName={companyName}
            onDownloadPdf={downloadAsPDF}
            onDownloadDocx={downloadAsDocx}
            onCopyToClipboard={copyToClipboard}
            onRegenerate={generateCoverLetter}
          />
        )}
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function CoverLetterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CoverLetterForm />
    </Suspense>
  );
} 