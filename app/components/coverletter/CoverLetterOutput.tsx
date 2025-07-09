import React from 'react';
import { Download, Copy, FileText, Sparkles } from 'lucide-react';

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
    <div id="cover-letter-result" className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden border border-white/20 dark:border-slate-700/50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Your Cover Letter</h2>
              <p className="text-sm text-violet-100">
                Generated for {jobTitle} at {companyName}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-2">
            <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
              <span className="text-xs font-medium text-white">Ready to use</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        {/* Cover Letter Content */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 rounded-xl opacity-60"></div>
          <div className="relative bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-xl shadow-inner overflow-hidden">
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 break-words">
                  {coverLetterText}
                </pre>
              </div>
            </div>
            
            {/* Fade overlay for long content */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none"></div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="group relative inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <Download className="w-4 h-4 mr-2 group-hover:animate-bounce" />
              Download PDF
            </button>
            
            <button
              type="button"
              onClick={onDownloadDocx}
              className="group relative inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Download className="w-4 h-4 mr-2 group-hover:animate-bounce" />
              Download DOCX
            </button>
            
            <button
              type="button"
              onClick={onCopyToClipboard}
              className="group relative inline-flex items-center px-6 py-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              <Copy className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Copy Text
            </button>
            
            <button
              type="button"
              onClick={onRegenerate}
              className="group relative inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              <FileText className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
              Regenerate
            </button>
          </div>
          
          {/* Tips */}
          <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800/50 dark:to-blue-900/20 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Pro Tips</h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• Review and customize the cover letter before sending</li>
                  <li>• Use the PDF version for professional applications</li>
                  <li>• Regenerate if you want a different tone or approach</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverLetterOutput; 