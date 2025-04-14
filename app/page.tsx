"use client";

import { RowData, FilteredRow } from './types/data';
import { getRowData, getRowIndex } from './utils/dataHelpers';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Cookies from "js-cookie";
import { FileSpreadsheet, CheckCircle, AlertCircle, Search, X, Sliders, Calendar, MapPin, DollarSign, Ban, List, Grid, XCircle, HelpCircle, ChevronDown, Briefcase } from "lucide-react";
import ClientSkillsFilter from "./components/ClientSkillsFilter";
import { useRouter } from "next/navigation";
import { 
  extractSpreadsheetId, 
  validateJobListing, 
  generateJobId, 
  getFieldValue, 
  extractSourceFromUrl,
  isJobApplied,
  parseSalary,
  dedupJobs
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
import IndustrySelector from "./components/home/IndustrySelector";
import WelcomeModal from "./components/home/WelcomeModal";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const RANGE = process.env.NEXT_PUBLIC_RANGE;

// Sheet name constants
const SHEET_NAME_TECH = process.env.NEXT_PUBLIC_SHEET_NAME_TECH || "Tech Jobs";
const SHEET_NAME_BUSINESS = process.env.NEXT_PUBLIC_SHEET_NAME_BUSINESS || "Business Operations Jobs";
const SHEET_NAME_HEALTHCARE = process.env.NEXT_PUBLIC_SHEET_NAME_HEALTHCARE || "Healthcare Jobs";
const SHEET_NAME_CUSTOMER = process.env.NEXT_PUBLIC_SHEET_NAME_CUSTOMER || "Customer and Social Services and Transportation and Logistics";
const SHEET_NAME_DEFAULT = process.env.NEXT_PUBLIC_SHEET_NAME_DEFAULT || "Sheet1";

// Industry options for the selector
const INDUSTRY_OPTIONS = [
  { 
    name: "Technology", 
    value: SHEET_NAME_TECH,
    description: "Software, IT, data science, and other tech-related positions"
  },
  { 
    name: "Business Operations", 
    value: SHEET_NAME_BUSINESS,
    description: "Management, finance, marketing, and administrative positions"
  },
  { 
    name: "Healthcare", 
    value: SHEET_NAME_HEALTHCARE,
    description: "Medical, nursing, therapy, and other healthcare professions"
  },
  { 
    name: "Customer & Social Services", 
    value: SHEET_NAME_CUSTOMER,
    description: "Customer service, social work, transportation, and logistics"
  }
];

// Google Sheet URL for the main spreadsheet from environment variable or fallback to hardcoded
const GOOGLE_SHEET_URL = process.env.NEXT_PUBLIC_DEFAULT_SHEET_URL || "https://docs.google.com/spreadsheets/d/1dLV3n1XnbyxMaI71JqcWV-4OYnxa9sAl4kBRcST8rjE";

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
    timeRangeFilter: 168, // Default to 168 hours (7 days)
    minSalary: 0,
    salaryType: "any" as SalaryType,
    excludedWords: [],
    sourceFilter: "",
    titleFilter: "",
    maxExperience: 5 // Default to 5 years
  });
  
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  const [uniqueSkills, setUniqueSkills] = useState<string[]>([]);
  const [uniqueSources, setUniqueSources] = useState<string[]>([]);
  const [uniqueTitles, setUniqueTitles] = useState<string[]>([]);
  const [newExcludeWord, setNewExcludeWord] = useState<string>("");
  const [newSkill, setNewSkill] = useState<string>("");
  const [newSource, setNewSource] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    const savedViewMode = Cookies.get("viewMode");
    return savedViewMode === 'list' ? 'list' : 'card';
  });

  // New state variables for industry selection
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [showIndustrySelector, setShowIndustrySelector] = useState(false);
  const [currentSheetName, setCurrentSheetName] = useState("");

  // State for Welcome Modal
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  const router = useRouter();

  // Load saved filters on initial render
  useEffect(() => {
    try {
      const savedFilters = Cookies.get("savedFilters");
      if (savedFilters) {
        const parsedFilters = JSON.parse(savedFilters);
        setFilters({
          filterText: parsedFilters.filterText || "",
          selectedLocation: parsedFilters.selectedLocation || "",
          skillFilter: parsedFilters.skillFilter || "",
          showFilters: parsedFilters.showFilters || false,
          timeRangeFilter: parsedFilters.timeRangeFilter || 168,
          minSalary: parsedFilters.minSalary || 0,
          salaryType: parsedFilters.salaryType || "any",
          excludedWords: parsedFilters.excludedWords || [],
          sourceFilter: parsedFilters.sourceFilter || "",
          titleFilter: parsedFilters.titleFilter || "",
          maxExperience: parsedFilters.maxExperience || 5
        });
      }
    } catch (e) {
      console.error("Error loading saved filters:", e);
    }
  }, []);

  useEffect(() => {
    // Check for last selected industry in cookie
    const lastIndustry = Cookies.get("lastIndustry");
    
    // Check for legacy URL format in cookie
    const lastSheetUrl = Cookies.get("lastSheetUrl");
    
    // Check if the user has visited before
    const hasVisited = Cookies.get("hasVisited");

    if (!hasVisited) {
      setIsFirstVisit(true);
    }

    // Prioritize lastSheetUrl for legacy users
    if (lastSheetUrl) {
      // Support legacy users
      setSheetUrl(lastSheetUrl);
      
      const spreadsheetId = extractSpreadsheetId(lastSheetUrl);
      if (spreadsheetId) {
        setSpreadsheetId(spreadsheetId);
        // For legacy users, use Sheet1 as the default sheet but display as Legacy
        setCurrentSheetName("Legacy"); // Set a friendly name for the UI
        fetchData(spreadsheetId, "Sheet1");
      }
    } else if (lastIndustry) {
      setSelectedIndustry(lastIndustry);
      // Check if it's a valid industry option
      if (INDUSTRY_OPTIONS.some(option => option.value === lastIndustry)) {
        // If valid, automatically load jobs for this industry
        setSheetUrl(GOOGLE_SHEET_URL);
        loadJobsForIndustry(lastIndustry);
      }
    } else {
      // First time user - show industry selector
      setShowIndustrySelector(true);
    }
  }, []);

  // Effect to show welcome modal for first-time visitors when industry selector appears
  useEffect(() => {
    if (isFirstVisit && showIndustrySelector) {
      setIsWelcomeModalOpen(true);
    }
  }, [isFirstVisit, showIndustrySelector]);

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

  // Extract unique sources from the data
  useEffect(() => {
    if (data.length <= 1) return; // No data or just headers
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find relevant column indices
    const sourceIndex = headers.findIndex(header => header.toLowerCase() === "source");
    const urlIndex = headers.findIndex(header => header.toLowerCase() === "url");
    const companyWebsiteIndex = headers.findIndex(header => header.toLowerCase() === "company_website");
    
    // Extract unique sources
    const sources = new Set<string>();
    
    rows.forEach((row) => {
      const rowData = getRowData(row);
      if (rowData) {
        let source = '';
        
        // Try to get source from source column
        if (sourceIndex !== -1 && rowData[sourceIndex]) {
          source = rowData[sourceIndex].trim();
        }
        
        // If no source found, try to extract from URL
        if (!source && urlIndex !== -1 && rowData[urlIndex]) {
          source = extractSourceFromUrl(rowData[urlIndex]);
        }
        
        // If still no source, try company website
        if (!source && companyWebsiteIndex !== -1 && rowData[companyWebsiteIndex]) {
          source = extractSourceFromUrl(rowData[companyWebsiteIndex]);
        }
        
        if (source && source !== 'Unknown') {
          sources.add(source);
        }
      }
    });
    
    // Convert to array and sort
    const sortedSources = Array.from(sources).sort();
    setUniqueSources(sortedSources);
  }, [data]);

  // Extract unique titles from the data
  useEffect(() => {
    if (data.length <= 1) return; // No data or just headers
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // Find title column index
    const titleIndex = headers.findIndex(header => header.toLowerCase() === "title");
    
    if (titleIndex === -1) return;
    
    // Extract unique titles - use a Map to store lowercase version as key and original as value
    // This prevents duplicate titles with different casing
    const titlesMap = new Map<string, string>();
    
    rows.forEach((row) => {
      const rowData = getRowData(row);
      if (rowData && rowData[titleIndex]) {
        const title = rowData[titleIndex].trim();
        if (title) {
          // Store with lowercase as key to prevent duplicates with different casing
          titlesMap.set(title.toLowerCase(), title);
        }
      }
    });
    
    // Convert to array and sort (case insensitive)
    const sortedTitles = Array.from(titlesMap.values()).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    setUniqueTitles(sortedTitles);
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

    // Apply experience filter
    if (filters.maxExperience > 0) {
      filtered = filtered.filter((row) => {
        const experience = getFieldValue(row, "experience", headers);
        
        // Log more detailed information about experience filtering
        console.log("Filtering experience:", { 
          experience, 
          maxExperience: filters.maxExperience,
          originalRow: Array.isArray(row) ? row : row.data,
          experienceIndex: headers.findIndex(h => h.toLowerCase() === 'experience')
        });
        
        // If no experience listed, include the job
        if (!experience) return true;
        
        // Enhanced extraction: works with formats like "3+", "3+ years", etc.
        const yearsMatch = experience.match(/(\d+)(?:\+)?/);
        if (!yearsMatch) return true; // Keep if we can't parse it
        
        const years = parseInt(yearsMatch[1]);
        // Cap experience at 10 years for filtering purposes
        const cappedYears = !isNaN(years) ? Math.min(years, 10) : 0;
        return !isNaN(years) && cappedYears <= filters.maxExperience;
      });
    }

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

    // Apply title filter (OR logic)
    if (filters.titleFilter) {
      const requiredTitles = filters.titleFilter.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
      // Only apply the filter if there are required titles
      if (requiredTitles.length > 0) {
        filtered = filtered.filter((row) => {
          const title = getFieldValue(row, "title", headers).toLowerCase();
          // Match if job title includes ANY of the required titles
          return requiredTitles.some(t => title.includes(t));
        });
      }
    }

    // Apply location filter (multi-select - already OR logic)
    if (filters.selectedLocation) {
      const requiredLocations = filters.selectedLocation.toLowerCase().split(',').map(loc => loc.trim()).filter(Boolean);
      if (requiredLocations.length > 0) {
        filtered = filtered.filter((row) => {
          const location = getFieldValue(row, "location", headers).toLowerCase();
          // Check if the job location string contains any of the required locations
          return requiredLocations.some(reqLoc => location.includes(reqLoc));
        });
      }
    }

    // Apply skill filter (OR logic)
    if (filters.skillFilter) {
      const requiredSkills = filters.skillFilter.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      if (requiredSkills.length > 0) {
        filtered = filtered.filter((row) => {
          const skills = getFieldValue(row, "skills", headers).toLowerCase();
          // Match if job skills include ANY of the required skills
          return requiredSkills.some(skill => skills.includes(skill));
        });
      }
    }

    // Apply source filter (OR logic)
    if (filters.sourceFilter) {
      const requiredSources = filters.sourceFilter.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      if (requiredSources.length > 0) {
        filtered = filtered.filter((row) => {
          const source = getFieldValue(row, "source", headers) || '';
          const url = getFieldValue(row, "url", headers) || '';
          const companyWebsite = getFieldValue(row, "company_website", headers) || '';
          
          // Check both explicit source field and extract from URL if needed
          const jobSource = (source || extractSourceFromUrl(url || companyWebsite)).toLowerCase();
          
          // Match if job source includes ANY of the required sources
          return requiredSources.some(s => jobSource.includes(s));
        });
      }
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
        const title = getFieldValue(row, "title", headers).toLowerCase();
        const description = getFieldValue(row, "description", headers).toLowerCase();
        return !filters.excludedWords.some(word => 
          title.includes(word.toLowerCase()) || description.includes(word.toLowerCase())
        );
      });
    }

    // Apply time range filter (replacing the last day filter)
    if (filters.timeRangeFilter > 0) {
      filtered = filtered.filter((row) => {
        const datePosted = getFieldValue(row, "date_posted", headers) || 
                         getFieldValue(row, "currentdate", headers) || 
                         getFieldValue(row, "currentDate", headers);
        
        if (!datePosted) return false;
        
        try {
          const jobDate = new Date(datePosted);
          if (isNaN(jobDate.getTime())) return false;
          
          const hoursDiff = (Date.now() - jobDate.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= filters.timeRangeFilter; // Use the timeRangeFilter value in hours
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
  }, [data, filters.filterText, filters.selectedLocation, filters.skillFilter, filters.timeRangeFilter, filters.minSalary, filters.salaryType, filters.excludedWords, appliedJobs, filters.sourceFilter, filters.titleFilter, filters.maxExperience]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetUrl) {
      const id = extractSpreadsheetId(sheetUrl);
      if (id) {
        setSpreadsheetId(id);
        setLoadingJobs(true);
        Cookies.set("lastSheetUrl", sheetUrl, { expires: 30 }); // Save URL in cookie for 30 days
        
        // Remove any lastIndustry cookie to prevent it from overriding this URL on reload
        Cookies.remove("lastIndustry");
        
        // For manually added sheets, set a custom label right away
        setCurrentSheetName("Legacy");
        
        // Try Sheet1 first for compatibility
        fetchData(id, "Sheet1")
          .catch(error => {
            console.error("Error fetching Sheet1:", error);
            // If Sheet1 fails, try to find available sheets as fallback
            return tryFetchAvailableSheets(id);
          })
          .then(success => {
            if (success) {
              setIsSheetLoaded(true);
            }
          })
          .catch(err => {
            console.error("Error fetching sheets:", err);
          });
      } else {
        setError("Invalid Google Sheets URL");
      }
    } else {
      setError("Invalid Google Sheets URL");
    }
  };

  const fetchData = async (id: string, sheetName: string = SHEET_NAME_DEFAULT) => {
    setLoading(true);
    setError(null);
    try {
      // Update current sheet name only if this isn't a legacy or custom sheet
      // This preserves our special display names set earlier
      if (sheetName !== "Sheet1" && currentSheetName !== "Custom" && currentSheetName !== "Legacy") {
        setCurrentSheetName(sheetName);
      }
      
      // Replace {sheetName} placeholder in the RANGE with actual sheet name
      const range = process.env.NEXT_PUBLIC_RANGE?.replace('{sheetName}', sheetName) || `${sheetName}!A:Z`;
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${API_KEY}`;
      console.log("Fetching URL:", url);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        // Provide a more detailed error message if it's a sheet not found error
        if (errorData.error?.message?.includes("Unable to parse range")) {
          console.log("Sheet not found, trying to fetch spreadsheet info to find available sheets...");
          return await tryFetchAvailableSheets(id);
        }
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

      // Deduplicate jobs - keep only the newest instance of each job
      const uniqueRows = dedupJobs(validRows, headers);
      console.log("Unique rows after deduplication:", uniqueRows.length);
      console.log("Removed duplicate jobs:", validRows.length - uniqueRows.length);

      // Keep the original structure with originalIndex for JobCardGrid
      setData([headers, ...uniqueRows]);

      const indices = uniqueRows.map((row: RowData) => Array.isArray(row) ? -1 : (row.originalIndex || -1));
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

      // At the end of success handling
      setIsSheetLoaded(true);

    } catch (error: any) {
      console.error("Error processing data:", error);
      setError(error.message || "Failed to process data");
      setLoadingJobs(false);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to try to discover the available sheets in a spreadsheet
  const tryFetchAvailableSheets = async (id: string) => {
    try {
      // Fetch the spreadsheet metadata to get sheet names
      const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${API_KEY}`;
      const response = await fetch(metadataUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch spreadsheet information");
      }
      
      const metadata = await response.json();
      
      if (metadata.sheets && metadata.sheets.length > 0) {
        // Get the first sheet's title
        const firstSheetName = metadata.sheets[0].properties.title;
        console.log(`Found first sheet name: ${firstSheetName}`);
        
        // Preserve special display names (Legacy or Custom)
        // Only update currentSheetName if we haven't already set it to a special value
        if (currentSheetName !== "Legacy" && currentSheetName !== "Custom") {
          setCurrentSheetName(firstSheetName);
        }
        
        const range = `${firstSheetName}!A:Z`;
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${API_KEY}`;
        const dataResponse = await fetch(dataUrl);
        
        if (!dataResponse.ok) {
          throw new Error("Could not fetch data from the first sheet");
        }
        
        const result = await dataResponse.json();
        
        if (!result.values || result.values.length === 0) {
          throw new Error("No data found in sheet");
        }
        
        // Process the data as usual
        const headers = result.values[0];
        const rows = result.values.slice(1);
        
        console.log("Total rows from sheet:", rows.length);
        console.log("Headers:", headers);
        setTotalSheetRows(rows.length);
        
        // Continue with the rest of the data processing logic
        
        // Add original indices to rows before filtering
        const rowsWithIndices = rows.map((row: string[], index: number) => ({
          data: row,
          originalIndex: index + 2,
        }));
        
        // Filter out invalid entries
        const validRows = rowsWithIndices.filter((row: RowData) => {
          try {
            const rowData = Array.isArray(row) ? row : row.data || [];
            const splicedRow = [...rowData];
            
            splicedRow.forEach((cell: string | undefined, idx: number) => {
              if (cell === undefined) splicedRow[idx] = "";
            });
            
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
        
        if (validRows.length === 0) {
          throw new Error("No valid job listings found");
        }
        
        // Process the rest of the data similarly to fetchData
        const uniqueRows = dedupJobs(validRows, headers);
        setData([headers, ...uniqueRows]);
        
        const indices = uniqueRows.map((row: RowData) => Array.isArray(row) ? -1 : (row.originalIndex || -1));
        setRowIndices(indices);
        
        // Process other data like skills, locations, etc.
        // This code is duplicated from fetchData - consider refactoring later
        
        setLoadingJobs(false);
        setIsSheetLoaded(true);
        return true;
      } else {
        throw new Error("No sheets found in this spreadsheet");
      }
    } catch (error: any) {
      console.error("Error finding available sheets:", error);
      setError(`We couldn't find any valid sheets in this spreadsheet. Please make sure your Google Sheet has data and is accessible.`);
      setLoadingJobs(false);
      return false;
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
          timeRangeFilter: filters.timeRangeFilter,
          minSalary: filters.minSalary,
          salaryType: filters.salaryType,
          excludedWords: updatedWords,
          sourceFilter: filters.sourceFilter,
          titleFilter: filters.titleFilter,
          maxExperience: filters.maxExperience
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
      timeRangeFilter: filters.timeRangeFilter,
      minSalary: filters.minSalary,
      salaryType: filters.salaryType,
      excludedWords: updatedWords,
      sourceFilter: filters.sourceFilter,
      titleFilter: filters.titleFilter,
      maxExperience: filters.maxExperience
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Save filters to cookies
  const saveFilters = () => {
    const filtersToSave = {
      filterText: filters.filterText,
      selectedLocation: filters.selectedLocation,
      skillFilter: filters.skillFilter,
      showFilters: filters.showFilters,
      timeRangeFilter: filters.timeRangeFilter,
      minSalary: filters.minSalary,
      salaryType: filters.salaryType,
      excludedWords: filters.excludedWords,
      sourceFilter: filters.sourceFilter,
      titleFilter: filters.titleFilter,
      maxExperience: filters.maxExperience
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      filterText: "",
      selectedLocation: "",
      skillFilter: "",
      showFilters: false,
      timeRangeFilter: 168, // Reset to 168 hours (7 days)
      minSalary: 0,
      salaryType: "any",
      excludedWords: [],
      sourceFilter: "",
      titleFilter: "",
      maxExperience: 5 // Reset to 5 years
    });
    setNewSkill("");
    setNewExcludeWord("");
    setNewSource("");
    setNewTitle("");
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
    setSpreadsheetId("");
    setSheetUrl("");
    setLoadingJobs(false);
    Cookies.remove("lastSheetUrl");
    Cookies.remove("lastIndustry");
    setIsSheetLoaded(false);
    setShowIndustrySelector(true);
    setSelectedIndustry("");
    setAppliedJobs([]);
    Cookies.remove("appliedJobs");
    // Reset other filters as well
    clearFilters();
  };

  // Extract headers and rows from data
  const headers = data.length > 0 ? data[0] : [];
  const jobsLoaded = data.length > 1;

  // Add new skill
  const handleAddSkill = () => {
    if (newSkill.trim() !== "") {
      const skill = newSkill.trim();
      // Convert to array of skills if it's a string
      const currentSkills = filters.skillFilter.length 
        ? filters.skillFilter.split(',').map(s => s.trim()) 
        : [];
        
      if (!currentSkills.includes(skill)) {
        const updatedSkills = [...currentSkills, skill];
        setFilters(prev => ({ 
          ...prev, 
          skillFilter: updatedSkills.join(',') 
        }));
        setNewSkill("");
        
        // Save to cookies immediately
        const filtersToSave = {
          filterText: filters.filterText,
          selectedLocation: filters.selectedLocation,
          skillFilter: updatedSkills.join(','),
          showFilters: filters.showFilters,
          timeRangeFilter: filters.timeRangeFilter,
          minSalary: filters.minSalary,
          salaryType: filters.salaryType,
          excludedWords: filters.excludedWords,
          sourceFilter: filters.sourceFilter,
          titleFilter: filters.titleFilter,
          maxExperience: filters.maxExperience
        };
        Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
      }
    }
  };

  // Remove skill
  const handleRemoveSkill = (skill: string) => {
    const currentSkills = filters.skillFilter.split(',').map(s => s.trim());
    const updatedSkills = currentSkills.filter(s => s !== skill);
    
    setFilters(prev => ({ 
      ...prev, 
      skillFilter: updatedSkills.join(',') 
    }));
    
    // Save to cookies immediately
    const filtersToSave = {
      filterText: filters.filterText,
      selectedLocation: filters.selectedLocation,
      skillFilter: updatedSkills.join(','),
      showFilters: filters.showFilters,
      timeRangeFilter: filters.timeRangeFilter,
      minSalary: filters.minSalary,
      salaryType: filters.salaryType,
      excludedWords: filters.excludedWords,
      sourceFilter: filters.sourceFilter,
      titleFilter: filters.titleFilter,
      maxExperience: filters.maxExperience
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Add new title
  const handleAddTitle = () => {
    if (newTitle.trim() !== "") {
      const title = newTitle.trim();
      // Convert to array of titles if it's a string
      const currentTitles = filters.titleFilter.length 
        ? filters.titleFilter.split(',').map(t => t.trim()) 
        : [];
        
      // Check if title already exists (case insensitive)
      const titleExists = currentTitles.some(
        existingTitle => existingTitle.toLowerCase() === title.toLowerCase()
      );
      
      if (!titleExists) {
        const updatedTitles = [...currentTitles, title];
        setFilters(prev => ({ 
          ...prev, 
          titleFilter: updatedTitles.join(',') 
        }));
        setNewTitle("");
        
        // Save to cookies immediately
        const filtersToSave = {
          ...filters,
          titleFilter: updatedTitles.join(',')
        };
        Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
      } else {
        // Title already exists (case insensitive match)
        setNewTitle("");
      }
    }
  };

  // Remove title
  const handleRemoveTitle = (title: string) => {
    const currentTitles = filters.titleFilter.split(',').map(t => t.trim());
    // Remove the title using case-insensitive comparison
    const updatedTitles = currentTitles.filter(t => 
      t.toLowerCase() !== title.toLowerCase()
    );
    
    setFilters(prev => ({ 
      ...prev, 
      titleFilter: updatedTitles.join(',') 
    }));
    
    // Save to cookies immediately
    const filtersToSave = {
      ...filters,
      titleFilter: updatedTitles.join(',')
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Add new source
  const handleAddSource = () => {
    if (!newSource.trim()) return;
    
    const currentSources = filters.sourceFilter.split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    if (currentSources.includes(newSource.trim())) {
      setNewSource("");
      return;
    }
    
    const updatedSources = [...currentSources, newSource.trim()].join(',');
    
    setFilters(prev => ({
      ...prev,
      sourceFilter: updatedSources
    }));
    
    // Save to cookies immediately
    const filtersToSave = {
      ...filters,
      sourceFilter: updatedSources,
      timeRangeFilter: filters.timeRangeFilter
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
    
    setNewSource("");
  };

  // Remove source
  const handleRemoveSource = (source: string) => {
    const currentSources = filters.sourceFilter.split(',').map(s => s.trim());
    const updatedSources = currentSources.filter(s => s !== source);
    
    setFilters(prev => ({
      ...prev,
      sourceFilter: updatedSources.join(',')
    }));
    
    // Save to cookies immediately
    const filtersToSave = {
      ...filters,
      sourceFilter: updatedSources.join(','),
      timeRangeFilter: filters.timeRangeFilter
    };
    Cookies.set("savedFilters", JSON.stringify(filtersToSave), { expires: 30 });
  };

  // Function to handle industry selection
  const handleIndustrySelect = () => {
    if (selectedIndustry) {
      // Save selected industry in cookie
      Cookies.set("lastIndustry", selectedIndustry, { expires: 30 });
      
      loadJobsForIndustry(selectedIndustry);
      setShowIndustrySelector(false);
    }
  };

  // Function to load jobs for a specific industry
  const loadJobsForIndustry = (industry: string) => {
    console.log(`Loading jobs for industry: ${industry} using sheet URL: ${GOOGLE_SHEET_URL}`);
    const id = extractSpreadsheetId(GOOGLE_SHEET_URL);
    if (id) {
      setSpreadsheetId(id);
      setCurrentSheetName(industry);
      fetchData(id, industry);
    } else {
      console.error("Failed to extract spreadsheet ID from URL:", GOOGLE_SHEET_URL);
      setError("Invalid Google Sheets URL in environment configuration");
    }
  };

  // Reset state and show industry selector
  const handleChangeIndustry = () => {
    setShowIndustrySelector(true);
  };

  // New function to handle showing the custom URL input
  const handleShowCustomUrlInput = () => {
    setShowIndustrySelector(false);
    setIsSheetLoaded(false);
  };

  // Add new skill filter from card/list item
  const handleAddSkillFilter = (skillToAdd: string) => {
    if (!skillToAdd) return;
    const skill = skillToAdd.trim();
    const currentSkills = filters.skillFilter.length
      ? filters.skillFilter.split(',').map(s => s.trim())
      : [];

    // Case-insensitive check
    if (!currentSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
      const updatedSkills = [...currentSkills, skill];
      const newFilters = { ...filters, skillFilter: updatedSkills.join(',') };
      setFilters(newFilters);
      toast.success(`Added skill filter: "${skill}"`);
      // Explicitly save filters
      Cookies.set("savedFilters", JSON.stringify(newFilters), { expires: 30 });
    } else {
      // Use generic toast if info isn't available
      toast(`Skill filter "${skill}" already exists.`);
    }
  };

  // Add new source filter from card/list item
  const handleAddSourceFilter = (sourceToAdd: string) => {
    if (!sourceToAdd) return;
    const source = sourceToAdd.trim();
    const currentSources = filters.sourceFilter.length
      ? filters.sourceFilter.split(',').map(s => s.trim())
      : [];

    // Case-insensitive check
    if (!currentSources.some(s => s.toLowerCase() === source.toLowerCase())) {
      const updatedSources = [...currentSources, source];
      const newFilters = { ...filters, sourceFilter: updatedSources.join(',') };
      setFilters(newFilters);
      toast.success(`Added source filter: "${source}"`);
      // Explicitly save filters
      Cookies.set("savedFilters", JSON.stringify(newFilters), { expires: 30 });
    } else {
      // Use generic toast if info isn't available
      toast(`Source filter "${source}" already exists.`);
    }
  };

  // Add new location
  const handleAddLocation = (locationToAdd: string) => {
    if (!locationToAdd.trim()) return;
    const location = locationToAdd.trim();
    const currentLocations = filters.selectedLocation.length
      ? filters.selectedLocation.split(',').map(loc => loc.trim())
      : [];

    // Case-insensitive check
    if (!currentLocations.some(loc => loc.toLowerCase() === location.toLowerCase())) {
      const updatedLocations = [...currentLocations, location];
      const newFilters = { ...filters, selectedLocation: updatedLocations.join(',') };
      setFilters(newFilters);
      toast.success(`Added location filter: "${location}"`);
      Cookies.set("savedFilters", JSON.stringify(newFilters), { expires: 30 });
    } else {
      toast(`Location filter "${location}" already exists.`);
    }
  };

  // Remove location
  const handleRemoveLocation = (locationToRemove: string) => {
    const currentLocations = filters.selectedLocation.split(',').map(loc => loc.trim());
    // Case-insensitive removal
    const updatedLocations = currentLocations.filter(loc => 
      loc.toLowerCase() !== locationToRemove.toLowerCase()
    );
    
    const newFilters = { ...filters, selectedLocation: updatedLocations.join(',') };
    setFilters(newFilters);
    toast.error(`Removed location filter: "${locationToRemove}"`);
    Cookies.set("savedFilters", JSON.stringify(newFilters), { expires: 30 });
  };

  // Function to handle closing the welcome modal
  const handleCloseWelcomeModal = () => {
    setIsWelcomeModalOpen(false);
    setIsFirstVisit(false); // Mark as no longer first visit for this session
    Cookies.set("hasVisited", "true", { expires: 365 }); // Set cookie for 1 year
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 no-overflow mobile-container">
      {/* Page Header */}
      <PageHeader />

      {/* Welcome Modal */} 
      <WelcomeModal 
        isOpen={isWelcomeModalOpen} 
        onClose={handleCloseWelcomeModal} 
      />

      {/* Industry Selector */}
      {showIndustrySelector && !isWelcomeModalOpen && (
        <IndustrySelector
          selectedIndustry={selectedIndustry}
          setSelectedIndustry={setSelectedIndustry}
          industries={INDUSTRY_OPTIONS}
          onSelectIndustry={handleIndustrySelect}
          isLoading={loading}
          onShowCustomUrlInput={handleShowCustomUrlInput}
        />
      )}

      {/* Sheet URL Form - only show if not loading jobs and no industry selected */}
      {!isSheetLoaded && !showIndustrySelector && !isWelcomeModalOpen && (
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
            timeRangeFilter: filters.timeRangeFilter,
            minSalary: filters.minSalary,
            salaryType: filters.salaryType,
            excludedWords: filters.excludedWords,
            sourceFilter: filters.sourceFilter,
            titleFilter: filters.titleFilter
          }}
          onClearFilters={clearFilters}
        />
      )}

      {/* Job Stats and Content */}
      {!loading && data.length > 0 && (
        <>
          {/* Industry change button */}
          {isSheetLoaded && !showIndustrySelector && (
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Viewing: <span className="font-medium">{currentSheetName}</span>
              </div>
              <button
                onClick={handleChangeIndustry}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
              >
                <Briefcase className="w-4 h-4 mr-1" />
                Change Industry
              </button>
            </div>
          )}

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
            uniqueSources={uniqueSources}
            uniqueTitles={uniqueTitles}
            newExcludeWord={newExcludeWord}
            setNewExcludeWord={setNewExcludeWord}
            handleAddExcludedWord={handleAddExcludedWord}
            handleRemoveExcludedWord={handleRemoveExcludedWord}
            newSkill={newSkill}
            setNewSkill={setNewSkill}
            handleAddSkill={handleAddSkill}
            handleRemoveSkill={handleRemoveSkill}
            newSource={newSource}
            setNewSource={setNewSource}
            handleAddSource={handleAddSource}
            handleRemoveSource={handleRemoveSource}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            handleAddTitle={handleAddTitle}
            handleRemoveTitle={handleRemoveTitle}
            handleAddLocation={handleAddLocation}
            handleRemoveLocation={handleRemoveLocation}
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
              onAddSkillFilter={handleAddSkillFilter}
              onAddSourceFilter={handleAddSourceFilter}
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
