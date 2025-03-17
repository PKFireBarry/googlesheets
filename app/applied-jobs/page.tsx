"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import JobCardGrid from "../components/JobCardGrid";
import { CheckCircle, FileSpreadsheet, Briefcase } from "lucide-react";

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
    const newAppliedJobs = appliedJobs.includes(jobId)
      ? appliedJobs.filter((id) => id !== jobId)
      : [...appliedJobs, jobId];

    setAppliedJobs(newAppliedJobs);
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
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
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 sm:p-10 text-white mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Applied Jobs
          </h1>
          <p className="text-green-100 text-lg max-w-2xl">
            Track and manage all the jobs you've applied to. Keep notes on your application status and interview progress.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : uniqueAppliedJobRows.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-500" />
              <span className="text-lg font-medium">
                {uniqueAppliedJobRows.length} Applied Job{uniqueAppliedJobRows.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <JobCardGrid
            headers={headers}
            jobs={uniqueAppliedJobRows}
            appliedJobs={appliedJobs}
            onApply={handleToggleApplied}
            onDelete={handleDeleteJob}
            onUpdateNote={handleUpdateNote}
          />
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <Briefcase className="h-8 w-8 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No Applied Jobs Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't marked any jobs as applied. When you apply for jobs, they'll appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
} 