import React from 'react';
import { Globe, Search, Loader2, Plus } from 'lucide-react';
import CookieUtil from '../../utils/cookies';
import ActionButton from '../ActionButton';

interface CompanySelectorProps {
  loading: boolean;
  error: string | null;
  companies: string[];
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  customCompany: string;
  setCustomCompany: (company: string) => void;
  useCustomCompany: boolean;
  setUseCustomCompany: (useCustom: boolean) => void;
  isSearching: boolean;
  onSearch: () => void;
}

/**
 * Company Selector Component
 * Allows users to select a company from a dropdown or enter a custom company name
 */
const CompanySelector: React.FC<CompanySelectorProps> = ({
  loading,
  error,
  companies,
  selectedCompany,
  setSelectedCompany,
  customCompany,
  setCustomCompany,
  useCustomCompany,
  setUseCustomCompany,
  isSearching,
  onSearch
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 h-full card">
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Company Selection</h2>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Loading companies...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          <p>{error}</p>
          {!CookieUtil.get("lastSheetUrl") && (
            <p className="mt-2 text-sm">Please load a Google Sheet on the home page first.</p>
          )}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-md">
          <p>No companies found</p>
          <p className="mt-2 text-sm">Please load a Google Sheet with company data on the home page or use the custom company input below.</p>
          
          {/* Add custom company input when no companies are found */}
          <div className="mt-4">
            <label htmlFor="customCompanyFallback" className="block text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
              Custom Company:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="customCompanyFallback"
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                placeholder="Enter company name"
                className="flex-1 px-3 py-2 border border-yellow-400 bg-white dark:bg-yellow-900/20 rounded-md shadow-sm text-yellow-800 dark:text-yellow-200"
              />
              <ActionButton
                onClick={onSearch}
                disabled={!customCompany || isSearching}
                color="emerald"
                icon={Search}
              >
                Search
              </ActionButton>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="space-y-4">
              {/* Company Selection */}
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company
                </label>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    {useCustomCompany ? (
                      <input
                        type="text"
                        id="customCompany"
                        value={customCompany}
                        onChange={(e) => setCustomCompany(e.target.value)}
                        placeholder="Enter company name"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <select
                        id="company"
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">Select a company</option>
                        {companies.map((company) => (
                          <option key={company} value={company}>
                            {company}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <ActionButton
                    onClick={() => setUseCustomCompany(!useCustomCompany)}
                    color="default"
                    icon={Plus}
                  >
                    {useCustomCompany ? "Use List" : "Custom"}
                  </ActionButton>
                </div>
              </div>
            </div>
          </div>
          
          <ActionButton
            onClick={onSearch}
            disabled={(!selectedCompany && !customCompany) || isSearching}
            color="blue"
            className="w-full mt-4"
            size="lg"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find HR Contacts
              </>
            )}
          </ActionButton>
        </>
      )}
    </div>
  );
};

export default CompanySelector; 