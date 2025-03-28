"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { toast } from "react-hot-toast";
import {
  FileText,
  Download,
  Copy,
  X,
  Info,
  Loader2,
  FileUp,
  AlertTriangle,
  Check,
} from "lucide-react";
import { jsPDF } from "jspdf";
import Cookies from "js-cookie";
import pdfParse from "pdf-parse";

interface CoverLetterGeneratorProps {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  skills?: string;
  location?: string;
}

interface ResumeData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
  certifications?: string;
  projects?: string;
}

interface ResumeAnalysis {
  used: boolean;
  matchCount: number;
  matches: string[];
}

export default function CoverLetterGenerator({
  jobTitle,
  companyName,
  jobDescription,
  skills,
  location,
}: CoverLetterGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resumeContent, setResumeContent] = useState("");
  const [coverLetterText, setCoverLetterText] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => Cookies.get("geminiApiKey") || "");
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [resumeProcessed, setResumeProcessed] = useState(false);
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null);
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [resumeData, setResumeData] = useState<ResumeData>(() => {
    const savedData = Cookies.get("resumeData");
    return savedData ? JSON.parse(savedData) : {
      fullName: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
      experience: "",
      education: "",
      skills: "",
      certifications: "",
      projects: ""
    };
  });

  // Force debugging to browser console
  useEffect(() => {
    // Clear debug info when modal opens
    if (isOpen) {
      console.clear();
      console.log("%c🔍 COVER LETTER GENERATOR DEBUGGING ENABLED", "font-size: 16px; font-weight: bold; color: blue;");
      setDebugInfo([]);
    }
  }, [isOpen]);

  const addDebugMessage = (message: string) => {
    console.log(`[CoverLetterGenerator] ${message}`);
    setDebugInfo(prev => [...prev, message]);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const openModal = () => {
    setIsOpen(true);
    setResumeContent("");
    setCoverLetterText("");
    setError(null);
    setResumeProcessed(false);
    
    // Check for saved API key
    const savedApiKey = Cookies.get("geminiApiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    
    // Check for saved resume data
    const savedResumeData = Cookies.get("resumeData");
    if (savedResumeData) {
      setResumeData(JSON.parse(savedResumeData));
    }
    
    addDebugMessage("Modal opened, ready for resume upload or form input");
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResumeProcessed(false);
    const file = e.target.files?.[0];
    if (!file) return;

    addDebugMessage(`File selected: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`);
    toast.success(`Resume file selected: ${file.name}`);
    
    // Only accept text files, PDFs, DOCs, DOCXs
    const validTypes = ["text/plain", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a valid resume file (TXT, PDF, DOC, DOCX)");
      return;
    }

    try {
      // Handle text files
      if (file.type === "text/plain") {
        addDebugMessage("Processing text file...");
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === "string") {
            addDebugMessage(`Text file processed. Content length: ${text.length} characters`);
            addDebugMessage(`Preview: ${text.substring(0, 100)}...`);
            setResumeContent(text);
            setResumeProcessed(true);
            toast.success("Resume text extracted successfully!");
          }
        };
        reader.readAsText(file);
      } 
      // Handle PDF files
      else if (file.type === "application/pdf") {
        setLoading(true);
        addDebugMessage("Processing PDF file...");
        
        const arrayBuffer = await file.arrayBuffer();
        addDebugMessage(`PDF ArrayBuffer created, size: ${arrayBuffer.byteLength} bytes`);
        
        try {
          // Convert ArrayBuffer to Buffer for pdf-parse
          const buffer = Buffer.from(arrayBuffer);
          addDebugMessage(`Buffer created, size: ${buffer.length} bytes`);
          
          const pdfResult = await pdfParse(buffer);
          addDebugMessage("PDF parsed successfully!");
          addDebugMessage(`Extracted text length: ${pdfResult.text.length} characters`);
          addDebugMessage(`Preview: ${pdfResult.text.substring(0, 100)}...`);
          
          setResumeContent(pdfResult.text);
          setResumeProcessed(true);
          toast.success("Resume text extracted from PDF!");
        } catch (pdfError) {
          console.error("Error parsing PDF:", pdfError);
          addDebugMessage(`ERROR parsing PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
          setError(`Error parsing PDF: ${pdfError instanceof Error ? pdfError.message : "Unknown error"}`);
          toast.error("Failed to extract text from PDF");
        }
        setLoading(false);
      } 
      // For DOCs/DOCXs, note the limitation
      else {
        addDebugMessage(`Document file type not supported for text extraction: ${file.type}`);
        setResumeContent(`[Uploaded ${file.name}] - Note: For DOC/DOCX files, content extraction is not implemented in this demo. Consider converting to PDF or copying text directly.`);
        toast.error("DOC/DOCX extraction not supported. Please paste content manually.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      addDebugMessage(`Error processing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      setError(`Error processing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to process resume file");
    }
  };

  const generateCoverLetter = async () => {
    setError(null);
    setLoading(true);
    setResumeAnalysis(null);

    if (!apiKey) {
      setError("Please enter your Gemini API key");
      setShowApiKeyInfo(true);
      setLoading(false);
      return;
    }

    // Debug resume content before sending
    addDebugMessage(`Preparing to generate cover letter for ${jobTitle} at ${companyName}`);
    addDebugMessage(`Resume content available: ${resumeContent ? 'YES' : 'NO'}`);
    
    // If no resume content but we have resume data, generate it
    if (!resumeContent && (resumeData.fullName || resumeData.experience || resumeData.skills)) {
      const formattedResumeContent = generateResumeText();
      setResumeContent(formattedResumeContent);
      addDebugMessage(`Generated resume content from form data: ${formattedResumeContent.length} characters`);
    }
    
    const finalResumeContent = resumeContent || generateResumeText();
    
    if (finalResumeContent) {
      addDebugMessage(`Resume content length: ${finalResumeContent.length} characters`);
      addDebugMessage(`Resume preview: ${finalResumeContent.substring(0, 100)}...`);
    } else {
      addDebugMessage("No resume content to include in generation");
    }

    try {
      const requestData = {
        jobTitle,
        companyName,
        jobDescription,
        resumeContent: finalResumeContent,
        skills,
        location,
        apiKey,
      };
      
      addDebugMessage(`Sending request to API with resume content ${finalResumeContent ? `(${finalResumeContent.length} chars)` : '(none)'}`);
      
      const response = await fetch("/api/coverletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      addDebugMessage(`API response received, status: ${response.status}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate cover letter");
      }

      setCoverLetterText(data.coverLetterText);
      
      // Handle debug info from API
      if (data.debug && data.debug.resumeAnalysis) {
        setResumeAnalysis(data.debug.resumeAnalysis);
        addDebugMessage(`Resume analysis: ${data.debug.resumeAnalysis.used ? 'Resume content was used' : 'Resume content was NOT used'}`);
        addDebugMessage(`Found ${data.debug.resumeAnalysis.matchCount} matches between resume and cover letter`);
        
        if (data.debug.resumeAnalysis.matches.length > 0) {
          addDebugMessage(`Sample matches: "${data.debug.resumeAnalysis.matches[0]}", ...`);
        }
      }
      
      // Save API key for future use
      Cookies.set("geminiApiKey", apiKey, { expires: 30 });
      
      // Save resume data (if provided)
      if (resumeData.fullName || resumeData.skills || resumeData.experience) {
        Cookies.set("resumeData", JSON.stringify(resumeData), { expires: 30 });
      }
      
      toast.success("Cover letter generated successfully!");
    } catch (err) {
      console.error("Error generating cover letter:", err);
      addDebugMessage(`Error generating cover letter: ${err instanceof Error ? err.message : "Unknown error"}`);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      toast.error("Failed to generate cover letter");
    } finally {
      setLoading(false);
    }
  };

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

  const downloadAsDocx = () => {
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

  const saveResumeData = () => {
    // Convert resume data to formatted text content
    const formattedResumeContent = generateResumeText();
    
    // Save resume data to cookies (expires in 30 days)
    Cookies.set("resumeData", JSON.stringify(resumeData), { expires: 30 });
    
    // Update the resume content with formatted text
    setResumeContent(formattedResumeContent);
    setResumeProcessed(true);
    setShowResumeForm(false);
    
    addDebugMessage("Resume data saved to cookies and formatted for use");
    toast.success("Resume information saved");
  };

  const generateResumeText = (): string => {
    let resumeText = `${resumeData.fullName || "Applicant Name"}\n`;
    resumeText += `${resumeData.email || "email@example.com"}${resumeData.phone ? ` | ${resumeData.phone}` : ""}\n`;
    resumeText += `${resumeData.location || "Location"}${resumeData.website ? ` | ${resumeData.website}` : ""}\n\n`;
    
    // Summary
    if (resumeData.summary) {
      resumeText += `PROFESSIONAL SUMMARY\n${resumeData.summary}\n\n`;
    }
    
    // Experience
    if (resumeData.experience) {
      resumeText += `PROFESSIONAL EXPERIENCE\n${resumeData.experience}\n\n`;
    }
    
    // Education
    if (resumeData.education) {
      resumeText += `EDUCATION\n${resumeData.education}\n\n`;
    }
    
    // Skills
    if (resumeData.skills) {
      resumeText += `SKILLS\n${resumeData.skills}\n\n`;
    }
    
    // Certifications
    if (resumeData.certifications) {
      resumeText += `CERTIFICATIONS\n${resumeData.certifications}\n\n`;
    }
    
    // Projects
    if (resumeData.projects) {
      resumeText += `PROJECTS\n${resumeData.projects}\n\n`;
    }
    
    return resumeText;
  };

  const handleResumeFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setResumeData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        Generate Cover Letter
      </button>

      <Transition appear show={isOpen}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                    >
                      Generate Cover Letter for {jobTitle} at {companyName}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={closeModal}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* API Key Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Gemini API Key
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your Gemini API key"
                          className="flex-1 rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKeyInfo(!showApiKeyInfo)}
                          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <Info className="w-5 h-5" />
                        </button>
                      </div>
                      {showApiKeyInfo && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-xs">
                          <p className="mb-2">To get a Gemini API key:</p>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                            <li>Sign in with your Google account</li>
                            <li>Click on &quot;Get API key&quot; button</li>
                            <li>Create a new API key or use an existing one</li>
                            <li>Copy the key and paste it here</li>
                          </ol>
                          <p className="mt-2">The API key will be saved in your browser for future use.</p>
                        </div>
                      )}
                    </div>

                    {/* Resume Upload/Input Section */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Your Resume (Optional)
                        </label>
                        <div className="flex space-x-2">
                          {resumeProcessed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                              <Check className="w-3 h-3 mr-1" />
                              Resume Ready
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowResumeForm(!showResumeForm)}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                          >
                            {showResumeForm ? 'Hide Form' : 'Show Form'}
                          </button>
                        </div>
                      </div>

                      {/* Resume Form */}
                      {showResumeForm && (
                        <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Enter Your Resume Information</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Personal Info */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Full Name
                              </label>
                              <input
                                type="text"
                                name="fullName"
                                value={resumeData.fullName}
                                onChange={handleResumeFormChange}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="John Doe"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={resumeData.email}
                                onChange={handleResumeFormChange}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="john.doe@example.com"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Phone
                              </label>
                              <input
                                type="text"
                                name="phone"
                                value={resumeData.phone}
                                onChange={handleResumeFormChange}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="(123) 456-7890"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Location
                              </label>
                              <input
                                type="text"
                                name="location"
                                value={resumeData.location}
                                onChange={handleResumeFormChange}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="City, State"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Website/Portfolio (Optional)
                              </label>
                              <input
                                type="text"
                                name="website"
                                value={resumeData.website}
                                onChange={handleResumeFormChange}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="https://yourportfolio.com"
                              />
                            </div>
                          </div>
                          
                          {/* Longer Form Fields */}
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Professional Summary
                              </label>
                              <textarea
                                name="summary"
                                value={resumeData.summary}
                                onChange={handleResumeFormChange}
                                rows={2}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="Briefly describe your professional background and strengths..."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Work Experience
                              </label>
                              <textarea
                                name="experience"
                                value={resumeData.experience}
                                onChange={handleResumeFormChange}
                                rows={4}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="List your relevant work experience (include job titles, companies, dates, and accomplishments)..."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Education
                              </label>
                              <textarea
                                name="education"
                                value={resumeData.education}
                                onChange={handleResumeFormChange}
                                rows={2}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="List your degrees, schools, and graduation dates..."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Skills
                              </label>
                              <textarea
                                name="skills"
                                value={resumeData.skills}
                                onChange={handleResumeFormChange}
                                rows={2}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="List your technical and soft skills..."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Certifications (Optional)
                              </label>
                              <textarea
                                name="certifications"
                                value={resumeData.certifications}
                                onChange={handleResumeFormChange}
                                rows={2}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="List any relevant certifications or licenses..."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Projects (Optional)
                              </label>
                              <textarea
                                name="projects"
                                value={resumeData.projects}
                                onChange={handleResumeFormChange}
                                rows={2}
                                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                placeholder="Describe key projects that showcase your skills..."
                              />
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={saveResumeData}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Save Resume Data
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* File Upload and Text Area (existing) */}
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
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
                            className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FileUp className="w-4 h-4 mr-1.5" />
                            Upload Resume
                          </button>
                          {resumeContent && (
                            <button
                              type="button"
                              onClick={() => {
                                setResumeContent("");
                                setResumeProcessed(false);
                                addDebugMessage("Resume content cleared");
                                toast.success("Resume content cleared");
                              }}
                              className="flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 rounded-md shadow-sm text-xs font-medium text-red-700 dark:text-red-300 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <X className="w-4 h-4 mr-1.5" />
                              Clear
                            </button>
                          )}
                        </div>
                        <textarea
                          value={resumeContent}
                          onChange={(e) => {
                            setResumeContent(e.target.value);
                            setResumeProcessed(!!e.target.value);
                            if (e.target.value) {
                              addDebugMessage(`Resume content updated manually, length: ${e.target.value.length} characters`);
                            }
                          }}
                          placeholder="Or paste your resume content here..."
                          rows={5}
                          className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md flex items-start">
                        <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}

                    {/* Debug Info (Development Only) */}
                    {process.env.NODE_ENV !== 'production' && debugInfo.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-auto max-h-36">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Debug Info:</h4>
                        <div className="space-y-1">
                          {debugInfo.map((msg, idx) => (
                            <p key={idx} className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                              {msg}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generate Button */}
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={generateCoverLetter}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Cover Letter
                          </>
                        )}
                      </button>
                    </div>

                    {/* Cover Letter Result */}
                    {coverLetterText && (
                      <div className="mt-4 space-y-3">
                        {resumeContent && resumeAnalysis && (
                          <div className={`p-3 ${resumeAnalysis.used ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'} rounded-md flex items-start`}>
                            {resumeAnalysis.used ? (
                              <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {resumeAnalysis.used 
                                  ? `Resume content used successfully (${resumeAnalysis.matchCount} matches)` 
                                  : 'Resume content may not have been incorporated'}
                              </p>
                              {resumeAnalysis.matches.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs font-medium mb-1">Matched phrases from your resume:</p>
                                  <ul className="text-xs list-disc list-inside space-y-1">
                                    {resumeAnalysis.matches.map((match, idx) => (
                                      <li key={idx} className="truncate">{match}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {!resumeAnalysis.used && (
                                <p className="text-xs mt-1">
                                  Try highlighting specific skills or experience in your resume that match the job requirements.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 overflow-auto max-h-80">
                          <pre className="text-sm whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200">
                            {coverLetterText}
                          </pre>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            onClick={downloadAsPDF}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={downloadAsDocx}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Download DOCX
                          </button>
                          <button
                            type="button"
                            onClick={copyToClipboard}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Copy className="w-4 h-4 mr-1.5" />
                            Copy to Clipboard
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
} 