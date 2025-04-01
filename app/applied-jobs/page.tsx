"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import JobCardGrid from "../components/JobCardGrid";

// Import the components we created
import PageHeader from "../components/appliedjobs/PageHeader";
import ErrorMessage from "../components/appliedjobs/ErrorMessage";
import LoadingState from "../components/appliedjobs/LoadingState";
import EmptyState from "../components/appliedjobs/EmptyState";
import JobStatusHeader from "../components/appliedjobs/JobStatusHeader";
import ToastNotification from "../components/appliedjobs/ToastNotification";

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
}

export default function AppliedJobsPage() {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const saved = Cookies.get("appliedJobs");
    return saved ? JSON.parse(saved) : [];
  });
  const [rowIndices, setRowIndices] = useState<number[]>([]);
  const [totalSheetRows, setTotalSheetRows] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    // Try to get viewMode from cookie to maintain consistency between pages
    const savedViewMode = Cookies.get("viewMode");
    return savedViewMode === 'list' ? 'list' : 'card';
  });
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  
  // Toast notification state
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    if (savedSheetUrl) {
      const id = extractSpreadsheetId(savedSheetUrl);
      if (id) {
        fetchData(id);
      }
    }
    
    // Debug applied jobs from cookies and deduplicate them
    const savedAppliedJobs = Cookies.get("appliedJobs");
    console.log("Applied jobs from cookies:", savedAppliedJobs);
    if (savedAppliedJobs) {
      try {
        const parsedJobs = JSON.parse(savedAppliedJobs);
        console.log("Parsed applied jobs:", parsedJobs);
        
        // Deduplicate the applied jobs list
        const uniqueAppliedJobs = [...new Set(parsedJobs)];
        
        // Filter out empty strings or null values
        const cleanedAppliedJobs = uniqueAppliedJobs.filter(job => 
          typeof job === 'string' && job.trim() !== ''
        );
        
        // If we found and removed duplicates or invalid entries, update the cookie
        if (cleanedAppliedJobs.length !== parsedJobs.length) {
          console.log("Found duplicate or invalid applied jobs. Cleaning up...");
          console.log("Original count:", parsedJobs.length);
          console.log("Cleaned count:", cleanedAppliedJobs.length);
          
          // Update the cookie with deduplicated list
          Cookies.set("appliedJobs", JSON.stringify(cleanedAppliedJobs), { expires: 30 });
          
          // Update the state
          setAppliedJobs(cleanedAppliedJobs as string[]);
        }
      } catch (e) {
        console.error("Error parsing applied jobs:", e);
        // Reset the cookie if it's invalid
        Cookies.set("appliedJobs", JSON.stringify([]), { expires: 30 });
        setAppliedJobs([]);
      }
    }
  }, []);

  useEffect(() => {
    if (data.length <= 1) return; // No data or just headers
    
    const headers = data[0];
    const rows = data.slice(1);
    
    console.log("Total rows from fetched data:", rows.length);
    console.log("Applied jobs IDs:", appliedJobs);
    
    // Create a map to track unique jobs by title-company combination
    const uniqueJobsMap = new Map();
    
    // Filter rows to show only applied jobs and handle duplicates
    rows.forEach((row) => {
      try {
        const titleIndex = findColumnIndex("title");
        const companyIndex = findColumnIndex("company_name");
        
        let title = "";
        let company = "";
        
        if (Array.isArray(row)) {
          title = titleIndex !== -1 ? row[titleIndex] : "";
          company = companyIndex !== -1 ? row[companyIndex] : "";
        } else if (row && typeof row === 'object') {
          // Check if row has a data property
          const rowData = 'data' in row ? (row as { data: string[] }).data : [];
          title = titleIndex !== -1 && rowData.length > titleIndex ? rowData[titleIndex] : "";
          company = companyIndex !== -1 && rowData.length > companyIndex ? rowData[companyIndex] : "";
        }
        
        if (!title) return;
        
        // Generate job ID to match against applied jobs list
        const jobId = `${title}-${company}`.replace(/\s+/g, '-');
        
        // Check if this job is in the applied jobs list in any format:
        // 1. As a compound ID (title-company)
        // 2. Just by title (older format)
        // 3. With additional suffix like title-company-index
        const isApplied = appliedJobs.includes(jobId) || 
                         appliedJobs.includes(title) || 
                         appliedJobs.some(id => {
                           // Match prefix pattern for jobs with the same title-company
                           if (company) {
                             return id.startsWith(`${title}-${company}`);
                           }
                           // For jobs without company, just match title
                           return id === title;
                         });
                         
        if (isApplied) {
          // Create a unique key for this job (title + company)
          const uniqueKey = `${title}-${company}`;
          
          // Only add to map if we haven't seen this job before
          if (!uniqueJobsMap.has(uniqueKey)) {
            // Map the row to include original index for reference later
            if (Array.isArray(row)) {
              // Process for a regular array row
              const rowIndex = rows.indexOf(row) + 1; // Add 1 to account for header
              Object.defineProperty(row, 'originalIndex', {
                value: rowIndex,
                enumerable: true
              });
            }
            
            uniqueJobsMap.set(uniqueKey, row);
          }
        }
      } catch (e) {
        console.error("Error filtering applied job:", e);
      }
    });
    
    // Convert map values to array
    const uniqueAppliedJobRows = Array.from(uniqueJobsMap.values());
    console.log("Unique applied job rows found:", uniqueAppliedJobRows.length);
    
    setFilteredRows(uniqueAppliedJobRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, appliedJobs]);

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
      setTotalSheetRows(rows.length);

      // Add original indices to rows before filtering
      const rowsWithIndices = rows.map((row: string[], index: number) => ({
        data: row,
        originalIndex: index + 2,
      }));

      // Filter out invalid entries while preserving original indices
      const validRows = rowsWithIndices.filter((row: RowData) => {
        const isValid = validateJobListing(row.data, headers);
        return isValid;
      });

      console.log("Valid rows after filtering:", validRows.length);

      if (validRows.length === 0) {
        throw new Error("No valid job listings found");
      }

      // Keep the original structure with originalIndex for JobCardGrid
      setData([headers, ...validRows]);

      const indices = validRows.map((row: RowData) => row.originalIndex);
      setRowIndices(indices);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setError(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApplied = (jobId: string) => {
    console.log("Toggle applied for job ID:", jobId);
    
    // First, check if this is a title-company format or just a title
    const jobIdParts = jobId.split('-');
    const potentialTitle = jobIdParts[0];
    const jobTitle = potentialTitle || jobId;
    
    // Create a new array filtering out any variations of this job ID
    const newAppliedJobs = appliedJobs.filter(id => {
      // Don't match this exact ID
      if (id === jobId) return false;
      
      // Don't match if it's just the title (older format)
      if (id === potentialTitle) return false;
      
      // Don't match if it starts with the same title-company pattern
      if (jobIdParts.length > 1 && id.startsWith(`${potentialTitle}-`)) return false;
      
      // Keep all other jobs
      return true;
    });
    
    // Since we're on the Applied Jobs page, if we're toggling a job,
    // we're most likely removing it from applied status
    const wasRemoved = appliedJobs.length !== newAppliedJobs.length;
    
    if (wasRemoved) {
      // Job was removed
      setToastMessage(`"${jobTitle}" removed from Applied Jobs`);
    } else {
      // This shouldn't usually happen on the applied page, but just in case
      newAppliedJobs.push(jobId);
      setToastMessage(`"${jobTitle}" moved to Applied Jobs`);
    }
    
    console.log("New applied jobs list:", newAppliedJobs);
    setAppliedJobs(newAppliedJobs);
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
    
    // Show toast notification
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleDeleteJob = async (rowIndex: number) => {
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    if (!savedSheetUrl) return;
    
    const spreadsheetId = extractSpreadsheetId(savedSheetUrl);
    if (!spreadsheetId) return;

    console.log('Deleting job with rowIndex:', rowIndex);
    
    // Find the job title before deleting it
    const jobToDelete = rowsWithIndices.find(row => {
      if (Array.isArray(row)) {
        return (row as any).originalIndex === rowIndex;
      } else {
        return (row as any).originalIndex === rowIndex;
      }
    });
    
    let jobTitle = '';
    if (jobToDelete) {
      if (Array.isArray(jobToDelete)) {
        jobTitle = titleIndex !== -1 ? (jobToDelete as any)[titleIndex] : '';
      } else {
        jobTitle = titleIndex !== -1 ? ((jobToDelete as any).data ? (jobToDelete as any).data[titleIndex] : '') : '';
      }
    }
    
    console.log('Job title to be removed from applied jobs:', jobTitle);
    
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

      // Also remove the job from the appliedJobs cookie if we found a title
      if (jobTitle && appliedJobs.includes(jobTitle)) {
        const newAppliedJobs = appliedJobs.filter(job => job !== jobTitle);
        setAppliedJobs(newAppliedJobs);
        Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
        console.log('Removed job from applied jobs cookie:', jobTitle);
      }

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
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    if (!savedSheetUrl) return;
    
    const spreadsheetId = extractSpreadsheetId(savedSheetUrl);
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

  const toggleViewMode = () => {
    const newViewMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newViewMode);
    // Save viewMode in cookie for consistency between pages
    Cookies.set("viewMode", newViewMode, { expires: 30 });
  };

  // Function to find column index by name
  const findColumnIndex = (fieldName: string) => {
    if (!headers || headers.length === 0) return -1;
    
    return headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase()
    );
  };
  
  // Generate job ID in the same way as JobCardGrid
  const generateJobId = (job: any, index: number) => {
    // Try to use a unique identifier from the job data
    const jobData = Array.isArray(job) ? job : job.data;
    
    // Check if there's an ID field
    const idIndex = findColumnIndex('id');
    if (idIndex !== -1 && jobData[idIndex]) {
      return jobData[idIndex];
    }
    
    // Use a combination of title and company name if available
    const titleIndex = findColumnIndex('title');
    const companyIndex = findColumnIndex('company_name');
    
    if (titleIndex !== -1 && companyIndex !== -1 && jobData[titleIndex] && jobData[companyIndex]) {
      return `${jobData[titleIndex]}-${jobData[companyIndex]}-${index}`;
    }
    
    // Fallback to index
    return `job-${index}`;
  };

  // Extract headers and rows from data
  const headers = data.length > 0 ? data[0] : [];
  const rows = data.slice(1);

  // Find the title column index
  const titleIndex = findColumnIndex('title');

  // Add originalIndex to rows for JobCardGrid
  const rowsWithIndices = rows.map((row, index) => {
    return {
      ...row,
      originalIndex: rowIndices[index] || index + 2,
    };
  });

  // Debug the structure of the first few rows
  if (rowsWithIndices.length > 0) {
    console.log("Sample row structure:", JSON.stringify(rowsWithIndices[0]));
    console.log("Headers:", headers);
    
    // Try to access the data property to see if it exists
    const sampleRow = rowsWithIndices[0] as any;
    if (sampleRow.data) {
      console.log("Sample row data exists:", sampleRow.data);
    } else {
      console.log("Sample row keys:", Object.keys(sampleRow));
      console.log("Sample row is array:", Array.isArray(sampleRow));
    }
  }

  // Find all job titles
  const allJobTitles = rowsWithIndices.map(row => {
    if (Array.isArray(row)) {
      return titleIndex !== -1 ? (row as any)[titleIndex] : '';
    } else {
      return titleIndex !== -1 ? ((row as any).data ? (row as any).data[titleIndex] : '') : '';
    }
  });
  
  console.log("All job titles:", allJobTitles);
  
  // Filter applied job rows based on title
  const appliedJobRows = rowsWithIndices.filter((row, index) => {
    const jobTitle = allJobTitles[index];
    const isApplied = jobTitle && appliedJobs.includes(jobTitle);
    
    if (isApplied) {
      console.log("Found applied job:", jobTitle);
    }
    
    return isApplied;
  });
  
  // Deduplicate applied job rows based on job title
  const uniqueJobTitles = new Set<string>();
  const uniqueAppliedJobRows = appliedJobRows.filter((row) => {
    // Get the job title for this row
    let jobTitle = '';
    if (Array.isArray(row)) {
      jobTitle = titleIndex !== -1 ? (row as any)[titleIndex] : '';
    } else {
      jobTitle = titleIndex !== -1 ? ((row as any).data ? (row as any).data[titleIndex] : '') : '';
    }
    
    // If we don't have a valid job title or we've already seen this job title, filter it out
    if (!jobTitle || uniqueJobTitles.has(jobTitle)) {
      if (jobTitle) {
        console.log("Filtering out duplicate job:", jobTitle);
      }
      return false;
    }
    
    // Otherwise, add it to our set and keep it
    uniqueJobTitles.add(jobTitle);
    return true;
  });
  
  console.log("Applied job rows after filtering:", appliedJobRows.length);
  console.log("Unique applied job rows after deduplication:", uniqueAppliedJobRows.length);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="mb-8 sm:mb-12">
        <PageHeader />
      </div>

      <ErrorMessage message={error || ""} />

      {loading ? (
        <LoadingState />
      ) : filteredRows.length > 0 ? (
        <>
          <JobStatusHeader count={filteredRows.length} />

          <JobCardGrid
            headers={headers}
            jobs={filteredRows}
            appliedJobs={appliedJobs}
            onApply={handleToggleApplied}
            onDelete={handleDeleteJob}
            onUpdateNote={handleUpdateNote}
            viewMode={viewMode}
            onToggleViewMode={toggleViewMode}
            hideViewToggle={false}
          />
        </>
      ) : (
        <EmptyState />
      )}

      {/* Toast notification */}
      <ToastNotification 
        message={toastMessage} 
        show={showSuccessToast}
      />
    </div>
  );
} 