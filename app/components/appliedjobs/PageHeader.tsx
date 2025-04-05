import React from 'react';

/**
 * Page header component for the Applied Jobs page
 * Displays the title and description
 */
const PageHeader = () => {
  return (
    <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 sm:p-10 text-white mb-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-3">
        Applied Jobs
      </h1>
      <p className="text-green-100 text-lg max-w-2xl">
        Track and manage all the jobs you've applied to. Keep notes on your application status and interview progress.
      </p>
    </div>
  );
};

export default PageHeader; 