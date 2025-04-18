import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  message?: string;
}

/**
 * Loading Indicator component
 * Displays a spinning loader with optional message
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message = 'Loading jobs...' }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 dark:bg-gray-900/80 backdrop-blur-sm animate-fade-in">
      {/* Animated blurred background bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-72 h-72 bg-blue-400/30 rounded-full blur-3xl animate-pulse -top-24 -left-24" />
        <div className="absolute w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse -bottom-32 -right-32" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-spin mb-4 drop-shadow-lg">
          <Loader2 className="h-16 w-16 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-200 animate-pulse font-semibold drop-shadow-md">{message}</p>
      </div>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.4,0,0.2,1) both;
        }
      `}</style>
    </div>
  );
};

export default LoadingIndicator; 