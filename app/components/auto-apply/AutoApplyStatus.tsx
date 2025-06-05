import React from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface AutoApplyStatusProps {
  isUploading: boolean;
  status: string;
  result: any;
  error: string;
  progress?: number;
}

/**
 * Auto Apply Status Component
 * Displays the current status of the auto-apply process
 */
const AutoApplyStatus: React.FC<AutoApplyStatusProps> = ({
  isUploading,
  status,
  result,
  error,
  progress = 0
}) => {
  if (!status && !error) {
    return null;
  }

  return (
    <div className="mt-4">
      {/* Status Display */}
      {status && (
        <div className={`p-4 rounded-lg ${getStatusBackgroundColor(status)}`}>
          <div className="flex items-center mb-2">
            {getStatusIcon(status, isUploading)}
            <h4 className="font-semibold ml-2">{getStatusTitle(status)}</h4>
          </div>
          <p className="text-sm">{getStatusMessage(status, result)}</p>
          
          {/* Progress Bar - Show for in-progress states */}
          {['starting', 'in_progress', 'processing', 'uploading'].includes(status) && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-right mt-1">{progress}%</p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg mt-2">
          <div className="flex items-center mb-1">
            <AlertCircle className="h-5 w-5 mr-2" />
            <h4 className="font-semibold">Error</h4>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

// Helper function to get the appropriate background color based on status
function getStatusBackgroundColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300';
    case 'failed':
      return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300';
    case 'starting':
    case 'in_progress':
    case 'processing':
    case 'uploading':
      return 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300';
    case 'waiting':
    case 'pending':
      return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
    default:
      return 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
  }
}

// Helper function to get the appropriate icon based on status
function getStatusIcon(status: string, isUploading: boolean): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    case 'failed':
      return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
    case 'waiting':
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    case 'starting':
    case 'in_progress':
    case 'processing':
    case 'uploading':
    default:
      return <Loader2 className={`h-5 w-5 text-blue-600 dark:text-blue-400 ${isUploading ? 'animate-spin' : ''}`} />;
  }
}

// Helper function to get a human-readable status title
function getStatusTitle(status: string): string {
  switch (status) {
    case 'completed':
      return 'Application Submitted';
    case 'failed':
      return 'Submission Failed';
    case 'starting':
      return 'Starting Application Process';
    case 'in_progress':
      return 'Application In Progress';
    case 'processing':
      return 'Processing Resume';
    case 'uploading':
      return 'Uploading Resume';
    case 'waiting':
    case 'pending':
      return 'Waiting for Response';
    default:
      return 'Processing';
  }
}

// Helper function to get a descriptive status message
function getStatusMessage(status: string, result: any): string {
  switch (status) {
    case 'completed':
      return result?.message || 'Your application has been successfully submitted.';
    case 'failed':
      return 'There was an error submitting your application. Please try again.';
    case 'starting':
      return 'Preparing your resume for submission...';
    case 'in_progress':
      return 'Submitting your application. This may take a few moments...';
    case 'processing':
      return 'Processing your resume for the application...';
    case 'uploading':
      return 'Uploading your resume to the job portal...';
    case 'waiting':
    case 'pending':
      return 'Waiting for the job portal to process your application...';
    default:
      return 'Processing your application...';
  }
}

export default AutoApplyStatus; 