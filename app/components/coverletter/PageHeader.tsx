import React from 'react';
import { Sparkles, FileText, Zap } from 'lucide-react';

/**
 * Page header component for the Cover Letter page
 * Displays the title and description
 */
const PageHeader = () => {
  return (
    <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-700 dark:via-purple-700 dark:to-indigo-800 rounded-3xl shadow-2xl p-8 sm:p-12 text-white mb-8 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
      
      {/* Floating icons */}
      <div className="absolute top-8 right-8 animate-float">
        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
      </div>
      
      <div className="absolute bottom-8 right-16 animate-float-delayed">
        <div className="w-6 h-6 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
          <div className="flex-1">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-5xl font-bold mb-2 bg-gradient-to-r from-white via-purple-100 to-blue-100 bg-clip-text text-transparent">
                  AI Cover Letter Generator
                </h1>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-purple-100">Powered by Gemini AI</span>
                </div>
              </div>
            </div>
            
            <p className="text-lg text-purple-100 max-w-2xl leading-relaxed mb-6">
              Create compelling, personalized cover letters in seconds. Our AI analyzes your resume and 
              the job description to craft the perfect introduction that showcases your unique value.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="text-sm font-medium">AI-Powered</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <Zap className="w-4 h-4 text-blue-300" />
                <span className="text-sm font-medium">Instant Results</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <FileText className="w-4 h-4 text-green-300" />
                <span className="text-sm font-medium">Professional Quality</span>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:block">
            <div className="relative w-48 h-32">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl backdrop-blur-sm border border-white/20 shadow-xl">
                <div className="p-6 h-full flex flex-col justify-center">
                  <div className="space-y-2">
                    <div className="h-2 bg-white/30 rounded-full"></div>
                    <div className="h-2 bg-white/20 rounded-full w-3/4"></div>
                    <div className="h-2 bg-white/20 rounded-full w-1/2"></div>
                  </div>
                  <div className="mt-4 flex space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Custom animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-float-delayed {
          animation: float-delayed 3s ease-in-out infinite 1.5s;
        }
      `}</style>
    </div>
  );
};

export default PageHeader; 