import React from 'react';

interface ApiKeyConfigurationProps {
  apiKey: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * API Key Configuration Component
 * Allows users to enter and save their Gemini API key
 */
const ApiKeyConfiguration: React.FC<ApiKeyConfigurationProps> = ({
  apiKey,
  onChange
}) => {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-3">Gemini API Key</h3>
      <div>
        <input
          type="password"
          value={apiKey}
          onChange={onChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
          placeholder="Enter your Gemini API key"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your API key is stored locally and never sent to our servers. You can get a free Gemini API key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Google AI Studio
          </a>.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyConfiguration; 