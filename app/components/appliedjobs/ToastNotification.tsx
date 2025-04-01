import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface ToastNotificationProps {
  message: string;
  show: boolean;
}

/**
 * Toast Notification component
 * Displays a temporary notification for user actions
 */
const ToastNotification: React.FC<ToastNotificationProps> = ({ message, show }) => {
  if (!show) return null;
  
  const isRemovalMessage = message.includes('removed');
  
  return (
    <div className={`fixed bottom-4 right-4 ${isRemovalMessage ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-up z-50 flex items-center`}>
      {isRemovalMessage ? 
        <XCircle className="w-5 h-5 mr-2" /> : 
        <CheckCircle className="w-5 h-5 mr-2" />
      }
      {message}
    </div>
  );
};

export default ToastNotification; 