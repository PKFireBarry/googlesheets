import React from 'react';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';
import ActionButton from '../ActionButton';

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
        <ActionButton onClick={onGenerate} color="blue" disabled={loading || disabled}>
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
        </ActionButton>
      </div>
    </div>
  );
};

export default GenerateButton; 