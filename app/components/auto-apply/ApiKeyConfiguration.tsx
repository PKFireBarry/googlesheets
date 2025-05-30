import React from 'react';
import { Key } from 'lucide-react';

interface ApiKeyConfigurationProps {
  apiKey: string;
  onChange?: (apiKey: string) => void;
}

/**
 * API Key Configuration Component for Auto Apply
 * Allows users to enter their API key for Gemini
 */
const ApiKeyConfiguration: React.FC<ApiKeyConfigurationProps> = ({
  apiKey,
  onChange
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center mb-4">
        <Key className="w-5 h-5 mr-2 text-blue-500" />
        <h3 className="text-lg font-semibold">API Key</h3>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Enter your Gemini API key to enable resume generation and auto-apply functionality.
      </p>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Gemini API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={handleChange}
          placeholder="Enter your Gemini API key"
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Your API key is stored locally and never sent to our servers.
          Get your API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google AI Studio</a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyConfiguration; 