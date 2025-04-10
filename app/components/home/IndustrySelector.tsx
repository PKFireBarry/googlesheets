import React from 'react';
import { Briefcase, Link } from 'lucide-react';

interface IndustrySelectorProps {
  selectedIndustry: string;
  setSelectedIndustry: (industry: string) => void;
  industries: { name: string; value: string; description: string }[];
  onSelectIndustry: () => void;
  isLoading: boolean;
  onShowCustomUrlInput: () => void;
}

/**
 * Industry Selector component
 * Allows users to select an industry to view related jobs
 */
const IndustrySelector: React.FC<IndustrySelectorProps> = ({
  selectedIndustry,
  setSelectedIndustry,
  industries,
  onSelectIndustry,
  isLoading,
  onShowCustomUrlInput,
}) => {
  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
          <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Select an Industry</h2>
      </div>
      
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Choose an industry to see relevant job listings:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {industries.map((industry) => (
          <div 
            key={industry.value}
            className={`
              border rounded-lg p-4 cursor-pointer transition
              ${selectedIndustry === industry.value 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
              }
            `}
            onClick={() => setSelectedIndustry(industry.value)}
          >
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">{industry.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{industry.description}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <p className="text-gray-600 dark:text-gray-400 mb-3">
          Have your own spreadsheet? You can use it directly:
        </p>
        <button
          onClick={onShowCustomUrlInput}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Link className="w-4 h-4 mr-2" />
          Enter Custom Google Sheet URL
        </button>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={onSelectIndustry}
          disabled={!selectedIndustry || isLoading}
          className={`
            inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm
            text-sm font-medium text-white
            ${!selectedIndustry || isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading
            </span>
          ) : (
            "View Jobs"
          )}
        </button>
      </div>
    </div>
  );
};

export default IndustrySelector; 