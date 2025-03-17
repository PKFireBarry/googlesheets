"use client"

import { useState } from 'react'
import { Filter } from 'lucide-react'

interface FilterPanelProps {
  filterFields: Array<{ label: string; value: string }>;
  activeFilters: Array<{ field: string; value: string; type: "include" | "exclude" }>;
  onToggleFilter: (field: string, value: string, type: "include" | "exclude") => void;
}

export default function FilterPanel({ 
  filterFields, 
  activeFilters, 
  onToggleFilter 
}: FilterPanelProps) {
  const [filterField, setFilterField] = useState("")
  const [filterValue, setFilterValue] = useState("")
  const [filterType, setFilterType] = useState<"include" | "exclude">("exclude")
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (filterField && filterValue) {
      if (filterField === "both") {
        // Add both title and description filters
        onToggleFilter("title", filterValue, filterType)
        onToggleFilter("description", filterValue, filterType)
      } else {
        onToggleFilter(filterField, filterValue, filterType)
      }
      setFilterValue("")
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Filter className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Filter Jobs</h2>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
      
      {isExpanded && (
        <>
          <form onSubmit={handleSubmit} className="mt-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div>
                <label htmlFor="filter-field" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field
                </label>
                <select
                  id="filter-field"
                  value={filterField}
                  onChange={(e) => setFilterField(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select field to filter...</option>
                  {filterFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="filter-value" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value
                </label>
                <input
                  id="filter-value"
                  type="text"
                  placeholder="Enter filter text..."
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label htmlFor="filter-type" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter Type
                </label>
                <select
                  id="filter-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "include" | "exclude")}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="include">Include</option>
                  <option value="exclude">Exclude</option>
                </select>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!filterField || !filterValue}
              className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium ${
                filterType === "include" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
              } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {filterType === "include" ? "Add Include Filter" : "Add Exclude Filter"}
            </button>
          </form>
          
          {activeFilters.length > 0 && (
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active Filters:</h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {activeFilters.map((filter, index) => (
                  <div
                    key={index}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm flex items-center ${
                      filter.type === "include" ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-red-500/20 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <span>
                      {filterFields.find((f) => f.value === filter.field)?.label || filter.field}: {filter.value}
                    </span>
                    <button
                      className="ml-1.5 sm:ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      onClick={() => onToggleFilter(filter.field, filter.value, filter.type)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
