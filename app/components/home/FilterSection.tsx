import React from 'react';
import { Search, Sliders, List, Grid, Calendar, MapPin, DollarSign, Ban, X, CheckCircle, Link2, Code, Filter, Briefcase } from 'lucide-react';

interface FilterState {
  filterText: string;
  selectedLocation: string;
  skillFilter: string;
  showFilters: boolean;
  timeRangeFilter: number;
  minSalary: number;
  salaryType: "any" | "yearly" | "hourly";
  excludedWords: string[];
  sourceFilter: string;
  titleFilter: string;
  maxExperience: number;
}

interface FilterSectionProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueLocations: string[];
  uniqueSkills: string[];
  uniqueSources: string[];
  uniqueTitles: string[];
  newExcludeWord: string;
  setNewExcludeWord: React.Dispatch<React.SetStateAction<string>>;
  handleAddExcludedWord: () => void;
  handleRemoveExcludedWord: (word: string) => void;
  newSkill: string;
  setNewSkill: React.Dispatch<React.SetStateAction<string>>;
  handleAddSkill: () => void;
  handleRemoveSkill: (skill: string) => void;
  newSource: string;
  setNewSource: React.Dispatch<React.SetStateAction<string>>;
  handleAddSource: () => void;
  handleRemoveSource: (source: string) => void;
  newTitle: string;
  setNewTitle: React.Dispatch<React.SetStateAction<string>>;
  handleAddTitle: () => void;
  handleRemoveTitle: (title: string) => void;
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
  uniqueSources,
  uniqueTitles,
  newExcludeWord,
  setNewExcludeWord,
  handleAddExcludedWord,
  handleRemoveExcludedWord,
  newSkill,
  setNewSkill,
  handleAddSkill,
  handleRemoveSkill,
  newSource,
  setNewSource,
  handleAddSource,
  handleRemoveSource,
  newTitle,
  setNewTitle,
  handleAddTitle,
  handleRemoveTitle,
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
              
              {/* Job titles filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label htmlFor="title-filter" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400 mr-2 flex-shrink-0" />
                  <span>Job Titles</span>
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      id="title-filter"
                      type="text"
                      list="title-options"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTitle();
                        }
                      }}
                      placeholder="Filter by job titles..."
                      className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                    />
                    <datalist id="title-options">
                      {uniqueTitles.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={handleAddTitle}
                    className="ml-2 inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {/* Selected job titles tags */}
                {filters.titleFilter && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {filters.titleFilter.split(',').filter(Boolean).map((title) => {
                      const trimmedTitle = title.trim();
                      return trimmedTitle ? (
                        <span
                          key={trimmedTitle}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                        >
                          {trimmedTitle}
                          <button
                            type="button"
                            onClick={() => handleRemoveTitle(trimmedTitle)}
                            className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800 hover:text-emerald-900 dark:hover:text-emerald-300 focus:outline-none focus:bg-emerald-500 focus:text-white"
                          >
                            <span className="sr-only">Remove {trimmedTitle}</span>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null;
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
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      id="source-filter"
                      type="text"
                      list="sources-options"
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSource();
                        }
                      }}
                      placeholder="Enter source (LinkedIn, Indeed, etc.)..."
                      className="pl-3 block w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:text-white"
                    />
                    <datalist id="sources-options">
                      {uniqueSources.map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </datalist>
                  </div>
                  <button
                    onClick={handleAddSource}
                    className="ml-2 inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                {/* Selected sources tags */}
                {filters.sourceFilter && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {filters.sourceFilter.split(',').filter(Boolean).map((source) => {
                      const trimmedSource = source.trim();
                      if (!trimmedSource) return null;
                      return (
                        <div key={trimmedSource} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200/50 dark:border-green-700/30 shadow-sm">
                          {trimmedSource}
                          <button
                            onClick={() => handleRemoveSource(trimmedSource)}
                            className="ml-1.5 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Time Range filter - replaces Last day filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Calendar className="h-4 w-4 text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0" />
                  <span>Time Range</span>
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="range"
                      min="24"
                      max="336" 
                      step="24"
                      value={filters.timeRangeFilter}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        timeRangeFilter: parseInt(e.target.value) 
                      }))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 dark:accent-amber-400"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>1 day</span>
                    <span>{Math.floor(filters.timeRangeFilter / 24)} {Math.floor(filters.timeRangeFilter / 24) === 1 ? 'day' : 'days'}</span>
                    <span>14 days</span>
                  </div>
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
              
              {/* Experience filter */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/80 shadow-sm hover:shadow-md transition-shadow border border-gray-100/60 dark:border-gray-700/40">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">
                  <Briefcase className="h-4 w-4 text-indigo-500 dark:text-indigo-400 mr-2 flex-shrink-0" />
                  <span>Maximum Experience</span>
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={filters.maxExperience}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        maxExperience: parseInt(e.target.value) 
                      }))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 dark:accent-indigo-400"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>No limit</span>
                    <span>{filters.maxExperience} {filters.maxExperience === 1 ? 'year' : 'years'}</span>
                    <span>10 years</span>
                  </div>
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