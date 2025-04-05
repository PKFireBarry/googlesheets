import React from 'react';

/**
 * Page header component for the Resume Builder page
 * Displays the title and description
 */
const PageHeader = () => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-6 sm:mb-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">Resume Builder</h1>
          <p className="text-mobile-sm text-blue-100 max-w-2xl">
            Studies show that 61% of recruiters spend 5 seconds on initial screening. Tailored resumes with relevant keywords are more likely to pass Applicant Tracking Systems and get you the interview.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 