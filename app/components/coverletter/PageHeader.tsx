import React from 'react';

/**
 * Page header component for the Cover Letter page
 * Displays the title and description
 */
const PageHeader = () => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
            Create Your Cover Letter
          </h1>
          <p className="text-mobile-sm text-blue-100 max-w-2xl">
            Generate tailored cover letters in seconds using your resume and job details.
            Perfect for customizing your application for each position.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 