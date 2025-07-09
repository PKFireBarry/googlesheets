import React from 'react';
import { Sparkles, Loader2, AlertCircle, Zap } from 'lucide-react';

interface GenerateButtonProps {
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onGenerate: () => void;
}

/**
 * Generate Button Component for Cover Letter
 * Handles the cover letter generation action with loading states
 */
const GenerateButton: React.FC<GenerateButtonProps> = ({
  loading,
  error,
  disabled,
  onGenerate,
}) => {
  return (
    <div className="p-6 bg-gradient-to-br from-slate-50/50 to-white/50 dark:from-slate-800/30 dark:to-slate-700/30">
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Generation Failed
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex flex-col items-center space-y-4">
        <button
          onClick={onGenerate}
          disabled={disabled || loading}
          className={`group relative overflow-hidden inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 min-w-[200px] ${
            disabled || loading
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 hover:from-violet-600 hover:via-purple-600 hover:to-indigo-700 text-white shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 transform hover:-translate-y-1 focus:ring-violet-500'
          }`}
        >
          {/* Background animation */}
          {!disabled && !loading && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 group-hover:animate-shimmer"></div>
          )}
          
          {/* Button content */}
          <div className="relative flex items-center space-x-3">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : disabled ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>Complete Required Fields</span>
              </>
            ) : (
              <>
                <div className="relative">
                  <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 group-hover:animate-pulse" />
                </div>
                <span>Generate Cover Letter</span>
              </>
            )}
          </div>
        </button>

        {/* Status indicator */}
        <div className="flex items-center space-x-2 text-sm">
          {loading ? (
            <div className="flex items-center space-x-2 text-violet-600 dark:text-violet-400">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse delay-150"></div>
              </div>
              <span className="font-medium">AI is crafting your perfect cover letter...</span>
            </div>
          ) : disabled ? (
            <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <span>Please fill in all required fields to continue</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Ready to generate your personalized cover letter</span>
            </div>
          )}
        </div>

        {/* Tips */}
        {!loading && (
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 max-w-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Pro Tip
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  The more detailed your job description and resume, the better your AI-generated cover letter will be. 
                  Our AI analyzes key requirements and matches them with your experience.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default GenerateButton; 