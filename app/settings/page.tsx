"use client";

import { useState, useEffect } from 'react';
import { Key, Upload, Save, Info, Trash2, CheckCircle, X } from 'lucide-react';
import Cookies from 'js-cookie';
import ResumeStorageUI from '../components/ResumeStorageUI';
import { toast } from 'sonner';
import ActionButton from '../components/ActionButton';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Load API key from cookie
    const savedApiKey = Cookies.get('geminiApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // Only render content that uses localStorage on the client side
  if (!isClient) {
    return null; // or a loading state
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const saveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }

    Cookies.set('geminiApiKey', apiKey.trim(), { expires: 30 });
    toast.success('API key saved successfully');
  };

  const handleResumeLoaded = () => {
    setHasResume(true);
    toast.success('Resume loaded successfully');
  };

  const handleResumeDeleted = () => {
    setHasResume(false);
    toast.success('Resume deleted successfully');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Settings</h1>

      {/* API Key Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Key className="w-5 h-5 mr-2 text-blue-600" />
              Gemini API Key
            </h2>
            <ActionButton
              onClick={() => setShowApiKeyInfo(!showApiKeyInfo)}
              color="blue"
              className="text-sm flex items-center"
            >
              <Info className="w-4 h-4 mr-1" />
              {showApiKeyInfo ? "Hide Help" : "Need Help?"}
            </ActionButton>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your Gemini API key"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
              />
              <ActionButton
                onClick={saveApiKey}
                color="blue"
                className="flex items-center"
                icon={Save}
              >
                Save
              </ActionButton>
            </div>

            {showApiKeyInfo && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md">
                <p className="font-medium mb-2">How to get your Gemini API key:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                  <li>Sign in with your Google account</li>
                  <li>Click on "Get API key" button</li>
                  <li>Create a new API key or use an existing one</li>
                  <li>Copy the key and paste it here</li>
                </ol>
                <p className="mt-3 text-sm">
                  Your API key is stored securely in your browser and is never sent to our servers.
                  It's used to improve the accuracy of AI-powered features across the application.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-4">
            <Upload className="w-5 h-5 mr-2 text-blue-600" />
            Resume Management
          </h2>
          
          <ResumeStorageUI
            onResumeLoaded={handleResumeLoaded}
            onResumeDeleted={handleResumeDeleted}
            showInfoText={true}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
} 