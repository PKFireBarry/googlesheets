import React from 'react';

/**
 * Page header component for the LinkedIn Lookup page
 * Displays the title and description of the LinkedIn Connection Finder
 */
const PageHeader = () => {
  return (
    <div className="mb-4 sm:mb-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
              LinkedIn Connection Finder
            </h1>
            <p className="text-mobile-sm text-blue-100 max-w-2xl">
              Find recruiters at a company on LinkedIn to help with your job application chances and grow your network in the process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 