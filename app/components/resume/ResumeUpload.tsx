import React, { useRef } from 'react';

interface ResumeUploadProps {
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  resumePdfData: string | null;
  masterResumeExists: boolean;
  onLoadExisting: () => void;
  onShowDeleteConfirm: () => void;
  activeTab: 'upload' | 'manual';
  onTabChange: (tab: 'upload' | 'manual') => void;
}

/**
 * Resume Upload Component
 * Handles uploading and managing resume files
 */
const ResumeUpload: React.FC<ResumeUploadProps> = ({
  onUpload,
  isLoading,
  resumePdfData,
  masterResumeExists,
  onLoadExisting,
  onShowDeleteConfirm,
  activeTab,
  onTabChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="flex -mb-px space-x-6">
          <button 
            onClick={() => onTabChange('upload')}
            className={`pb-3 px-1 ${activeTab === 'upload' 
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-medium' 
              : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Upload Resume
          </button>
          <button 
            onClick={() => onTabChange('manual')}
            className={`pb-3 px-1 ${activeTab === 'manual' 
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-medium' 
              : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Enter Job Details
          </button>
        </nav>
      </div>
      
      {/* Upload Resume Content */}
      {activeTab === 'upload' && (
        <>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-mobile-sm">
            Upload your existing resume or use a previously uploaded one to get started.
          </p>
          
          {masterResumeExists && (
            <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5 rounded-lg mb-6">
              <div className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-300">Resume Found</h3>
                  <p className="text-green-700 dark:text-green-400 text-mobile-sm">
                    We've found a previously uploaded resume. You can use it or upload a new one.
                  </p>
                </div>
              </div>
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
                    onClick={onLoadExisting}
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
                      onChange={onUpload}
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
                    onClick={onShowDeleteConfirm}
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
                    onChange={onUpload}
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
        </>
      )}
    </>
  );
};

export default ResumeUpload; 