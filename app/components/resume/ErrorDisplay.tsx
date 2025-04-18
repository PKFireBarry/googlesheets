import React from 'react';
import Alert from '../appliedjobs/ErrorMessage';

interface ErrorDisplayProps {
  error: string | null;
}

/**
 * Error Display Component
 * Shows error messages to the user
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  if (!error) return null;
  return <Alert message={error} type="error" />;
};

export default ErrorDisplay; 