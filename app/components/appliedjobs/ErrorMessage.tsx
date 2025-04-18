import React from 'react';
import { AlertCircle } from 'lucide-react';

interface AlertProps {
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  icon?: React.ElementType;
}

const typeStyles = {
  error: 'bg-red-50 border border-red-200 text-red-700',
  warning: 'bg-yellow-50 border border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border border-blue-200 text-blue-800',
  success: 'bg-green-50 border border-green-200 text-green-800',
};

const typeIcons = {
  error: AlertCircle,
  warning: AlertCircle,
  info: AlertCircle,
  success: AlertCircle,
};

const Alert: React.FC<AlertProps> = ({ message, type = 'error', icon: Icon }) => {
  if (!message) return null;
  const IconToUse = Icon || typeIcons[type];
  return (
    <div className={`w-full max-w-2xl mx-auto my-4 px-4`}>
      <div className={`flex items-center rounded-md px-4 py-3 ${typeStyles[type]}`} role="alert">
        {IconToUse && <IconToUse className="h-5 w-5 mr-2 flex-shrink-0" />}
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
};

export default Alert; 