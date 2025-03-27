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
  const [coverLetterText, setCoverLetterText] = useState("");
  const [savedResumes, setSavedResumes] = useState<{[key: string]: string}>({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
  const [jobDetailsEditable, setJobDetailsEditable] = useState(false);
  
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
  
  // Handle resume upload
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Only accept text files, PDFs, DOCs, DOCXs
    const validTypes = ["text/plain", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid resume file (TXT, PDF, DOC, DOCX)");
      return;
    }

    // For simplicity, we'll only properly handle text files in this example
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          setResumeContent(text);
          
          // Save this resume to localStorage
          const newSavedResumes = { ...savedResumes, [file.name]: text };
          setSavedResumes(newSavedResumes);
          localStorage.setItem("savedResumes", JSON.stringify(newSavedResumes));
        }
      };
      reader.readAsText(file);
    } else {
      // For PDFs/DOCs just acknowledge upload but explain limitations
      setResumeContent(`[Uploaded ${file.name}] - Please note that for PDF/DOC/DOCX files, only the file name is captured in this demo. For a production app, you would need to extract text with appropriate libraries.`);
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
          resumeContent,
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-500" />
            Cover Letter Generator
          </h1>
          
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Jobs
          </button>
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
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Your Resume (Optional)</h2>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleResumeUpload}
                  className="hidden"
                  accept=".txt,.pdf,.doc,.docx"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FileUp className="w-4 h-4 mr-2" />
                  Upload Resume
                </button>
                
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
              </div>
              
              <textarea
                value={resumeContent}
                onChange={(e) => setResumeContent(e.target.value)}
                placeholder="Or paste your resume content here... (Adding your resume will make the cover letter more personalized to your experience)"
                rows={8}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
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