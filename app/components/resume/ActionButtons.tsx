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
    <div className="flex justify-between items-center pt-8 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={onPrevious}
        className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-base font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 space-x-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>
      
      {step === 4 && onStartOver ? (
        <button
          onClick={onStartOver}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 space-x-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Start Over</span>
        </button>
      ) : onNext ? (
        <button
          onClick={onNext}
          disabled={isLoading || isNextDisabled}
          title={isNextDisabled ? nextDisabledReason : ''}
          className={`${
            isLoading 
              ? 'bg-blue-400 cursor-not-allowed' 
              : isNextDisabled 
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105'
          } text-white px-6 py-3 border border-transparent rounded-xl text-base font-semibold transition-all duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 space-x-2`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{nextLabel}</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      ) : null}
    </div>
  );
};

export default ActionButtons; 