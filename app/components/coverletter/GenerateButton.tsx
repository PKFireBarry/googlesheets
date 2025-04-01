import React from 'react';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';

interface GenerateButtonProps {
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onGenerate: () => void;
}

/**
 * Generate Button Component
 * Displays the button to generate a cover letter with loading state
 */
const GenerateButton: React.FC<GenerateButtonProps> = ({
  loading,
  error,
  disabled,
  onGenerate
}) => {
  return (
    <div className="p-6">
      {error && (
        <div className="p-3 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md flex items-start">
          <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || disabled}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Generate Cover Letter
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default GenerateButton; 