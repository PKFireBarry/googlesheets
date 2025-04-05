import React from 'react';
import { Key, ExternalLink, X } from 'lucide-react';

interface ApiInfoModalProps {
  onClose: () => void;
}

/**
 * API Information Modal
 * Displays instructions for obtaining and using a Gemini API key
 */
const ApiInfoModal: React.FC<ApiInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <Key className="w-6 h-6 mr-2 text-blue-600" />
              Getting Your Free Gemini API Key
            </h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Why Use Your Own API Key?</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                <li>It's completely <span className="font-medium">FREE</span> to get and use</li>
                <li>Unlimited LinkedIn searches with no additional cost</li>
                <li>Faster results without relying on our shared API resources</li>
                <li>More reliable service without quota limitations</li>
                <li>Better privacy as all AI processing happens with your own key</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">How to Get Your API Key:</h3>
              <ol className="list-decimal pl-5 space-y-3 text-gray-700 dark:text-gray-300">
                <li>
                  <p>Visit the Google AI Studio API Key page:</p>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline inline-flex items-center mt-1"
                  >
                    https://aistudio.google.com/app/apikey
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>Sign in with your Google Account (or create one if needed)</li>
                <li>Click on "Create API Key" button</li>
                <li>Give your key a name (e.g., "LinkedIn Lookup")</li>
                <li>Copy the generated API key</li>
                <li>Paste it in the API Key field on this page</li>
                <li>Click "Save Configuration" to securely store your key</li>
              </ol>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-4 rounded-md">
              <h3 className="text-md font-medium text-blue-800 dark:text-blue-300 mb-1">Your API Key is Stored Securely</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Your API key is stored only in your browser's cookies with secure settings.
                We never store your API key on our servers or share it with third parties.
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiInfoModal; 