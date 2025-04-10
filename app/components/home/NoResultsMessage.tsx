import React from 'react';
import { AlertCircle } from 'lucide-react';

interface NoResultsMessageProps {
  filters: {
    filterText: string;
    selectedLocation: string;
    skillFilter: string;
    timeRangeFilter: number;
    minSalary: number;
    salaryType: string;
    excludedWords: string[];
    sourceFilter: string;
    titleFilter: string;
  };
  onClearFilters: () => void;
}

/**
 * No Results Message component
 * Displays a message when no jobs match the current filters
 */
const NoResultsMessage: React.FC<NoResultsMessageProps> = ({
  filters, 
  onClearFilters
}) => {
  return (
    <div className="max-w-4xl mx-auto mb-6">
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded relative" role="alert">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">No jobs found with current filters</p>
            <p className="text-sm mt-1">Try adjusting your filter criteria:</p>
            <ul className="text-sm list-disc list-inside mt-2">
              {filters.filterText && <li>Search text: "{filters.filterText}"</li>}
              {filters.selectedLocation && <li>Location: {filters.selectedLocation}</li>}
              {filters.skillFilter && <li>Skills: {filters.skillFilter}</li>}
              {filters.titleFilter && <li>Job Titles: {filters.titleFilter}</li>}
              {filters.sourceFilter && <li>Source: {filters.sourceFilter}</li>}
              {filters.timeRangeFilter > 0 && (
                <li>Time range: Last {Math.floor(filters.timeRangeFilter / 24)} {Math.floor(filters.timeRangeFilter / 24) === 1 ? 'day' : 'days'}</li>
              )}
              {filters.minSalary > 0 && <li>Minimum salary: {filters.minSalary} ({filters.salaryType})</li>}
              {filters.excludedWords.length > 0 && (
                <li>Excluded words: {filters.excludedWords.join(', ')}</li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onClearFilters}
            className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoResultsMessage; 