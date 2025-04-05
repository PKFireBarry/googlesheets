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
 * Now hidden on mobile screens to save space
 */
const StatsDisplay: React.FC<StatsDisplayProps> = ({ 
  totalJobs,
  appliedJobs,
  totalSheetRows
}) => {
  return (
    <div className="hidden sm:grid sm:grid-cols-3 gap-2 mb-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-1">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-1 rounded-md mr-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-medium text-xs text-gray-900 dark:text-white">Total Jobs Found</h3>
        </div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalJobs}</p>
        {totalSheetRows > totalJobs && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalSheetRows - totalJobs} filtered out
          </p>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-1">
          <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded-md mr-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-medium text-xs text-gray-900 dark:text-white">Jobs Applied For</h3>
        </div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{appliedJobs}</p>
        {totalJobs > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {Math.round((appliedJobs / totalJobs) * 100)}% application rate
          </p>
        )}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center mb-1">
          <div className="bg-purple-100 dark:bg-purple-900/30 p-1 rounded-md mr-2">
            <CheckCircle className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-medium text-xs text-gray-900 dark:text-white">Remaining</h3>
        </div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          {totalJobs - appliedJobs}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Jobs to apply for
        </p>
      </div>
    </div>
  );
};

export default StatsDisplay; 