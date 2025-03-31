"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import {
  FileText,
  Download,
  Copy,
  Info,
  Loader2,
  FileUp,
  AlertTriangle,
  Building,
  MapPin,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
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
        {/* Header Section - Updated to match homepage styling */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
                Create Your Cover Letter
              </h1>
              <p className="text-mobile-sm text-blue-100 max-w-2xl">
                Generate tailored cover letters in seconds using your resume and job details.
                Perfect for customizing your application for each position.
              </p>
            </div>
          
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-8">
          {/* Job Details Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Job Details</h2>
              
              {!jobDetailsEditable && (
                <button
                  onClick={() => setJobDetailsEditable(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              )}
            </div>
            
            {jobDetailsEditable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Software Engineer"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Inc."
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="New York, NY or Remote"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Skills
                    </label>
                    <input
                      type="text"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                      placeholder="React, TypeScript, Node.js"
                      className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Description *
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={6}
                    className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                
                {jobDetailsEditable && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setJobDetailsEditable(false)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      disabled={!jobTitle || !companyName || !jobDescription}
                    >
                      Save Job Details
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start">
                    <Building className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</p>
                      <p className="text-base text-gray-900 dark:text-white">{companyName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Briefcase className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Position</p>
                      <p className="text-base text-gray-900 dark:text-white">{jobTitle}</p>
                    </div>
                  </div>
                  
                  {location && (
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</p>
                        <p className="text-base text-gray-900 dark:text-white">{location}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Job Description</p>
                  <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 p-3 rounded border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                    <p className="whitespace-pre-line">{jobDescription}</p>
                  </div>
                </div>
                
                {skills && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Required Skills</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {skills.split(',').map((skill, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {skill.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* API Key Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Gemini API Key</h2>
              <button
                type="button"
                onClick={() => setShowApiKeyInfo(!showApiKeyInfo)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center"
              >
                <Info className="w-4 h-4 mr-1" />
                {showApiKeyInfo ? "Hide Help" : "Need Help?"}
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
              
              {showApiKeyInfo && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm">
                  <p className="mb-2">To get a Gemini API key:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
                    <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                    <li>Sign in with your Google account</li>
                    <li>Click on &quot;Get API key&quot; button</li>
                    <li>Create a new API key or use an existing one</li>
                    <li>Copy the key and paste it here</li>
                  </ol>
                  <p>The API key will be saved in your browser for future use.</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Resume Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your Resume (Optional)</h2>
              
              <button
                type="button"
                onClick={() => setShowResumeForm(!showResumeForm)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
              >
                {showResumeForm ? 'Hide Form' : 'Show Resume Form'}
              </button>
            </div>
            
            {showResumeForm && (
              <ResumeForm 
                resumeData={resumeData} 
                onChangeResumeData={setResumeData} 
                onSave={handleSaveResumeData} 
              />
            )}
            
            <div className="space-y-4">
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
              
              {Object.keys(savedResumes).length > 0 && (
                <div className="relative inline-block text-left">
                  <select
                    onChange={(e) => loadSavedResume(e.target.value)}
                    className="block w-48 sm:w-56 rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white px-3 py-2"
                    defaultValue=""
                  >
                    <option value="" disabled>Load saved resume...</option>
                    {Object.keys(savedResumes).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <textarea
                value={resumeContent}
                onChange={(e) => {
                  setResumeContent(e.target.value);
                  // Clear PDF data if user manually edits the textarea
                  if (resumePdfData) {
                    setResumePdfData(null);
                  }
                }}
                placeholder="Or paste your resume content here... (Adding your resume will make the cover letter more personalized to your experience)"
                rows={8}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white ${resumePdfData ? 'border-green-500 dark:border-green-600' : ''}`}
              />
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md text-yellow-800 dark:text-yellow-300 text-sm flex items-start">
                <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <p>
                  Adding your resume will help the AI generate a more tailored cover letter that highlights your relevant experiences and skills. For best results, include your work history, skills, and achievements.
                </p>
              </div>
            </div>
          </div>
          
          {/* Generate Button */}
          <div className="p-6">
            {error && (
              <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            <div className="flex justify-center">
              <button
                type="button"
                onClick={generateCoverLetter}
                disabled={loading || !jobTitle || !companyName || !jobDescription}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 mr-2" />
                    Generate Cover Letter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Cover Letter Result */}
        {coverLetterText && (
          <div id="cover-letter-result" className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Your Cover Letter</h2>
              
              <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-750 overflow-auto mb-4">
                <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">
                  {coverLetterText}
                </pre>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  type="button"
                  onClick={downloadAsPDF}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download as PDF
                </button>
                <button
                  type="button"
                  onClick={downloadAsDocx}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download as DOCX
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </button>
                <button
                  type="button"
                  onClick={generateCoverLetter}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function CoverLetterLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 animate-pulse">
            Create Your Cover Letter
          </h1>
          <div className="w-2/3 h-4 bg-white/20 rounded animate-pulse"></div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader2 className="h-10 w-10 mx-auto mb-4 text-blue-600 animate-spin" />
            <p className="text-gray-700 dark:text-gray-300">Loading cover letter generator...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function CoverLetterPage() {
  return (
    <Suspense fallback={<CoverLetterLoading />}>
      <CoverLetterForm />
    </Suspense>
  );
} 