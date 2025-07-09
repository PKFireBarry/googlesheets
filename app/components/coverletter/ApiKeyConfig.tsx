import React from 'react';
import { Info, Key, ExternalLink, Shield } from 'lucide-react';

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
    <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/30 to-transparent dark:from-slate-800/20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
            <Key className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              API Configuration
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your Gemini API key for AI cover letter generation
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={onToggleApiKeyInfo}
          className="group inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Info className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
          {showApiKeyInfo ? "Hide Help" : "Need Help?"}
        </button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Gemini API Key *
          </label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="password"
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Enter your Gemini API key"
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
            {apiKey && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Your API key is stored securely in your browser and never shared
          </p>
        </div>
        
        {showApiKeyInfo && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-6 shadow-sm">
            <div className="flex items-start space-x-3 mb-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  How to get your Gemini API key
                </h4>
                <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Visit Google AI Studio to create your API key</li>
                    <li>Sign in with your Google account</li>
                    <li>Click the "Get API key" button</li>
                    <li>Create a new API key or use an existing one</li>
                    <li>Copy the key and paste it above</li>
                  </ol>
                  
                  <div className="mt-4 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        Get your API key at Google AI Studio
                      </span>
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Open AI Studio
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  Security: Your API key is stored locally in your browser and is never transmitted to our servers.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyConfig; 