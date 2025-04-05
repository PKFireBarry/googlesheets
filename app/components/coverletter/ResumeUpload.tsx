import React from 'react';
import { Info } from 'lucide-react';

interface ResumeUploadProps {
  resumeContent: string;
  resumePdfData: string | null;
  savedResumes: {[key: string]: string};
  showResumeForm: boolean;
  onResumeContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onResumeUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadSavedResume: (name: string) => void;
  onToggleResumeForm: () => void;
}

/**
 * Resume Upload Component for Cover Letter
 * Handles the resume upload and display functionality
 */
const ResumeUpload: React.FC<ResumeUploadProps> = ({
  resumeContent,
  resumePdfData,
  savedResumes,
  showResumeForm,
  onResumeContentChange,
  onResumeUpload,
  onLoadSavedResume,
  onToggleResumeForm
}) => {
  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Your Resume (Optional)</h2>
        
        <button
          type="button"
          onClick={onToggleResumeForm}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
        >
          {showResumeForm ? 'Hide Form' : 'Show Resume Form'}
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <input
              type="file"
              id="resume-upload"
              accept=".pdf,.docx,.txt"
              onChange={onResumeUpload}
              className="sr-only"
            />
            <label
              htmlFor="resume-upload"
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload Resume
            </label>
          </div>
          
          {Object.keys(savedResumes).length > 0 && (
            <div className="relative inline-block text-left">
              <select
                onChange={(e) => onLoadSavedResume(e.target.value)}
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
          onChange={onResumeContentChange}
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
  );
};

export default ResumeUpload; 