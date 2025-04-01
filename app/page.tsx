"use client";

import { RowData, FilteredRow } from './types/data';
import { getRowData, getRowIndex } from './utils/dataHelpers';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Cookies from "js-cookie";
import { FileSpreadsheet, CheckCircle, AlertCircle, Search, X, Sliders, Calendar, MapPin, DollarSign, Ban, List, Grid, XCircle, HelpCircle, ChevronDown } from "lucide-react";
import ClientSkillsFilter from "./components/ClientSkillsFilter";
import { useRouter } from "next/navigation";
import { 
  extractSpreadsheetId, 
  validateJobListing, 
  generateJobId, 
  getFieldValue, 
  extractSourceFromUrl,
  isJobApplied,
  parseSalary
} from "./utils/dataHelpers";
import {
  JobData,
  SalaryType,
  FilterState,
  RowDataObject
} from "./types/data";
import { toast } from "react-hot-toast";

// Import components
import PageHeader from "./components/home/PageHeader";
import SheetForm from "./components/home/SheetForm";
import ErrorDisplay from "./components/home/ErrorDisplay";
import LoadingIndicator from "./components/home/LoadingIndicator";
import NoResultsMessage from "./components/home/NoResultsMessage";
import StatsDisplay from "./components/home/StatsDisplay";
import FilterSection from "./components/home/FilterSection";
import JobResultsGrid from "./components/home/JobResultsGrid";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const RANGE = process.env.NEXT_PUBLIC_RANGE;

export default function Home() {
  const [data, setData] = useState<string[][]>([]);
  const [filteredRows, setFilteredRows] = useState<FilteredRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const saved = Cookies.get("appliedJobs");
    return saved ? JSON.parse(saved) : [];
  });
  const [hiddenJobs, setHiddenJobs] = useState<string[]>(() => {
    const saved = Cookies.get("hiddenJobs");
    return saved ? JSON.parse(saved) : [];
  });
  const [rowIndices, setRowIndices] = useState<number[]>([]);
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0);
  const [isSheetLoaded, setIsSheetLoaded] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Combined filter state
  const [filters, setFilters] = useState<FilterState>({
    filterText: "",
    selectedLocation: "",
    skillFilter: "",
    showFilters: false,
    showLastDayOnly: false,
    minSalary: 0,
    salaryType: "any" as SalaryType,
    excludedWords: []
  });
  
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [uniqueSkills, setUniqueSkills] = useState<string[]>([]);
  const [newExcludeWord, setNewExcludeWord] = useState<string>("");
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    const savedViewMode = Cookies.get("viewMode");
    return savedViewMode === 'list' ? 'list' : 'card';
  });

  const router = useRouter();

  // Load saved filters on initial render
  useEffect(() => {
    const savedFilters = Cookies.get("savedFilters");
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        setFilters({
          filterText: parsedFilters.filterText || "",
          selectedLocation: parsedFilters.selectedLocation || "",
          skillFilter: parsedFilters.skillFilter || "",
          showFilters: parsedFilters.showFilters || false,
          showLastDayOnly: parsedFilters.showLastDayOnly || false,
          minSalary: parsedFilters.minSalary || 0,
          salaryType: parsedFilters.salaryType || "any",
          excludedWords: parsedFilters.excludedWords || []
        });
      } catch (e) {
        console.error("Error loading saved filters:", e);
      }
    }
  }, []);

  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl);
      const id = extractSpreadsheetId(savedSheetUrl);
      if (id) {
        setSpreadsheetId(id);
        setIsSheetLoaded(true);
        fetchData(id);
      }
    }
  }, []);  

  // Extract unique locations from job data
  useEffect(() => {
    if (data.length <= 1) return; // No data or just headers
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find location column index
    const locationIndex = headers.findIndex(
      (header) => header.toLowerCase() === "location"
    );
    
    if (locationIndex === -1) return;
    
    // Extract unique locations
    const locations = new Set<string>();
    
    rows.forEach((row) => {
      const rowData = getRowData(row);
      if (rowData && rowData[locationIndex]) {
        const location = rowData[locationIndex].trim();
        
        // Skip empty locations
        if (location) {
          // For locations with multiple options (e.g. "New York, Remote"), split and add each
          const parts: string[] = location.split(/,|;/).map((part: string) => part.trim());
          parts.forEach((part: string) => {
            if (part) locations.add(part);
          });
        }
      }
    });
    
    // Convert to array and sort
    const sortedLocations = Array.from(locations).sort();
    setUniqueLocations(sortedLocations);
    
  }, [data]);

  // Apply filters whenever the filter criteria or data changes
  useEffect(() => {
    if (data.length <= 1) return;
    
    const headers = data[0];
    const rows = data.slice(1) as unknown as RowData[];
    
    let filtered = [...rows];
    
    // Filter out applied jobs
    filtered = filtered.filter((row) => {
      const title = getFieldValue(row, "title", headers);
      const company = getFieldValue(row, "company_name", headers);
      
      if (!title) return false;
      
      const consistentJobId = `${title}-${company}`.replace(/\s+/g, '-');
      return !isJobApplied(consistentJobId, title, company, appliedJobs);
    });

    // Apply text filter
    if (filters.filterText) {
      const searchTerms = filters.filterText.toLowerCase().split(' ');
      filtered = filtered.filter((row) => {
        const searchableFields = ['title', 'company_name', 'description', 'skills'].map(
          field => getFieldValue(row, field, headers).toLowerCase()
        ).join(' ');
        return searchTerms.every(term => searchableFields.includes(term));
      });
    }

    // Apply location filter
    if (filters.selectedLocation) {
      filtered = filtered.filter((row) => {
        const location = getFieldValue(row, "location", headers).toLowerCase();
        return location.includes(filters.selectedLocation.toLowerCase());
      });
    }

    // Apply skill filter
    if (filters.skillFilter) {
      const requiredSkills = filters.skillFilter.toLowerCase().split(',').map(s => s.trim());
      filtered = filtered.filter((row) => {
        const skills = getFieldValue(row, "skills", headers).toLowerCase();
        return requiredSkills.every(skill => skills.includes(skill));
      });
    }

    // Apply salary filter
    if (filters.minSalary > 0) {
      filtered = filtered.filter((row) => {
        const salary = getFieldValue(row, "salary", headers);
        const parsedSalary = parseSalary(salary, filters.salaryType);
        return parsedSalary >= filters.minSalary;
      });
    }

    // Apply excluded words filter
    if (filters.excludedWords.length > 0) {
      filtered = filtered.filter((row) => {
        const description = getFieldValue(row, "description", headers).toLowerCase();
        return !filters.excludedWords.some(word => description.includes(word.toLowerCase()));
      });
    }

    // Apply last day filter
    if (filters.showLastDayOnly) {
      filtered = filtered.filter((row) => {
        const datePosted = getFieldValue(row, "date_posted", headers) || 
                         getFieldValue(row, "currentdate", headers) || 
                         getFieldValue(row, "currentDate", headers);
        
        if (!datePosted) return false;
        
        try {
          const jobDate = new Date(datePosted);
          if (isNaN(jobDate.getTime())) return false;
          
          const hoursDiff = (Date.now() - jobDate.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= 24;
        } catch {
          return false;
        }
      });
    }

    // Update the filtered rows mapping
    const filteredWithIndices: FilteredRow[] = filtered.map((row, index) => ({
      data: getRowData(row),
      originalIndex: getRowIndex(row, index)
    }));

    setFilteredRows(filteredWithIndices);
  }, [data, filters.filterText, filters.selectedLocation, filters.skillFilter, filters.showLastDayOnly, filters.minSalary, filters.salaryType, filters.excludedWords, appliedJobs]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSpreadsheetId(sheetUrl);
    if (id) {
      setSpreadsheetId(id);
      setLoadingJobs(true);
      Cookies.set("lastSheetUrl", sheetUrl, { expires: 30 }); // Save URL in cookie for 30 days
      fetchData(id);
    } else {
      setError("Invalid Google Sheets URL");
    }
  };

  const fetchData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${RANGE}?key=${API_KEY}`;
      console.log("Fetching URL:", url);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch data");
      }

      const result = await response.json();

      if (!result.values || result.values.length === 0) {
        throw new Error("No data found in sheet");
      }

      const headers = result.values[0];
      const rows = result.values.slice(1);

      console.log("Total rows from sheet:", rows.length);
      console.log("Headers:", headers);
      setTotalSheetRows(rows.length);

      // Add original indices to rows before filtering
      const rowsWithIndices = rows.map((row: string[], index: number) => ({
        data: row,
        originalIndex: index + 2,
      }));

      // Filter out invalid entries while preserving original indices
      const validRows = rowsWithIndices.filter((row: RowData) => {
        try {
          const rowData = Array.isArray(row) ? row : row.data || [];
          const splicedRow = [...rowData]; // create a copy
          
          // Replace empty cells with empty strings to avoid undefined issues
          splicedRow.forEach((cell: string | undefined, idx: number) => {
            if (cell === undefined) splicedRow[idx] = "";
          });
          
          // Filter out rows that don't have required fields
          const isValid = Array.isArray(row) || (row.data && Array.isArray(row.data))
            ? validateJobListing(splicedRow, headers)
            : false;
          
          return isValid;
        } catch (error) {
          console.error("Error validating row:", error);
          return false;
        }
      });

      console.log("Valid rows after filtering:", validRows.length);
      console.log("Filtered out rows:", rows.length - validRows.length);

      if (validRows.length === 0) {
        throw new Error("No valid job listings found");
      }

      // Keep the original structure with originalIndex for JobCardGrid
      setData([headers, ...validRows]);

      const indices = validRows.map((row: RowData) => Array.isArray(row) ? -1 : (row.originalIndex || -1));
      setRowIndices(indices);

      // Find column indices for skills and locations processing
      const locationIndex = headers.findIndex((h: string) => h.toLowerCase() === 'location');
      const skillsIndex = headers.findIndex((h: string) => h.toLowerCase() === 'skills');

      // Extract unique locations
      const locations = new Set<string>();
      rows.forEach((row: any[]) => {
        if (locationIndex !== -1 && row[locationIndex]) {
          const location = row[locationIndex].toString().trim();
          if (location) locations.add(location);
        }
      });
      setUniqueLocations(Array.from(locations).sort());

      // Extract and clean unique skills
      const skillsSet = new Set<string>();
      rows.forEach((row: any[]) => {
        if (skillsIndex !== -1 && row[skillsIndex]) {
          const skillsData = row[skillsIndex];
          let skills: string[] = [];

          // Clean and parse skills
          const cleanSkill = (skill: string): string => {
            return skill
              .replace(/["\[\]{}]/g, '') // Remove JSON syntax characters
              .replace(/\\"/g, '') // Remove escaped quotes
              .replace(/^'|'$/g, '') // Remove single quotes
              .trim()
              .replace(/\s+/g, ' '); // Normalize whitespace
          };

          try {
            if (typeof skillsData === 'string') {
              // First try to parse as JSON if it looks like JSON
              if (skillsData.trim().startsWith('{') || skillsData.trim().startsWith('[')) {
                try {
                  const parsed = JSON.parse(skillsData);
                  if (Array.isArray(parsed)) {
                    skills = parsed.map(s => cleanSkill(String(s)));
                  } else if (typeof parsed === 'object' && parsed !== null) {
                    skills = Object.keys(parsed).map(cleanSkill);
                  }
                } catch {
                  // If JSON parsing fails, treat as comma-separated
                  skills = skillsData.split(',').map(cleanSkill);
                }
              } else {
                // Handle as comma-separated string
                skills = skillsData.split(',').map(cleanSkill);
              }
            } else if (Array.isArray(skillsData)) {
              skills = skillsData.map(s => cleanSkill(String(s)));
            } else if (typeof skillsData === 'object' && skillsData !== null) {
              skills = Object.keys(skillsData).map(cleanSkill);
            }

            // Add cleaned, non-empty skills to the set
            skills
              .filter(skill => skill.length > 0)
              .forEach(skill => {
                // Normalize case (first letter uppercase, rest lowercase)
                const normalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
                skillsSet.add(normalizedSkill);
              });
          } catch (e) {
            console.error('Error processing skills:', e);
          }
        }
      });
      setUniqueSkills(Array.from(skillsSet).sort());
      setLoadingJobs(false);

    } catch (error: any) {
      console.error("Error processing data:", error);
      setError(error.message || "Failed to process data");
      setLoadingJobs(false);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApplied = (jobId: string) => {
    // Find job title to include in notification
    let jobTitle = "";
    let jobCompany = "";
    
    // If we have the row index, use it to find the job data
    const jobIndex = filteredRows.findIndex(row => {
      const headers = data[0];
      const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title');
      const companyIndex = headers.findIndex(h => h.toLowerCase() === 'company_name');
      
      if (titleIndex !== -1 && companyIndex !== -1) {
        const rowData = getRowData(row);
        jobTitle = rowData[titleIndex];
        jobCompany = rowData[companyIndex];
        
        // Create a consistent job ID from title and company
        const consistentJobId = `${jobTitle}-${jobCompany}`.replace(/\s+/g, '-');
        return consistentJobId === jobId;
      }
      return false;
    });

    if (jobIndex !== -1) {
      // Create a consistent job ID
      const consistentJobId = `${jobTitle}-${jobCompany}`.replace(/\s+/g, '-');
      
      // Check if this job is already in applied jobs
      const isCurrentlyApplied = appliedJobs.includes(consistentJobId) || 
                                appliedJobs.includes(jobTitle) ||
                                appliedJobs.some(id => id.startsWith(`${jobTitle}-${jobCompany}`));
      
      // Create a new array without any variations of this job ID
      let newAppliedJobs = appliedJobs.filter(id => 
        id !== consistentJobId && 
        id !== jobTitle && 
        !id.startsWith(`${jobTitle}-${jobCompany}`));
      
      // If it wasn't applied, add it with the consistent ID format
      if (!isCurrentlyApplied) {
        newAppliedJobs.push(consistentJobId);
        toast.success(`"${jobTitle}" moved to Applied Jobs`);
      } else {
        toast.error(`"${jobTitle}" removed from Applied Jobs`);
      }
      
      setAppliedJobs(newAppliedJobs);
      Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
      return;
    }
    
    // Fallback to the original behavior if we couldn't handle it more precisely
    const newAppliedJobs = appliedJobs.includes(jobId)
      ? appliedJobs.filter((id) => id !== jobId)
      : [...appliedJobs, jobId];

    setAppliedJobs(newAppliedJobs);
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
    
    // Show generic toast notification
    if (newAppliedJobs.length > appliedJobs.length) {
      toast.success("Job moved to Applied Jobs");
    } else {
      toast.error("Job removed from Applied Jobs");
    }
  };

  const handleDeleteJob = async (rowIndex: number) => {
    if (!spreadsheetId) return;

    console.log('Deleting job with rowIndex:', rowIndex);
    
    try {
      const response = await fetch("/api/sheets/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex,
        }),
      });

      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete error response:', errorData);
        throw new Error(errorData.error || "Failed to delete row");
      }

      const result = await response.json();
      console.log('Delete success response:', result);

      // Refresh data after deletion
      fetchData(spreadsheetId);
    } catch (error: any) {
      console.error("Error deleting row:", error);
      setError(error.message || "Failed to delete row");
    }
  };

  const handleUpdateNote = async (
    rowIndex: number,
    note: string,
    columnIndex: number,
  ) => {
    if (!spreadsheetId) return;

    try {
      const response = await fetch("/api/sheets/update-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex,
          note,
          noteColumnIndex: columnIndex,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update note");
      }

      // Refresh data after note update
      fetchData(spreadsheetId);
    } catch (error: any) {
      console.error("Error updating note:", error);
      setError(error.message || "Failed to update note");
    }
  };

  // Add new excluded word
  const handleAddExcludedWord = () => {
    if (newExcludeWord.trim() !== "") {
      const word = newExcludeWord.trim();
      if (!filters.excludedWords.includes(word)) {
        const updatedWords = [...filters.excludedWords, word];
        setFilters(prev => ({ ...prev, excludedWords: updatedWords }));
        setNewExcludeWord("");
        
        // Save to cookies immediately
        const filtersToSave = {
          filterText: filters.filterText,
          selectedLocation: filters.selectedLocation,
          skillFilter: filters.skillFilter,
          showLastDayOnly: filters.showLastDayOnly,
          minSalary: filters.minSalary,
          salaryType: filters.salaryType,
          excludedWords: updatedWords,
        };
        Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
      }
    }
  };

  // Remove excluded word
  const handleRemoveExcludedWord = (word: string) => {
    const updatedWords = filters.excludedWords.filter(w => w !== word);
    setFilters(prev => ({ ...prev, excludedWords: updatedWords }));
    
    // Save to cookies immediately
    const filtersToSave = {
      filterText: filters.filterText,
      selectedLocation: filters.selectedLocation,
      skillFilter: filters.skillFilter,
      showLastDayOnly: filters.showLastDayOnly,
      minSalary: filters.minSalary,
      salaryType: filters.salaryType,
      excludedWords: updatedWords,
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Save filters to cookies
  const saveFilters = () => {
    const filtersToSave = {
      filterText: filters.filterText,
      selectedLocation: filters.selectedLocation,
      skillFilter: filters.skillFilter,
      showLastDayOnly: filters.showLastDayOnly,
      minSalary: filters.minSalary,
      salaryType: filters.salaryType,
      excludedWords: filters.excludedWords,
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 }); // Save for 30 days
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      filterText: "",
      selectedLocation: "",
      skillFilter: "",
      showFilters: false,
      showLastDayOnly: false,
      minSalary: 0,
      salaryType: "any" as SalaryType,
      excludedWords: []
    });
    // Also clear saved filters from cookies
    Cookies.remove("savedFilters");
  };

  // Toggle between card and list view
  const toggleViewMode = () => {
    const newViewMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newViewMode);
    // Save viewMode in cookie for consistency between pages
    Cookies.set("viewMode", newViewMode, { expires: 30 });
  };

  // Function to hide a job
  const handleHideJob = (jobId: string, jobTitle: string, companyName: string) => {
    // Add the job ID to hidden jobs
    const newHiddenJobs = [...hiddenJobs, jobId];
    
    // Also add a special hidden job identifier that will match any job with the same title and company
    // This helps hide duplicate listings that might have different URLs
    const hiddenIdentifier = `hide:${jobTitle}::${companyName}`;
    newHiddenJobs.push(hiddenIdentifier);
    
    setHiddenJobs(newHiddenJobs);
    Cookies.set("hiddenJobs", JSON.stringify(newHiddenJobs), { expires: 30 });
    
    console.log(`Job hidden: ${jobTitle} at ${companyName}`);
  };

  const handleResetJobs = () => {
    setData([]);
    setFilteredRows([]);
    setError(null);
    setSpreadsheetId("");
    setIsSheetLoaded(false);
    Cookies.remove("lastSheetUrl");
  };

  // Extract headers and rows from data
  const headers = data.length > 0 ? data[0] : [];
  const jobsLoaded = data.length > 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 no-overflow mobile-container">
      {/* Page Header */}
      <PageHeader />

      {/* Sheet URL Form */}
      {!isSheetLoaded && (
        <SheetForm
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
          handleUrlSubmit={handleUrlSubmit}
          isLoading={loading}
          isLoadingJobs={loadingJobs}
          handleResetJobs={handleResetJobs}
          hasJobs={jobsLoaded}
        />
      )}

      {/* Error Message */}
      {error && (
        <ErrorDisplay 
          error={error} 
          onClearFilters={clearFilters} 
        />
      )}

      {/* Loading Indicator */}
      {loadingJobs && <LoadingIndicator />}

      {/* No Results Message */}
      {!loadingJobs && !error && filteredRows.length === 0 && data.length > 1 && (
        <NoResultsMessage
          filters={{
            filterText: filters.filterText,
            selectedLocation: filters.selectedLocation,
            skillFilter: filters.skillFilter,
            showLastDayOnly: filters.showLastDayOnly,
            minSalary: filters.minSalary,
            salaryType: filters.salaryType,
            excludedWords: filters.excludedWords
          }}
          onClearFilters={clearFilters}
        />
      )}

      {/* Job Stats and Content */}
      {jobsLoaded && !loadingJobs && (
        <>
          {/* Stats Display */}
          <StatsDisplay 
            totalJobs={filteredRows.length} 
            appliedJobs={appliedJobs.length} 
            totalSheetRows={totalSheetRows} 
          />
          
          {/* Filter Section */}
          <FilterSection
            filters={filters}
            setFilters={setFilters}
            uniqueLocations={uniqueLocations}
            uniqueSkills={uniqueSkills}
            newExcludeWord={newExcludeWord}
            setNewExcludeWord={setNewExcludeWord}
            handleAddExcludedWord={handleAddExcludedWord}
            handleRemoveExcludedWord={handleRemoveExcludedWord}
            saveFilters={saveFilters}
            clearFilters={clearFilters}
            viewMode={viewMode}
            toggleViewMode={toggleViewMode}
          />

          {/* Job Results */}
          {filteredRows.length > 0 ? (
            <JobResultsGrid
              jobs={filteredRows}
              headers={headers}
              appliedJobs={appliedJobs}
              onApply={handleToggleApplied}
              onDelete={handleDeleteJob}
              onUpdateNote={handleUpdateNote}
              onHide={handleHideJob}
              viewMode={viewMode}
              onToggleViewMode={toggleViewMode}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 sm:p-8 text-center border border-gray-100 dark:border-gray-700">
              <p className="text-mobile-sm text-gray-600 dark:text-gray-400 mb-2">No jobs match your current filters</p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
