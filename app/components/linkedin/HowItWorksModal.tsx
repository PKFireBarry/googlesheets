import React from 'react';
import { 
  HelpCircle, X, ExternalLink, Sparkles, Linkedin, 
  MessageSquare, RefreshCw, ArrowRight, Clock, Search 
} from 'lucide-react';

interface HowItWorksModalProps {
  onClose: () => void;
}

/**
 * "How It Works" Modal Component
 * Explains the LinkedIn Connection Finder functionality and workflow
 */
const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <HelpCircle className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
            How to Use LinkedIn Connection Finder
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column - Process Steps */}
            <div className="space-y-8">
              <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Configure Your API Key</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Get a <span className="font-medium text-blue-600 dark:text-blue-400">free</span> Gemini API key from Google AI Studio and enter it in the API Configuration section. This unlocks unlimited searches with no usage limits.
                </p>
                <div className="mt-3 flex items-center text-blue-600 dark:text-blue-400 text-sm">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Get your free API key
                  </a>
                </div>
              </div>
              
              <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Select a Target Company</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose from your imported job list or enter any company name manually. Looking for HR contacts at a specific company? Just type it in and start your search.
                </p>
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Pro tip:</span> Import your job tracking spreadsheet first for a seamless workflow.
                </div>
              </div>
              
              <div className="relative pl-8 pb-8 border-l border-blue-200 dark:border-blue-800">
                <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Find HR Personnel</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Our system uses advanced AI to search LinkedIn for HR contacts, recruiters, and hiring managers at your target company. The search is powered by browser automation and Google's Gemini AI.
                </p>
                <div className="mt-3 flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4 mr-1 text-gray-400" />
                  <span>Searches typically take 2-3 minutes to complete</span>
                </div>
              </div>
              
              <div className="relative pl-8">
                <div className="absolute -left-3 top-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-2">Personalize & Reach Out</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Once contacts are found, review their profiles and edit the AI-generated outreach messages. One click sends you directly to LinkedIn messaging to make your connection.
                </p>
              </div>
            </div>
            
            {/* Right Column - Feature Highlights */}
            <div className="bg-gray-50 dark:bg-gray-750 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-4 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                What You Can Do
              </h3>
              
              <div className="space-y-5">
                <div className="flex">
                  <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mr-3 mt-1">
                    <Linkedin className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-md">Find the Right People</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Automatically discover HR contacts, recruiters, and hiring managers who can help with your job applications.
                    </p>
                  </div>
                </div>
                
                <div className="flex">
                  <div className="flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg mr-3 mt-1">
                    <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-md">Personalized Messages</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Get AI-generated outreach messages tailored to each contact and job. Edit them to add your personal touch.
                    </p>
                  </div>
                </div>
                
                <div className="flex">
                  <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg mr-3 mt-1">
                    <RefreshCw className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-md">Regenerate & Refine</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Not happy with a message? Regenerate it with one click or make your own edits for the perfect outreach.
                    </p>
                  </div>
                </div>
                
                <div className="flex">
                  <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg mr-3 mt-1">
                    <ArrowRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-md">Direct Contact</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Go straight to LinkedIn messaging with one click. Copy your personalized message and make that connection.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Call to Action */}
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Ready to find your hiring manager?</h4>
                <p className="text-blue-600/80 dark:text-blue-400/80 text-sm mb-3">
                  Enter a company name above and click "Find HR Contacts" to get started with your job search outreach.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      onClose();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center transition-colors duration-200"
                  >
                    <Search className="w-4 h-4 mr-1.5" />
                    Start Searching
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksModal; 