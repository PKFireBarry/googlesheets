import React from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';

interface SheetFormProps {
  sheetUrl: string;
  setSheetUrl: React.Dispatch<React.SetStateAction<string>>;
  handleUrlSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isLoadingJobs: boolean;
  handleResetJobs: () => void;
  hasJobs: boolean;
}

/**
 * Sheet Form component
 * Handles Google Sheet URL input and submission
 */
const SheetForm: React.FC<SheetFormProps> = ({
  sheetUrl,
  setSheetUrl,
  handleUrlSubmit,
  isLoading,
  isLoadingJobs,
  handleResetJobs,
  hasJobs
}) => {
  return (
    <div className="mb-6 sm:mb-8">
      <form onSubmit={handleUrlSubmit} className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
          <div className="flex-grow">
            <label htmlFor="sheet-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Google Sheet URL
            </label>
            <input
              id="sheet-url"
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-3 py-2 sm:py-2.5 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading || isLoadingJobs}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Note: Make sure your sheet has a tab named "Sheet1" for legacy compatibility.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || isLoadingJobs || !sheetUrl}
              className={`inline-flex items-center px-3 sm:px-4 py-2 sm:py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading || isLoadingJobs || !sheetUrl
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading
                </span>
              ) : (
                <>
                  Load Jobs
                  <ArrowRight className="ml-1.5 sm:ml-2 h-4 w-4" />
                </>
              )}
            </button>
            
            {hasJobs && (
              <button
                type="button"
                onClick={handleResetJobs}
                className="inline-flex items-center px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                <span className="hidden sm:inline ml-1.5">Reset</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default SheetForm; 