import React from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface ActionButtonsProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  isLoading?: boolean;
  onStartOver?: () => void;
}

/**
 * Action Buttons Component for Auto Apply
 * Provides navigation buttons for the auto-apply workflow
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  onBack,
  onNext,
  nextLabel = 'Next',
  isLoading = false,
  onStartOver
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between w-full gap-4">
      <div className="flex gap-4">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        )}
        
        {onStartOver && (
          <button
            onClick={onStartOver}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Start Over
          </button>
        )}
      </div>
      
      <button
        onClick={onNext}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing...' : nextLabel}
        {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
      </button>
    </div>
  );
};

export default ActionButtons; 