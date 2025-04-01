import React from 'react';

interface ActionButtonsProps {
  step: number;
  onPrevious: () => void;
  onNext?: () => void;
  onStartOver?: () => void;
  nextLabel?: string;
  isLoading?: boolean;
  isNextDisabled?: boolean;
  nextDisabledReason?: string;
}

/**
 * Action Buttons Component
 * Provides navigation between steps in the resume builder
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
  step,
  onPrevious,
  onNext,
  onStartOver,
  nextLabel = 'Next',
  isLoading = false,
  isNextDisabled = false,
  nextDisabledReason = ''
}) => {
  return (
    <div className="flex justify-between">
      <button
        onClick={onPrevious}
        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Back
      </button>
      
      {step === 3 && onStartOver ? (
        <button
          onClick={onStartOver}
          className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Start Over
        </button>
      ) : onNext ? (
        <button
          onClick={onNext}
          disabled={isLoading || isNextDisabled}
          title={isNextDisabled ? nextDisabledReason : ''}
          className={`${
            isLoading ? 'bg-blue-400' : isNextDisabled ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            nextLabel
          )}
        </button>
      ) : null}
    </div>
  );
};

export default ActionButtons; 