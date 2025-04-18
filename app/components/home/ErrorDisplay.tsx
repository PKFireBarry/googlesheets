import React from 'react';
import Alert from '../appliedjobs/ErrorMessage';

interface ErrorDisplayProps {
  error: string | null;
  onClearFilters?: () => void;
}

/**
 * Error display component
 * Shows error messages with an option to clear filters if applicable
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClearFilters }) => {
  if (!error) return null;
  return (
    <>
      <Alert message={error} type="error" />
      {onClearFilters && error.includes('filter') && (
        <div className="w-full max-w-2xl mx-auto px-4 mb-4">
          <button
            onClick={onClearFilters}
            className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </>
  );
};

export default ErrorDisplay; 