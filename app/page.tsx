"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import SheetUrlForm from "./components/SheetUrlForm";
import JobCardGrid from "./components/JobCardGrid";
import { FileSpreadsheet, Users, CheckCircle, AlertCircle, Search, X, Sliders, Calendar, MapPin, DollarSign, Ban, List, Grid, XCircle } from "lucide-react";
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
    getFieldValue("company_name")?.trim()
  );
};

interface RowData {
  data: string[];
  originalIndex: number;
  [key: string]: unknown; // Allow for additional properties
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
  const [hiddenJobs, setHiddenJobs] = useState<string[]>(() => {
    const saved = Cookies.get("hiddenJobs");
    return saved ? JSON.parse(saved) : [];
  });
  const [rowIndices, setRowIndices] = useState<number[]>([]);
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0);
  const [sheetAutoLoaded, setSheetAutoLoaded] = useState(false);
  const [sheetsLoaded, setSheetsLoaded] = useState(false);
  
  // Toast notification state
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
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
  const [excludedWords, setExcludedWords] = useState<string[]>([]);
  const [newExcludeWord, setNewExcludeWord] = useState<string>("");
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    // Try to get viewMode from cookie
    const savedViewMode = Cookies.get("viewMode");
    return savedViewMode === 'list' ? 'list' : 'card';
  });

  // Load saved filters on initial render
  useEffect(() => {
    const savedFilters = Cookies.get("savedFilters");
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setFilterText(filters.filterText || "");
        setSelectedLocation(filters.selectedLocation || "");
        setSkillFilter(filters.skillFilter || "");
        setShowLastDayOnly(filters.showLastDayOnly || false);
        setMinSalary(filters.minSalary || "");
        setSalaryType(filters.salaryType || "any");
        setExcludedWords(filters.excludedWords || []);
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
        setSheetAutoLoaded(true);
        setSheetsLoaded(true);
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
    console.log("Applying filters to", rows.length, "jobs");
    
    let filtered = [...rows];
    
    // Filter out applied jobs - they should only appear on the Applied page
    filtered = filtered.filter((row) => {
      const job = prepareJobData(row, 0);
      return !appliedJobs.includes(job.id);
    });
    
    // Filter out hidden jobs
    filtered = filtered.filter((row) => {
      const job = prepareJobData(row, 0);
      return !hiddenJobs.some((hiddenId) => {
        // Check if job is hidden by exact ID
        if (hiddenId === job.id) return true;
        
        // Check if job is hidden by matching title+company (for duplicate listings)
        try {
          // Hidden job IDs that represent titles+companies are prefixed with "hide:"
          if (hiddenId.startsWith('hide:')) {
            const [hiddenTitle, hiddenCompany] = hiddenId.substring(5).split('::');
            return job.title === hiddenTitle && job.company_name === hiddenCompany;
          }
          return false;
        } catch (e) {
          console.error('Error checking hidden job match:', e);
          return false;
        }
      });
    });
    
    // Text search filter
    if (filterText) {
      filtered = filtered.filter((row) => {
        const rowData = Array.isArray(row) ? row : row.data;
        if (!rowData) return false;
        
        const getFieldValue = (fieldName: string) => {
          const index = headers.findIndex(
            (header) => header.toLowerCase() === fieldName.toLowerCase()
          );
          return index !== -1 ? rowData[index] || "" : "";
        };
        
        const title = (getFieldValue("title") || "").toLowerCase();
        if (title.includes(filterText.toLowerCase())) {
          return true;
        }
        
        // Excluded words filter
        if (excludedWords.length > 0) {
          for (const word of excludedWords) {
            if (title.includes(word.toLowerCase())) {
              return false; // Exclude this job if title contains any excluded word
            }
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
        
        return true;
      });
    }
    
    // Location filter
    if (selectedLocation) {
      filtered = filtered.filter((row) => {
        const rowData = Array.isArray(row) ? row : row.data;
        if (!rowData) return false;
        
        const getFieldValue = (fieldName: string) => {
          const index = headers.findIndex(
            (header) => header.toLowerCase() === fieldName.toLowerCase()
          );
          return index !== -1 ? rowData[index] || "" : "";
        };
        
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
        
        return true;
      });
    }
    
    // Salary filter
    if (minSalary) {
      filtered = filtered.filter((row) => {
        const rowData = Array.isArray(row) ? row : row.data;
        if (!rowData) return false;
        
        const getFieldValue = (fieldName: string) => {
          const index = headers.findIndex(
            (header) => header.toLowerCase() === fieldName.toLowerCase()
          );
          return index !== -1 ? rowData[index] || "" : "";
        };
        
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
        
        return true;
      });
    }
    
    // Skills filter
    if (skillFilter) {
      filtered = filtered.filter((row) => {
        const rowData = Array.isArray(row) ? row : row.data;
        if (!rowData) return false;
        
        const getFieldValue = (fieldName: string) => {
          const index = headers.findIndex(
            (header) => header.toLowerCase() === fieldName.toLowerCase()
          );
          return index !== -1 ? rowData[index] || "" : "";
        };
        
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
        
        return true;
      });
    }
    
    // Last day filter
    if (showLastDayOnly) {
      filtered = filtered.filter((row) => {
        const rowData = Array.isArray(row) ? row : row.data;
        if (!rowData) return false;
        
        const getFieldValue = (fieldName: string) => {
          const index = headers.findIndex(
            (header) => header.toLowerCase() === fieldName.toLowerCase()
          );
          return index !== -1 ? rowData[index] || "" : "";
        };
        
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
        
        return true;
      });
    }
    
    // Maintain the data structure with originalIndex
    const filteredWithIndices = filtered.map((row, index) => ({
      ...row,
      originalIndex: row.originalIndex || index + 2,
    }));
    
    setFilteredRows(filteredWithIndices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterText, selectedLocation, skillFilter, showLastDayOnly, minSalary, salaryType, excludedWords, appliedJobs, hiddenJobs]);

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
    console.log("Toggle applied for job ID:", jobId);
    
    // Find job title to include in notification
    let jobTitle = "";
    
    // If we have the row index, use it to find the job data
    const jobIndex = rowIndices.findIndex(index => index.toString() === jobId)
    if (jobIndex !== -1) {
      // This was called with the row index as jobId
      const rowIndex = parseInt(jobId)
      const rowData = data[rowIndex]
      
      if (rowData) {
        const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title')
        const companyIndex = headers.findIndex(h => h.toLowerCase() === 'company_name')
        
        if (titleIndex !== -1 && companyIndex !== -1) {
          const title = rowData[titleIndex]
          jobTitle = title; // Store for notification
          const company = rowData[companyIndex]
          
          // Create a consistent job ID from title and company
          const consistentJobId = `${title}-${company}`.replace(/\s+/g, '-')
          
          // Check if this job is already in applied jobs
          const isCurrentlyApplied = appliedJobs.includes(consistentJobId) || 
                                    appliedJobs.includes(title) ||
                                    appliedJobs.some(id => id.startsWith(`${title}-${company}`))
          
          // Create a new array without any variations of this job ID
          let newAppliedJobs = appliedJobs.filter(id => 
            id !== consistentJobId && 
            id !== title && 
            !id.startsWith(`${title}-${company}`))
          
          // If it wasn't applied, add it with the consistent ID format
          if (!isCurrentlyApplied) {
            newAppliedJobs.push(consistentJobId)
            setToastMessage(`"${title}" marked as applied`);
          } else {
            setToastMessage(`"${title}" removed from applied jobs`);
          }
          
          console.log("New applied jobs list:", newAppliedJobs);
          setAppliedJobs(newAppliedJobs);
          Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
          
          // Show toast notification
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 3000);
          
          return;
        }
      }
    }
    
    // Try to find job by the new jobId format (which might be title-company or just title)
    const jobFromFilteredData = filteredRows.find(job => {
      const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title')
      const companyIndex = headers.findIndex(h => h.toLowerCase() === 'company_name')
      
      if (titleIndex === -1 || companyIndex === -1) return false;
      
      let jobTitleFromFilteredData = "";
      
      if (job && (job as any).data) {
        jobTitleFromFilteredData = (job as any).data[titleIndex];
        const company = (job as any).data[companyIndex];
        
        // Check if this matches the provided jobId
        if (jobId === jobTitleFromFilteredData || 
            jobId === `${jobTitleFromFilteredData}-${company}`.replace(/\s+/g, '-') ||
            jobId.startsWith(`${jobTitleFromFilteredData}-${company}`)) {
          
          // Create a consistent job ID
          const consistentJobId = `${jobTitleFromFilteredData}-${company}`.replace(/\s+/g, '-');
          
          // Remove any variations of this job from applied jobs
          let newAppliedJobs = appliedJobs.filter(id => 
            id !== consistentJobId && 
            id !== jobTitleFromFilteredData && 
            !id.startsWith(`${jobTitleFromFilteredData}-${company}`));
          
          // If it wasn't in the list (after filtering), add it with the consistent format
          if (newAppliedJobs.length === appliedJobs.length) {
            newAppliedJobs.push(consistentJobId);
          }
          
          console.log("New applied jobs list (from filtered data):", newAppliedJobs);
          setAppliedJobs(newAppliedJobs);
          Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
          
          // If we toggled the status, show notification
          if (newAppliedJobs.length !== appliedJobs.length) {
            const isApplying = newAppliedJobs.length > appliedJobs.length;
            setToastMessage(isApplying ? 
              `"${jobTitleFromFilteredData}" marked as applied` : 
              `"${jobTitleFromFilteredData}" removed from applied jobs`);
            
            // Show toast notification
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
          }
          
          return true;
        }
      }
      
      return false;
    });
    
    if (jobFromFilteredData) {
      return; // We've already handled this job
    }
    
    // Fallback to the original behavior if we couldn't handle it more precisely
    const newAppliedJobs = appliedJobs.includes(jobId)
      ? appliedJobs.filter((id) => id !== jobId)
      : [...appliedJobs, jobId];

    console.log("New applied jobs (fallback):", newAppliedJobs);
    
    // For fallback case, we may not have a job title, so use generic message
    if (newAppliedJobs.length > appliedJobs.length) {
      setToastMessage("Job marked as applied");
    } else {
      setToastMessage("Job removed from applied jobs");
    }
    
    // Show toast notification
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    
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

  // Add new excluded word
  const handleAddExcludedWord = () => {
    if (newExcludeWord.trim() !== "" && !excludedWords.includes(newExcludeWord.trim())) {
      setExcludedWords([...excludedWords, newExcludeWord.trim()]);
      setNewExcludeWord("");
    }
  };

  // Remove excluded word
  const handleRemoveExcludedWord = (word: string) => {
    setExcludedWords(excludedWords.filter(w => w !== word));
  };

  // Save filters to cookies
  const saveFilters = () => {
    const filters = {
      filterText,
      selectedLocation,
      skillFilter,
      showLastDayOnly,
      minSalary,
      salaryType,
      excludedWords,
    };
    Cookies.set("savedFilters", JSON.stringify(filters), { expires: 30 }); // Save for 30 days
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterText("");
    setSelectedLocation("");
    setSkillFilter("");
    setShowLastDayOnly(false);
    setMinSalary("");
    setSalaryType("any");
    setExcludedWords([]);
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

  // Function to prepare job data from row data
  const prepareJobData = (row: any, index: number): any => {
    // Existing function implementation...
    // We need to add this function if it doesn't exist already in your code
    const getFieldValue = (fieldName: string) => {
      const columnIndex = findColumnIndex(fieldName);
      if (columnIndex === -1) return "";
      
      const rowData = Array.isArray(row) ? row : row.data;
      return rowData[columnIndex] || "";
    };
    
    const title = getFieldValue("title");
    const company = getFieldValue("company_name");
    const location = getFieldValue("location");
    const jobType = getFieldValue("job_type") || getFieldValue("type");
    const salary = getFieldValue("salary");
    const datePosted = getFieldValue("date_posted") || getFieldValue("currentdate");
    const description = getFieldValue("description");
    const url = getFieldValue("url");
    const companyWebsite = getFieldValue("company_website");
    const companyImage = getFieldValue("company_image");
    const experience = getFieldValue("experience");
    const skills = getFieldValue("skills");
    const notes = getFieldValue("notes");
    
    // Generate a unique ID for the job
    const id = generateJobId(row, index);
    
    return {
      title,
      company_name: company,
      location,
      job_type: jobType,
      salary,
      date_posted: datePosted,
      description,
      url,
      company_website: companyWebsite,
      company_image: companyImage,
      experience,
      skills,
      notes,
      id
    };
  };

  const findColumnIndex = (fieldName: string) => {
    if (!data[0]) return -1;
    
    return data[0].findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase()
    );
  };

  const generateJobId = (row: any, index: number): string => {
    const titleIndex = findColumnIndex("title");
    const companyIndex = findColumnIndex("company_name");
    
    let title, company;
    
    if (Array.isArray(row)) {
      title = titleIndex >= 0 ? row[titleIndex] : "";
      company = companyIndex >= 0 ? row[companyIndex] : "";
    } else if (row.data) {
      title = titleIndex >= 0 ? row.data[titleIndex] : "";
      company = companyIndex >= 0 ? row.data[companyIndex] : "";
    } else {
      return `job-${index}`;
    }
    
    // We use the title+company as the job ID because it's unique enough
    // for our purposes and allows us to identify duplicates
    return `${title}-${company}`.replace(/\s+/g, '-');
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 no-overflow mobile-container">
      <div className="mb-4 sm:mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-4 sm:p-10 text-white mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3">
            Job Application Tracker
          </h1>
          <p className="text-mobile-sm text-blue-100 max-w-2xl">
            Track and manage your job applications with Google Sheets integration. 
            Keep all your job opportunities organized in one place.
          </p>
        </div>

        {!sheetAutoLoaded && (
          <>
            <SheetUrlForm
              initialUrl={sheetUrl}
              onSubmit={(url) => {
                handleUrlSubmit(url);
                setSheetsLoaded(true);
              }}
              isLoading={loading}
            />

            {!sheetsLoaded && (
              <div className="mt-6 sm:mt-10 mb-8 sm:mb-16">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 border border-gray-100 dark:border-gray-700">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Welcome to Job Application Tracker</h2>
                  
                  <p className="text-mobile-sm text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
                    This application helps you manage your job search process using Google Sheets as a database.
                    Enter your Google Sheet URL above to get started, or learn about the features below.
                  </p>
                  
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-3 sm:mb-4">How It Works</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-blue-500 text-white">
                          <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Google Sheets Integration</h4>
                        <p className="mt-1 sm:mt-2 text-mobile-xs text-gray-600 dark:text-gray-400">
                          Connect to your existing Google Sheet containing job listings. We'll automatically organize and display your data.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-green-500 text-white">
                          <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Track Applications</h4>
                        <p className="mt-1 sm:mt-2 text-mobile-xs text-gray-600 dark:text-gray-400">
                          Mark jobs as applied, view your application progress, and keep track of which opportunities still need attention.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-purple-500 text-white">
                          <Sliders className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Advanced Filtering</h4>
                        <p className="mt-1 sm:mt-2 text-mobile-xs text-gray-600 dark:text-gray-400">
                          Filter job listings by location, skills, salary requirements, and more. Exclude terms like "senior" to focus on relevant positions.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md bg-yellow-500 text-white">
                          <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4">
                        <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Latest Opportunities</h4>
                        <p className="mt-1 sm:mt-2 text-mobile-xs text-gray-600 dark:text-gray-400">
                          Filter for jobs posted in the last 24 hours. Stay on top of the newest opportunities without missing out.
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-3 sm:mb-4">Recommended Sheet Structure</h3>
                  <p className="text-mobile-sm text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                    For best results, your Google Sheet should include these columns:
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">title</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Job title</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">company_name</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Name of the company</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">description</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Job description</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">location</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Job location(s)</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">skills</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Required skills</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">salary</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Salary information</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">date_posted</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">When the job was posted</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">notes</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Your personal notes</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg">
                      <span className="font-medium text-mobile-sm text-gray-900 dark:text-white">url</span>
                      <p className="text-mobile-xs text-gray-600 dark:text-gray-400">Link to the job posting</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-5 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="text-base sm:text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">Ready to get started?</h4>
                    <p className="text-mobile-sm text-blue-700 dark:text-blue-400 mb-2 sm:mb-3">
                      Enter your Google Sheets URL above. The app will remember your sheet for future visits.
                    </p>
                    <p className="text-mobile-xs text-blue-600 dark:text-blue-500">
                      Note: Your Google Sheet must be publicly accessible or shared with view access.
                    </p>
                  </div>

                  {/* Quick Setup Guide */}
                  <div className="mt-6 sm:mt-10 mb-4 sm:mb-8">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white mb-3 sm:mb-4">Quick Setup Guide</h3>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6 border border-gray-100 dark:border-gray-700">
                      <ol className="space-y-4 sm:space-y-6">
                        <li className="flex">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-bold text-sm sm:text-base">
                              1
                            </div>
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Create a Google Sheet</h4>
                            <p className="mt-1 text-mobile-xs text-gray-600 dark:text-gray-400">
                              Create a new Google Sheet or use an existing one to store your job listings. Add column headers like those listed above.
                            </p>
                          </div>
                        </li>
                        
                        <li className="flex">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-bold text-sm sm:text-base">
                              2
                            </div>
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Make Your Sheet Public</h4>
                            <p className="mt-1 text-mobile-xs text-gray-600 dark:text-gray-400">
                              Click the "Share" button in Google Sheets and change access to "Anyone with the link" with "Viewer" permissions.
                            </p>
                          </div>
                        </li>
                        
                        <li className="flex">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-bold text-sm sm:text-base">
                              3
                            </div>
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Copy Your Sheet URL</h4>
                            <p className="mt-1 text-mobile-xs text-gray-600 dark:text-gray-400">
                              Copy the URL from your browser's address bar while viewing your Sheet. It should look like:
                              <code className="ml-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs sm:text-sm">
                                https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
                              </code>
                            </p>
                          </div>
                        </li>
                        
                        <li className="flex">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 font-bold text-sm sm:text-base">
                              4
                            </div>
                          </div>
                          <div className="ml-3 sm:ml-4">
                            <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Paste URL Above</h4>
                            <p className="mt-1 text-mobile-xs text-gray-600 dark:text-gray-400">
                              Paste your Sheet URL into the form above and click "Load Jobs" to connect your data. 
                              The app will remember your sheet for future visits.
                            </p>
                          </div>
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg mb-4 sm:mb-6 flex items-start">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-mobile-sm">{error}</p>
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-2 sm:mb-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
                  <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Total Jobs</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
              {totalSheetRows > rows.length && (
                <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
                  {totalSheetRows - rows.length} filtered out
                </p>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-2 sm:mb-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Applied</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{appliedJobs.length}</p>
              {rows.length > 0 && (
                <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
                  {Math.round((appliedJobs.length / rows.length) * 100)}% application rate
                </p>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-3 sm:p-5 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center mb-2 sm:mb-3">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 sm:p-2 rounded-lg mr-2 sm:mr-3">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-medium text-mobile-sm text-gray-900 dark:text-white">Remaining</h3>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {rows.length - appliedJobs.length}
              </p>
              <p className="text-mobile-xs text-gray-500 dark:text-gray-400 mt-1">
                Jobs to apply for
              </p>
            </div>
          </div>

          {/* Job Filters - Improved Layout */}
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
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Search jobs..."
                    className="pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 w-full sm:w-48 md:w-64 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                  />
                </div>
                
                <div className="flex items-center gap-2 ml-auto">
                  {/* Filter buttons */}
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    {showFilters ? 'Hide' : 'Filters'}
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
            
            {showFilters && (
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
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
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
                    skillFilter={skillFilter}
                    setSkillFilter={setSkillFilter}
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
                          checked={showLastDayOnly}
                          onChange={(e) => setShowLastDayOnly(e.target.checked)}
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
                          value={minSalary}
                          onChange={(e) => setMinSalary(e.target.value)}
                          placeholder="Min salary"
                          className="pl-7 sm:pl-10 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <select
                        value={salaryType}
                        onChange={(e) => setSalaryType(e.target.value as "any" | "yearly" | "hourly")}
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
                    {excludedWords.length > 0 && (
                      <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
                        {excludedWords.map((word) => (
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

          {/* Swipe Instructions */}
          <div className="mb-4 sm:mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl shadow-md p-3 sm:p-4 border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Job Card Navigation</h3>
            </div>
            <p className="text-mobile-xs text-blue-600 dark:text-blue-400">
              <span className="hidden sm:inline">Swipe left or right on job cards to navigate between jobs. </span>
              <span>Use the arrow buttons below the card to view previous or next job listings. </span>
              <span>Toggle between card and list views using the view button above. In list view, click on a job to see full details. </span>
              <span>Jobs are sorted with newest first.</span>
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 sm:p-8 text-center border border-gray-100 dark:border-gray-700">
              <p className="text-mobile-sm text-gray-600 dark:text-gray-400 mb-2">No jobs match your current filters</p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
              onHide={(jobId, title, company) => handleHideJob(jobId, title, company)}
              onUpdateNote={handleUpdateNote}
              viewMode={viewMode}
              onToggleViewMode={toggleViewMode}
            />
          )}
        </>
      )}

      {/* Success toast notification */}
      {showSuccessToast && (
        <div className={`fixed bottom-4 right-4 ${toastMessage.includes('removed') ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-up z-50 flex items-center`}>
          {toastMessage.includes('removed') ? 
            <XCircle className="w-5 h-5 mr-2" /> : 
            <CheckCircle className="w-5 h-5 mr-2" />
          }
          {toastMessage}
        </div>
      )}
    </div>
  );
}
