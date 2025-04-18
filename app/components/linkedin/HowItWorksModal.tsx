import React from 'react';
import { X, MousePointer, Linkedin, MessageSquare, Settings } from 'lucide-react';
import ActionButton from '../ActionButton';

interface HowItWorksModalProps {
  onClose: () => void;
}

/**
 * "How It Works" Modal Component
 * Explains the LinkedIn Connection Finder functionality and workflow
 */
const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden" 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How It Works</h2>
            <ActionButton 
              onClick={onClose} 
              color="gray"
              className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </ActionButton>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Find relevant LinkedIn contacts for job applications.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8 max-h-[70vh] overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
                <MousePointer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">1. Select a Job</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Navigate back to the <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline">homepage</a> and find a job you're interested in from your Google Sheet.
                  Click the "Find HR Contacts" button on the job card. This will bring you back to this page with the job details loaded.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-4">
                <Linkedin className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">2. Find Contacts</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Once the job details are loaded, the tool automatically searches LinkedIn for potential HR, Talent Acquisition, or Hiring Manager contacts at the selected company.
                  This uses a background process and AI to identify relevant people.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-4">
                <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">3. Generate & Edit Messages</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  For each contact found, an initial outreach message tailored to the job is generated using AI. You can edit these messages directly, regenerate them, or copy them to your clipboard to send via LinkedIn.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mr-4">
                <Settings className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">4. API Key (Required)</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  This tool uses the Google Gemini API for processing search results and generating messages. You'll need to provide your own free API key.
                  If you haven't already, you'll see a section to configure it. Your key is saved securely in your browser's cookies.
                </p>
                 <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:underline mt-2"
                >
                  Get a free Gemini API key
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 sm:px-8 sm:py-5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end">
            <ActionButton 
              type="button" 
              onClick={onClose}
              color="blue"
              className="px-4 py-2 text-sm font-medium rounded-md"
            >
              Got it!
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal; 