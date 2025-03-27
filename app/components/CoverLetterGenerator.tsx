"use client";

import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { jsPDF } from "jspdf";
import Cookies from "js-cookie";

interface CoverLetterGeneratorProps {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  skills?: string;
  location?: string;
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

  const closeModal = () => {
    setIsOpen(false);
  };

  const openModal = () => {
    setIsOpen(true);
    setResumeContent("");
    setCoverLetterText("");
    setError(null);
    
    // Check for saved API key
    const savedApiKey = Cookies.get("geminiApiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  };

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
    // For PDFs and DOCs, you would need appropriate libraries
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          setResumeContent(text);
        }
      };
      reader.readAsText(file);
    } else {
      // For PDFs/DOCs just acknowledge upload but explain limitations
      setResumeContent(`[Uploaded ${file.name}] - Please note that for PDF/DOC/DOCX files, only the file name is captured in this demo. For a production app, you would need to extract text with appropriate libraries.`);
    }
  };

  const generateCoverLetter = async () => {
    setError(null);
    setLoading(true);

    if (!apiKey) {
      setError("Please enter your Gemini API key");
      setShowApiKeyInfo(true);
      setLoading(false);
      return;
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
    } catch (err) {
      console.error("Error generating cover letter:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
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
                            <li>Click on "Get API key" button</li>
                            <li>Create a new API key or use an existing one</li>
                            <li>Copy the key and paste it here</li>
                          </ol>
                          <p className="mt-2">The API key will be saved in your browser for future use.</p>
                        </div>
                      )}
                    </div>

                    {/* Resume Upload/Input Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Your Resume (Optional)
                      </label>
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
                        </div>
                        <textarea
                          value={resumeContent}
                          onChange={(e) => setResumeContent(e.target.value)}
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