"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import SheetUrlForm from "./components/SheetUrlForm";
import JobCardGrid from "./components/JobCardGrid";
import { FileSpreadsheet, Users, CheckCircle, AlertCircle } from "lucide-react";

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
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setError(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApplied = (jobId: string) => {
    console.log("Toggling applied status for job ID:", jobId);
    
    // Find the job title from the job ID if possible
    const titleIndex = headers.findIndex(
      (header) => header.toLowerCase() === "title"
    );
    
    if (titleIndex !== -1) {
      // Try to find the job with this ID
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

  // Extract headers and rows from data
  const headers = data.length > 0 ? data[0] : [];
  const rows = data.slice(1);

  // Add originalIndex to rows for JobCardGrid
  const rowsWithIndices = rows.map((row, index) => {
    return {
      ...row,
      originalIndex: rowIndices[index] || index + 2,
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
              <span>Use the arrow buttons below the card to view previous or next job listings. Jobs are sorted with newest first.</span>
            </p>
          </div>

          <JobCardGrid
            jobs={rowsWithIndices}
            headers={headers}
            appliedJobs={appliedJobs}
            onApply={handleToggleApplied}
            onDelete={handleDeleteJob}
            onUpdateNote={handleUpdateNote}
          />
        </>
      )}
    </div>
  );
}
