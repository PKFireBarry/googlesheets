import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: string | null;
  onClearFilters: () => void;
}

/**
 * Error display component
 * Shows error messages with an option to clear filters if applicable
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onClearFilters }) => {
  if (!error) return null;
  
  return (
    <div className="max-w-4xl mx-auto mb-6">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <p>{error}</p>
        </div>
        {error.includes('filter') && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={onClearFilters}
              className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay; 