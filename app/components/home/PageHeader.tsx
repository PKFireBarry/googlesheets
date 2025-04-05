import React from 'react';

/**
 * Page header component for the Home page
 * Displays the title and description with blue styling
 */
const PageHeader = () => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
            Find Jobs Tailored to You!
          </h1>
          <p className="text-mobile-sm text-blue-100 max-w-2xl">
            Find jobs tailored to your skills, location, and salary preferences. Updated daily from top job boards to help you find the perfect opportunity and save time on checking multiple sites for latest listings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageHeader; 