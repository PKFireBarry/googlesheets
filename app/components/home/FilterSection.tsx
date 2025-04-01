import React from 'react';
import { Search, Sliders, List, Grid, Calendar, MapPin, DollarSign, Ban, X, CheckCircle } from 'lucide-react';
import ClientSkillsFilter from '../ClientSkillsFilter';

interface FilterState {
  filterText: string;
  selectedLocation: string;
  skillFilter: string;
  showFilters: boolean;
  showLastDayOnly: boolean;
  minSalary: number;
  salaryType: "any" | "yearly" | "hourly";
  excludedWords: string[];
}

interface FilterSectionProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueLocations: string[];
  uniqueSkills: string[];
  newExcludeWord: string;
  setNewExcludeWord: React.Dispatch<React.SetStateAction<string>>;
  handleAddExcludedWord: () => void;
  handleRemoveExcludedWord: (word: string) => void;
  saveFilters: () => void;
  clearFilters: () => void;
  viewMode: 'card' | 'list';
  toggleViewMode: () => void;
}

/**
 * Filter Section component
 * Contains all filter controls for the jobs listing
 */
const FilterSection: React.FC<FilterSectionProps> = ({
  filters,
  setFilters,
  uniqueLocations,
  uniqueSkills,
  newExcludeWord,
  setNewExcludeWord,
  handleAddExcludedWord,
  handleRemoveExcludedWord,
  saveFilters,
  clearFilters,
  viewMode,
  toggleViewMode
}) => {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Job Listings</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick filter input */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={filters.filterText}
              onChange={(e) => setFilters(prev => ({ ...prev, filterText: e.target.value }))}
              placeholder="Search jobs..."
              className="pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 w-full sm:w-48 md:w-64 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {/* Filter buttons */}
            <button 
              onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              {filters.showFilters ? 'Hide' : 'Filters'}
            </button>
            
            {/* List/Card View Toggle */}
            <button
              onClick={toggleViewMode}
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {viewMode === 'card' ? (
                <>
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">List View</span>
                  <span className="inline sm:hidden">List</span>
                </>
              ) : (
                <>
                  <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Card View</span>
                  <span className="inline sm:hidden">Cards</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {filters.showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700 mb-3 sm:mb-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Location filter */}
            <div>
              <label htmlFor="location-filter" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                </div>
                <select
                  id="location-filter"
                  value={filters.selectedLocation}
                  onChange={(e) => setFilters(prev => ({ ...prev, selectedLocation: e.target.value }))}
                  className="pl-7 sm:pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Any Location</option>
                  <option value="Remote">Remote Only</option>
                  {uniqueLocations.map((location) => (
                    location.toLowerCase() !== "remote" && (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    )
                  ))}
                </select>
              </div>
            </div>
            
            {/* Skills filter */}
            <ClientSkillsFilter 
              skillFilter={filters.skillFilter}
              setSkillFilter={(skill) => setFilters(prev => ({ ...prev, skillFilter: skill }))}
              uniqueSkills={uniqueSkills}
            />
            
            {/* Last day filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posting Date</label>
              <div className="flex items-center h-9 sm:h-10">
                <div className="relative flex items-center">
                  <input
                    id="last-day-filter"
                    type="checkbox"
                    checked={filters.showLastDayOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, showLastDayOnly: e.target.checked }))}
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="last-day-filter" className="ml-1.5 sm:ml-2 block text-xs sm:text-sm text-gray-700 dark:text-gray-300 items-center">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 text-gray-500" />
                    Last 24 Hours Only
                  </label>
                </div>
              </div>
            </div>
            
            {/* Salary filter */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimum Salary</label>
              <div className="flex space-x-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="number"
                    value={filters.minSalary}
                    onChange={(e) => setFilters(prev => ({ ...prev, minSalary: parseInt(e.target.value) }))}
                    placeholder="Min salary"
                    className="pl-7 sm:pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <select
                  value={filters.salaryType}
                  onChange={(e) => setFilters(prev => ({ ...prev, salaryType: e.target.value as "any" | "yearly" | "hourly" }))}
                  className="w-16 sm:w-24 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="any">Any</option>
                  <option value="yearly">Yearly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>
            
            {/* Excluded Words filter */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exclude Jobs Containing</label>
              <div className="flex">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                    <Ban className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    value={newExcludeWord}
                    onChange={(e) => setNewExcludeWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExcludedWord();
                      }
                    }}
                    placeholder="senior, sr, lead, etc."
                    className="pl-7 sm:pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleAddExcludedWord}
                  className="ml-2 inline-flex items-center px-2 sm:px-3 py-1 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add
                </button>
              </div>
              
              {/* Display excluded words as tags */}
              {filters.excludedWords.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                  {filters.excludedWords.map((word) => (
                    <div key={word} className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      {word}
                      <button
                        onClick={() => handleRemoveExcludedWord(word)}
                        className="ml-1 sm:ml-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Filter buttons */}
          <div className="mt-3 sm:mt-4 flex justify-end space-x-2">
            <button
              onClick={saveFilters}
              className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Save
            </button>
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSection; 