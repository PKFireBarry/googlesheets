import React from 'react';
import { Search, Sliders, List, Grid, Calendar, MapPin, DollarSign, Ban, X, CheckCircle, Link2, Code, Filter } from 'lucide-react';

interface FilterState {
  filterText: string;
  selectedLocation: string;
  skillFilter: string;
  showFilters: boolean;
  showLastDayOnly: boolean;
  minSalary: number;
  salaryType: "any" | "yearly" | "hourly";
  excludedWords: string[];
  sourceFilter: string;
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
  newSkill: string;
  setNewSkill: React.Dispatch<React.SetStateAction<string>>;
  handleAddSkill: () => void;
  handleRemoveSkill: (skill: string) => void;
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
  newSkill,
  setNewSkill,
  handleAddSkill,
  handleRemoveSkill,
  saveFilters,
  clearFilters,
  viewMode,
  toggleViewMode
}) => {
  return (
    <div className="mb-6">
      {/* Header section with search and buttons */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mb-4">
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Job Listings</h2>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
            {/* Search input */}
            <div className="relative w-full sm:w-auto flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={filters.filterText}
                onChange={(e) => setFilters(prev => ({ ...prev, filterText: e.target.value }))}
                placeholder="Search jobs..."
                className="pl-10 pr-4 py-2 w-full rounded-lg border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
              />
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              {/* Filter toggle button */}
              <button 
                onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium 
                         bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 
                         hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Filter className="w-4 h-4 mr-1.5" />
                {filters.showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              
              {/* View mode toggle */}
              <button
                onClick={toggleViewMode}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium 
                        bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 
                        hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
              >
                {viewMode === 'card' ? (
                  <>
                    <List className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">List View</span>
                    <span className="inline sm:hidden">List</span>
                  </>
                ) : (
                  <>
                    <Grid className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Card View</span>
                    <span className="inline sm:hidden">Cards</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded filter section */}
      {filters.showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 mb-4 animate-fade-in">
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Location filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label htmlFor="location-filter" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <MapPin className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2 flex-shrink-0" />
                  <span>Location</span>
                </label>
                <div className="relative">
                  <input
                    id="location-filter"
                    type="text"
                    list="location-options"
                    value={filters.selectedLocation}
                    onChange={(e) => setFilters(prev => ({ ...prev, selectedLocation: e.target.value }))}
                    placeholder="Enter location..."
                    className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                  />
                  <datalist id="location-options">
                    <option value="Remote">Remote Only</option>
                    {uniqueLocations.map((location) => (
                      location.toLowerCase() !== "remote" && (
                        <option key={location} value={location}>{location}</option>
                      )
                    ))}
                  </datalist>
                </div>
              </div>
              
              {/* Skills filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label htmlFor="skills-filter" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Code className="h-4 w-4 text-purple-500 dark:text-purple-400 mr-2 flex-shrink-0" />
                  <span>Skills</span>
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      id="skills-filter"
                      type="text"
                      list="skills-options"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="Enter skills..."
                      className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                    />
                    <datalist id="skills-options">
                      {uniqueSkills.map((skill) => (
                        <option key={skill} value={skill}>{skill}</option>
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={handleAddSkill}
                    className="ml-2 inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {/* Selected skills tags */}
                {filters.skillFilter && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {filters.skillFilter.split(',').filter(Boolean).map((skill) => {
                      const trimmedSkill = skill.trim();
                      if (!trimmedSkill) return null;
                      return (
                        <div key={trimmedSkill} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100/80 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/30 shadow-sm">
                          {trimmedSkill}
                          <button
                            onClick={() => handleRemoveSkill(trimmedSkill)}
                            className="ml-1.5 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Source filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label htmlFor="source-filter" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Link2 className="h-4 w-4 text-green-500 dark:text-green-400 mr-2 flex-shrink-0" />
                  <span>Source</span>
                </label>
                <div className="relative">
                  <input
                    id="source-filter"
                    type="text"
                    value={filters.sourceFilter}
                    onChange={(e) => setFilters(prev => ({ ...prev, sourceFilter: e.target.value }))}
                    placeholder="Enter source (LinkedIn, Indeed, etc.)..."
                    className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                  />
                </div>
              </div>
              
              {/* Last day filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Calendar className="h-4 w-4 text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0" />
                  <span>Posting Date</span>
                </label>
                <div className="flex items-center">
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input 
                      id="last-day-filter" 
                      type="checkbox"
                      checked={filters.showLastDayOnly}
                      onChange={(e) => setFilters(prev => ({ ...prev, showLastDayOnly: e.target.checked }))}
                      className="absolute w-5 h-5 opacity-0 z-10 cursor-pointer"
                    />
                    <div className="block h-5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    <div className={`dot absolute left-0.5 top-0.5 w-4 h-4 rounded-full transition ${
                      filters.showLastDayOnly ? 'transform translate-x-5 bg-amber-500 dark:bg-amber-400' : 'bg-white'
                    }`}></div>
                  </div>
                  <label htmlFor="last-day-filter" className="text-sm text-gray-700 dark:text-gray-300 flex items-center cursor-pointer">
                    Last 24 Hours Only
                  </label>
                </div>
              </div>
              
              {/* Salary filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <DollarSign className="h-4 w-4 text-teal-500 dark:text-teal-400 mr-2 flex-shrink-0" />
                  <span>Minimum Salary</span>
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <input
                      type="number"
                      value={filters.minSalary}
                      onChange={(e) => setFilters(prev => ({ ...prev, minSalary: parseInt(e.target.value) }))}
                      placeholder="Min salary"
                      className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                    />
                  </div>
                  <select
                    value={filters.salaryType}
                    onChange={(e) => setFilters(prev => ({ ...prev, salaryType: e.target.value as "any" | "yearly" | "hourly" }))}
                    className="w-24 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                  >
                    <option value="any">Any</option>
                    <option value="yearly">Yearly</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
              </div>
              
              {/* Excluded Words filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40 sm:col-span-2 lg:col-span-3">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Ban className="h-4 w-4 text-red-500 dark:text-red-400 mr-2 flex-shrink-0" />
                  <span>Exclude Jobs Containing</span>
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
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
                      className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                    />
                  </div>
                  <button
                    onClick={handleAddExcludedWord}
                    className="ml-2 inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {/* Display excluded words as tags */}
                {filters.excludedWords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {filters.excludedWords.map((word) => (
                      <div key={word} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200/50 dark:border-red-700/30 shadow-sm">
                        {word}
                        <button
                          onClick={() => handleRemoveExcludedWord(word)}
                          className="ml-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Filter action buttons */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={saveFilters}
                className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-medium 
                         bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white
                         transition-all duration-200 shadow-sm hover:shadow"
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Save Filters
              </button>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-medium 
                         bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow"
              >
                <X className="h-4 w-4 mr-1.5" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSection; 