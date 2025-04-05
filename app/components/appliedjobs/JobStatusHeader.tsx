import React from 'react';
import { CheckCircle } from 'lucide-react';

interface JobStatusHeaderProps {
  count: number;
}

/**
 * Job Status Header component
 * Displays the number of applied jobs
 */
const JobStatusHeader: React.FC<JobStatusHeaderProps> = ({ count }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center text-gray-700 dark:text-gray-300">
        <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-500" />
        <span className="text-lg font-medium">
          {count} Applied Job{count !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};

export default JobStatusHeader; 