import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading State Component for Cover Letter
 * Displays a loading indicator while the page is being loaded
 */
const LoadingState: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 animate-pulse">
            Create Your Cover Letter
          </h1>
          <div className="w-2/3 h-4 bg-white/20 rounded animate-pulse"></div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader2 className="h-10 w-10 mx-auto mb-4 text-blue-600 animate-spin" />
            <p className="text-gray-700 dark:text-gray-300">Loading cover letter generator...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState; 