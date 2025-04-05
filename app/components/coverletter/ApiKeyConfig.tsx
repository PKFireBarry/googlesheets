import React from 'react';
import { Info } from 'lucide-react';

interface ApiKeyConfigProps {
  apiKey: string;
  showApiKeyInfo: boolean;
  onApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleApiKeyInfo: () => void;
}

/**
 * API Key Configuration Component for Cover Letter
 * Handles the Gemini API key input and information display
 */
const ApiKeyConfig: React.FC<ApiKeyConfigProps> = ({
  apiKey,
  showApiKeyInfo,
  onApiKeyChange,
  onToggleApiKeyInfo
}) => {
  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Gemini API Key</h2>
        <button
          type="button"
          onClick={onToggleApiKeyInfo}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center"
        >
          <Info className="w-4 h-4 mr-1" />
          {showApiKeyInfo ? "Hide Help" : "Need Help?"}
        </button>
      </div>
      
      <div className="space-y-4">
        <input
          type="password"
          value={apiKey}
          onChange={onApiKeyChange}
          placeholder="Enter your Gemini API key"
          className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
        />
        
        {showApiKeyInfo && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm">
            <p className="mb-2">To get a Gemini API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm mb-2">
              <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
              <li>Sign in with your Google account</li>
              <li>Click on &quot;Get API key&quot; button</li>
              <li>Create a new API key or use an existing one</li>
              <li>Copy the key and paste it here</li>
            </ol>
            <p>The API key will be saved in your browser for future use.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyConfig; 