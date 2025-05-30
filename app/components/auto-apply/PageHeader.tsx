import React from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';

/**
 * Page Header Component for Auto Apply page
 */
const PageHeader: React.FC = () => {
  return (
    <div className="mb-8">
      <div className="flex items-center mb-2">
        <Upload className="w-6 h-6 mr-2 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Auto Apply</h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        Generate a tailored resume and automatically apply to jobs with our AI-powered tool.
      </p>
      <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
        <FileSpreadsheet className="w-4 h-4 mr-1" />
        <Link href="/" className="hover:underline">
          Back to Job Listings
        </Link>
      </div>
    </div>
  );
};

export default PageHeader; 