import React from 'react';
import { Settings, Key, HelpCircle } from 'lucide-react';

interface JinaApiKeyConfigurationProps {
  jinaApiKey: string;
  setJinaApiKey: (key: string) => void;
  onSave: () => void;
  onHelp: () => void;
}

/**
 * Jina.ai API Key Configuration Component
 * Allows users to enter and save their Jina.ai API key
 */
const JinaApiKeyConfiguration: React.FC<JinaApiKeyConfigurationProps> = ({
  jinaApiKey,
  setJinaApiKey,
  onSave,
  onHelp
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 h-full">
      <div className="flex items-center mb-4">
        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg mr-3">
          <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Jina.ai API Configuration</h2>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label htmlFor="jina-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Jina.ai API Key
          </label>
          <button
            onClick={onHelp}
            className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 inline-flex items-center text-xs"
          >
            <HelpCircle className="w-3 h-3 mr-1" />
            How to get an API key
          </button>
        </div>
        <div className="relative">
          <input
            id="jina-api-key"
            type="password"
            value={jinaApiKey}
            onChange={(e) => setJinaApiKey(e.target.value)}
            placeholder="Enter your Jina.ai API key"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <Key className="h-4 w-4 text-gray-500" />
          </div>
        </div>
        <div className="mt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Get a Jina.ai API key from{" "}
            <a 
              href="https://jina.ai/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 underline"
            >
              Jina.ai
            </a>
          </p>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

export default JinaApiKeyConfiguration; 