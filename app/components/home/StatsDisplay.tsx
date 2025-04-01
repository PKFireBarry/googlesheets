import React from 'react';
import { FileSpreadsheet, CheckCircle } from 'lucide-react';

interface StatsDisplayProps {
  totalJobs: number;
  appliedJobs: number;
  totalSheetRows: number;
}

/**
 * Stats Display component
 * Shows job statistics in cards: total jobs, applied jobs, and remaining jobs
 */
const StatsDisplay: React.FC<StatsDisplayProps> = ({ 
  totalJobs,
  appliedJobs,
  totalSheetRows
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-2 sm:mb-3">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Total Jobs Found</h3>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{totalJobs}</p>
        {totalSheetRows > totalJobs && (
          <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
            {totalSheetRows - totalJobs} filtered out
          </p>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-2 sm:mb-3">
          <div className="bg-green-100 dark:bg-green-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Jobs Applied For</h3>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{appliedJobs}</p>
        {totalJobs > 0 && (
          <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
            {Math.round((appliedJobs / totalJobs) * 100)}% application rate
          </p>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-2 sm:mb-3">
          <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Remaining</h3>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {totalJobs - appliedJobs}
        </p>
        <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
          Jobs to apply for
        </p>
      </div>
    </div>
  );
};

export default StatsDisplay; 