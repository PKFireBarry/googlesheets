"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import SheetUrlForm from "./components/SheetUrlForm";
import JobCardGrid from "./components/JobCardGrid";
import { FileSpreadsheet, Users, CheckCircle, AlertCircle, Search, X, Sliders, Calendar, MapPin, DollarSign } from "lucide-react";
import ClientSkillsFilter from "./components/ClientSkillsFilter";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const RANGE = process.env.NEXT_PUBLIC_RANGE;

const extractSpreadsheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

const validateJobListing = (row: string[], headers: string[]) => {
  const getFieldValue = (fieldName: string) => {
    const index = headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase(),
    );
    return index !== -1 ? row[index] : "";
  };

  return Boolean(
    getFieldValue("title")?.trim() &&
      getFieldValue("description")?.trim() &&
      getFieldValue("company_name")?.trim(),
  );
};

interface RowData {
  data: string[];
  originalIndex: number;
  [key: string]: any; // Allow for additional properties
}

export default function Home() {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const saved = Cookies.get("appliedJobs");
    return saved ? JSON.parse(saved) : [];
  });
  const [rowIndices, setRowIndices] = useState<number[]>([]);
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0);
  const [sheetAutoLoaded, setSheetAutoLoaded] = useState(false);
  
  // Filtering state
  const [filterText, setFilterText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filteredRows, setFilteredRows] = useState<RowData[]>([]);
  const [showLastDayOnly, setShowLastDayOnly] = useState(false);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [uniqueSkills, setUniqueSkills] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState<string>("");
  const [salaryType, setSalaryType] = useState<"any" | "yearly" | "hourly">("any");

  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl);
      const id = extractSpreadsheetId(savedSheetUrl);
      if (id) {
        setSpreadsheetId(id);
        setSheetAutoLoaded(true);
        fetchData(id);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const rowData = Array.isArray(row) ? row : (row as RowData).data;
      if (rowData && rowData[locationIndex]) {
        const location = rowData[locationIndex].trim();
        
        // Skip empty locations
        if (location) {
          // For locations with multiple options (e.g. "New York, Remote"), split and add each
          const parts = location.split(/,|;/).map(part => part.trim());
          parts.forEach(part => {
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
    if (data.length <= 1) return; // No data or just headers
    
    const headers = data[0];
    const rows = data.slice(1) as unknown as RowData[];
    
    // Apply all filters
    const filtered = rows.filter((row) => {
      const rowData = Array.isArray(row) ? row : row.data;
      if (!rowData) return false;
      
      // Get field values
      const getFieldValue = (fieldName: string) => {
        const index = headers.findIndex(
          (header) => header.toLowerCase() === fieldName.toLowerCase()
        );
        return index !== -1 ? rowData[index] || "" : "";
      };
      
      // Title filter
      if (filterText) {
        const title = (getFieldValue("title") || "").toLowerCase();
        if (!title.includes(filterText.toLowerCase())) {
          return false;
        }
      }
      
      // Location filter
      if (selectedLocation) {
        const location = (getFieldValue("location") || "").toLowerCase();
        
        if (selectedLocation.toLowerCase() === "remote") {
          // Special case for remote
          const isRemote = 
            location.includes("remote") || 
            location.includes("work from home") || 
            location.includes("wfh");
          
          if (!isRemote) {
            return false;
          }
        } else {
          // Specific city
          if (!location.toLowerCase().includes(selectedLocation.toLowerCase())) {
            return false;
          }
        }
      }
      
      // Salary filter
      if (minSalary) {
        try {
          const salary = getFieldValue("salary") || "";
          
          if (!salary) return false;
          
          // Normalize salary string - remove currency symbols and whitespace
          const normalizedSalary = salary.replace(/[$,\s]/g, '');
          
          // Function to extract number ranges from salary string
          const extractSalaryRange = (salaryStr: string) => {
            // Try to match "X - Y" or "X to Y" patterns
            const rangeMatch = salaryStr.match(/(\d+(?:\.\d+)?)\s*[-–—to]\s*(\d+(?:\.\d+)?)/i);
            if (rangeMatch) {
              return {
                min: parseFloat(rangeMatch[1]),
                max: parseFloat(rangeMatch[2])
              };
            }
            
            // Try to match just a single number
            const singleMatch = salaryStr.match(/(\d+(?:\.\d+)?)/);
            if (singleMatch) {
              const value = parseFloat(singleMatch[1]);
              return { min: value, max: value };
            }
            
            return null;
          };
          
          // Extract salary range
          const range = extractSalaryRange(normalizedSalary);
          if (!range) return false;
          
          // Determine if salary is hourly or yearly based solely on the value range
          // If the number is small (under 100), it's likely hourly
          // If the number is large (over 1000), it's likely yearly
          const isHourly = range.min < 100;
          const isYearly = range.min >= 1000;
          
          // Check if we should filter based on salary type
          if (salaryType !== "any") {
            if (salaryType === "hourly" && !isHourly) return false;
            if (salaryType === "yearly" && !isYearly) return false;
          }
          
          // Apply minimum salary filter
          if (minSalary && !isNaN(parseFloat(minSalary))) {
            const minFilter = parseFloat(minSalary);
            
            // Convert for comparison if needed
            if (isHourly && salaryType !== "hourly") {
              // Convert hourly to yearly for comparison (40hr * 52 weeks)
              const yearlyMin = range.min * 40 * 52;
              if (yearlyMin < minFilter) return false;
            } 
            else if (!isHourly && salaryType === "hourly") {
              // Convert yearly to hourly for comparison
              const hourlyMin = range.min / (40 * 52);
              if (hourlyMin < minFilter) return false;
            } 
            else {
              // Direct comparison (both same type)
              if (range.min < minFilter) return false;
            }
          }
          
        } catch (e) {
          console.error("Error in salary filter:", e);
          return false;
        }
      }
      
      // Skills filter
      if (skillFilter) {
        try {
          const skills = (getFieldValue("skills") || "").toLowerCase();
          const description = (getFieldValue("description") || "").toLowerCase();
          const title = (getFieldValue("title") || "").toLowerCase();
          
          const skillMatch = 
            skills.includes(skillFilter.toLowerCase()) || 
            description.includes(skillFilter.toLowerCase()) ||
            title.includes(skillFilter.toLowerCase());
          
          if (!skillMatch) {
            return false;
          }
        } catch (e) {
          console.error("Error in skills filter:", e);
          return false;
        }
      }
      
      // Last day filter
      if (showLastDayOnly) {
        const datePosted = getFieldValue("date_posted") || getFieldValue("currentdate") || getFieldValue("currentDate");
        
        if (!datePosted) return false;
        
        try {
          const jobDate = new Date(datePosted);
          const now = new Date();
          
          // Check if the date is valid
          if (isNaN(jobDate.getTime())) {
            return false;
          }
          
          // Calculate the difference in milliseconds
          const timeDiff = now.getTime() - jobDate.getTime();
          
          // Convert to hours and check if within last 24 hours
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          if (hoursDiff > 24) {
            return false;
          }
        } catch (e) {
          // If date parsing fails, exclude the job
          return false;
        }
      }
      
      return true;
    });
    
    // Maintain the data structure with originalIndex
    const filteredWithIndices = filtered.map((row, index) => ({
      ...row,
      originalIndex: row.originalIndex || index + 2,
    }));
    
    setFilteredRows(filteredWithIndices);
  }, [data, filterText, selectedLocation, skillFilter, showLastDayOnly, minSalary, salaryType]);

  const handleUrlSubmit = (url: string) => {
    const id = extractSpreadsheetId(url);
    console.log("Extracted ID:", id);
    if (id) {
      setSpreadsheetId(id);
      Cookies.set("lastSheetUrl", url, { expires: 30 }); // Save URL in cookie for 30 days
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
        const isValid = validateJobListing(row.data, headers);
        if (!isValid) {
          console.log(`Row ${row.originalIndex} failed validation:`, row.data);
        }
        return isValid;
      });

      console.log("Valid rows after filtering:", validRows.length);
      console.log("Filtered out rows:", rows.length - validRows.length);

      if (validRows.length === 0) {
        throw new Error("No valid job listings found");
      }

      // Keep the original structure with originalIndex for JobCardGrid
      setData([headers, ...validRows]);

      const indices = validRows.map((row: RowData) => row.originalIndex);
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

    } catch (error: any) {
      console.error("Error processing data:", error);
      setError(error.message || "Failed to process data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApplied = (jobId: string) => {
    console.log("Toggling applied status for job ID:", jobId);
    
    // Find the job title from the job ID if possible
    const headers = data.length > 0 ? data[0] : [];
    const titleIndex = headers.findIndex(
      (header) => header.toLowerCase() === "title"
    );
    
    if (titleIndex !== -1) {
      // Try to find the job with this ID
      const rowsWithIndices = data.slice(1);
      const job = rowsWithIndices.find((row) => {
        const rowData = (row as any).data;
        if (!rowData) return false;
        
        // Check if this is the job with the given ID
        const idIndex = headers.findIndex(
          (header) => header.toLowerCase() === "id"
        );
        
        if (idIndex !== -1 && rowData[idIndex] === jobId) {
          return true;
        }
        
        // If no ID match, try to match by title-company-index pattern
        const companyIndex = headers.findIndex(
          (header) => header.toLowerCase() === "company_name"
        );
        
        if (titleIndex !== -1 && companyIndex !== -1) {
          const title = rowData[titleIndex];
          const company = rowData[companyIndex];
          
          // Check if jobId matches the pattern
          if (jobId.startsWith(`${title}-${company}-`)) {
            return true;
          }
        }
        
        return false;
      });
      
      if (job && (job as any).data) {
        const jobTitle = (job as any).data[titleIndex];
        console.log("Job title being toggled:", jobTitle);
        
        // Store the job title in the cookie instead of the ID
        let newAppliedJobs;
        
        if (appliedJobs.includes(jobTitle)) {
          // Remove the job title if it exists
          newAppliedJobs = appliedJobs.filter((title) => title !== jobTitle);
        } else {
          // Add the job title if it doesn't exist (no duplicates)
          if (!appliedJobs.includes(jobTitle)) {
            newAppliedJobs = [...appliedJobs, jobTitle];
          } else {
            newAppliedJobs = [...appliedJobs]; // No change needed
          }
        }
        
        console.log("New applied jobs (titles):", newAppliedJobs);
        
        setAppliedJobs(newAppliedJobs);
        Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
        return;
      }
    }
    
    // Fallback to the original behavior if we couldn't find the job title
    const newAppliedJobs = appliedJobs.includes(jobId)
      ? appliedJobs.filter((id) => id !== jobId)
      : [...appliedJobs, jobId];

    console.log("New applied jobs (IDs):", newAppliedJobs);
    
    setAppliedJobs(newAppliedJobs);
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
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

  // Clear all filters
  const clearFilters = () => {
    setFilterText("");
    setSelectedLocation("");
    setSkillFilter("");
    setShowLastDayOnly(false);
    setMinSalary("");
    setSalaryType("any");
  };

  // Extract headers and rows from data
  const headers = data.length > 0 ? data[0] : [];
  const rows = filteredRows.length > 0 ? filteredRows : data.slice(1) as unknown as RowData[];

  // Add originalIndex to rows for JobCardGrid
  const rowsWithIndices = rows.map((row, index) => {
    return {
      ...row,
      originalIndex: 'originalIndex' in row ? row.originalIndex : index + 2,
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-8 sm:mb-12">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-6 sm:p-10 text-white mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Job Application Tracker
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl">
            Track and manage your job applications with Google Sheets integration. 
            Keep all your job opportunities organized in one place.
          </p>
        </div>

        {!sheetAutoLoaded && (
          <SheetUrlForm
            initialUrl={sheetUrl}
            onSubmit={handleUrlSubmit}
            isLoading={loading}
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white">Total Jobs</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
              {totalSheetRows > rows.length && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {totalSheetRows - rows.length} filtered out
                </p>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg mr-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white">Applied</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{appliedJobs.length}</p>
              {rows.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {Math.round((appliedJobs.length / rows.length) * 100)}% application rate
                </p>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-3">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg mr-3">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white">Remaining</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {rows.length - appliedJobs.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Jobs to apply for
              </p>
            </div>
          </div>

          {/* Job Filters */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Job Listings</h2>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Sliders className="w-4 h-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            </div>
            
            {showFilters && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-100 dark:border-gray-700 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title filter */}
                  <div>
                    <label htmlFor="title-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title Keywords</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="title-filter"
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Software Engineer, React, etc."
                        className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  
                  {/* Location filter */}
                  <div>
                    <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <select
                        id="location-filter"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
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
                    skillFilter={skillFilter}
                    setSkillFilter={setSkillFilter}
                    uniqueSkills={uniqueSkills}
                  />
                  
                  {/* Salary filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimum Salary</label>
                    <div className="flex flex-col space-y-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <DollarSign className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          type="number"
                          value={minSalary}
                          onChange={(e) => setMinSalary(e.target.value)}
                          placeholder="Minimum salary"
                          className="pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <select
                        value={salaryType}
                        onChange={(e) => setSalaryType(e.target.value as "any" | "yearly" | "hourly")}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                      >
                        <option value="any">Any Format</option>
                        <option value="yearly">Yearly Salary</option>
                        <option value="hourly">Hourly Rate</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Last day filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Posting Date</label>
                    <div className="flex items-center h-10">
                      <div className="relative flex items-center">
                        <input
                          id="last-day-filter"
                          type="checkbox"
                          checked={showLastDayOnly}
                          onChange={(e) => setShowLastDayOnly(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="last-day-filter" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                          Last 24 Hours Only
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Clear filters button */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Swipe Instructions */}
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-md p-4 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm sm:text-base font-medium text-blue-700 dark:text-blue-300">Job Card Navigation</h3>
            </div>
            <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
              <span className="hidden sm:inline">Swipe left or right on job cards to navigate between jobs. </span>
              <span>Use the arrow buttons below the card to view previous or next job listings. </span>
              <span>Toggle between card and list views using the view button above. In list view, click on a job to see full details. </span>
              <span>Jobs are sorted with newest first.</span>
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center border border-gray-100 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400 mb-2">No jobs match your current filters</p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <JobCardGrid
              jobs={rowsWithIndices}
              headers={headers}
              appliedJobs={appliedJobs}
              onApply={handleToggleApplied}
              onDelete={handleDeleteJob}
              onUpdateNote={handleUpdateNote}
            />
          )}
        </>
      )}
    </div>
  );
}
