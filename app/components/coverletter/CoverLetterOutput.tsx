import React from 'react';
import { Download, Copy, FileText } from 'lucide-react';

interface CoverLetterOutputProps {
  coverLetterText: string;
  jobTitle: string;
  companyName: string;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  onCopyToClipboard: () => void;
  onRegenerate: () => void;
}

/**
 * Cover Letter Output Component
 * Displays the generated cover letter and provides download options
 */
const CoverLetterOutput: React.FC<CoverLetterOutputProps> = ({
  coverLetterText,
  jobTitle,
  companyName,
  onDownloadPdf,
  onDownloadDocx,
  onCopyToClipboard,
  onRegenerate
}) => {
  if (!coverLetterText) {
    return null;
  }

  return (
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
            onClick={onDownloadPdf}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Download as PDF
          </button>
          <button
            type="button"
            onClick={onDownloadDocx}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="w-4 h-4 mr-2" />
            Download as DOCX
          </button>
          <button
            type="button"
            onClick={onCopyToClipboard}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FileText className="w-4 h-4 mr-2" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverLetterOutput; 