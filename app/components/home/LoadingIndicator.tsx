import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  message?: string;
}

/**
 * Loading Indicator component
 * Displays a spinning loader with optional message
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message = 'Loading jobs...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12">
      <div className="animate-spin mb-2 sm:mb-4">
        <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600 dark:text-blue-400" />
      </div>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 animate-pulse">{message}</p>
    </div>
  );
};

export default LoadingIndicator; 