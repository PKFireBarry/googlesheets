import React, { useRef } from 'react';
import { ResumeData, PersonalInfo } from '../../types/resume';
import { parseResumeFile } from '../../utils/resumeParser';

interface ResumeUploadProps {
  onUploadResume?: (resumeData: ResumeData) => void;
  onUploadPdf?: (pdfData: string) => void;
  onNext?: () => void;
  hasExistingResume?: boolean;
  personalInfo?: PersonalInfo;
  onPersonalInfoChange?: (info: PersonalInfo) => void;
}

/**
 * Resume Upload Component for Auto Apply
 * Handles uploading and managing resume files
 */
const ResumeUpload: React.FC<ResumeUploadProps> = ({
  onUploadResume,
  onUploadPdf,
  onNext,
  hasExistingResume,
  personalInfo,
  onPersonalInfoChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Process the file based on its type
      if (file.type === 'application/pdf') {
        // Handle PDF file
        const reader = new FileReader();
        reader.onload = (e) => {
          const pdfData = e.target?.result as string;
          if (onUploadPdf) {
            onUploadPdf(pdfData);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Parse resume data from DOCX or other formats
        const resumeData = await parseResumeFile(file);
        if (onUploadResume) {
          onUploadResume(resumeData);
        }
      }

      // Move to next step if provided
      if (onNext) {
        onNext();
      }
    } catch (error) {
      console.error('Error processing resume file:', error);
      // Handle error
    }
  };

  const handlePersonalInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!personalInfo || !onPersonalInfoChange) return;
    
    const { name, value } = e.target;
    onPersonalInfoChange({
      ...personalInfo,
      [name]: value
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Upload Your Resume</h3>
      
      {hasExistingResume ? (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-green-800 dark:text-green-300 text-sm flex items-start mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Resume Already Loaded</p>
            <p>Your resume is already loaded. You can continue to the next step or upload a new one.</p>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <div className="flex flex-col items-center justify-center py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h4 className="text-lg font-medium mb-2">Upload Your Resume</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your resume to get started with the auto-apply process.
            </p>
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Select Resume File
            </label>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Supported formats: PDF (recommended), DOCX
            </p>
          </div>
        </div>
      )}
      
      {/* Personal Information Section */}
      {personalInfo && onPersonalInfoChange && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Personal Information</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This information will be used to customize your resume.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={personalInfo.name}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={personalInfo.email}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={personalInfo.phone}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={personalInfo.location}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn
              </label>
              <input
                type="text"
                name="linkedin"
                value={personalInfo.linkedin}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website
              </label>
              <input
                type="text"
                name="website"
                value={personalInfo.website}
                onChange={handlePersonalInfoChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Next Button */}
      {onNext && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onNext}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Continue to Job Details
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload; 