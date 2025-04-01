import React from 'react';
import { Briefcase } from 'lucide-react';

/**
 * Empty state component
 * Displays a message when no applied jobs are found
 */
const EmptyState: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
        <Briefcase className="h-8 w-8 text-gray-500 dark:text-gray-400" />
      </div>
      <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Applied Jobs Yet</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        You haven't marked any jobs as applied. When you apply for jobs, they'll appear here.
      </p>
    </div>
  );
};

export default EmptyState; 