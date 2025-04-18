import React from 'react';
import { Download, Copy, FileText } from 'lucide-react';
import ActionButton from '../ActionButton';

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
          <ActionButton onClick={onDownloadPdf} icon={Download} color="green">Download as PDF</ActionButton>
          <ActionButton onClick={onDownloadDocx} icon={Download} color="indigo">Download as DOCX</ActionButton>
          <ActionButton onClick={onCopyToClipboard} icon={Copy} color="blue">Copy to Clipboard</ActionButton>
          <ActionButton onClick={onRegenerate} icon={FileText} color="gray">Regenerate</ActionButton>
        </div>
      </div>
    </div>
  );
};

export default CoverLetterOutput; 