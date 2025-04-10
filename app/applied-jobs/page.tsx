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
import { dedupJobs, getFieldValue, validateImageUrl } from "../utils/dataHelpers";
import { RowData, RowDataObject } from "../types/data";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const RANGE = process.env.NEXT_PUBLIC_RANGE;

// Define potential sheet names (mirroring app/page.tsx)
const SHEET_NAMES = [
  process.env.NEXT_PUBLIC_SHEET_NAME_TECH || "Tech Jobs",
  process.env.NEXT_PUBLIC_SHEET_NAME_BUSINESS || "Business Operations Jobs",
  process.env.NEXT_PUBLIC_SHEET_NAME_HEALTHCARE || "Healthcare Jobs",
  process.env.NEXT_PUBLIC_SHEET_NAME_CUSTOMER || "Customer and Social Services and Transportation and Logistics",
  process.env.NEXT_PUBLIC_SHEET_NAME_DEFAULT || "Sheet1", // Include default/legacy
];

const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

const validateJobListing = (row: string[], headers: string[]): boolean => {
  const getField = (fieldName: string) => {
    const index = headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase(),
    );
    // Ensure index is valid and row has enough columns
    return index !== -1 && row.length > index ? (row[index] || "") : ""; 
  };

  return Boolean(
    getField("title")?.trim() &&
    getField("company_name")?.trim()
  );
};

// Update RowData type if needed, or use a new type for combined data
interface CombinedRowData extends RowDataObject {
  sheetName: string; // Add sheetName property
}

export default function AppliedJobsPage() {
  // State for combined data from all sheets
  const [allData, setAllData] = useState<CombinedRowData[]>([]); 
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [appliedJobs, setAppliedJobs] = useState<string[]>(() => {
    const saved = Cookies.get("appliedJobs");
    // Initial cleanup and deduplication of applied jobs from cookies
    if (saved) {
      try {
        const parsedJobs = JSON.parse(saved);
        const uniqueAppliedJobs = [...new Set(parsedJobs as string[])];
        return uniqueAppliedJobs.filter(job => typeof job === 'string' && job.trim() !== '');
      } catch (e) {
        console.error("Error parsing applied jobs from cookie:", e);
        return [];
      }
    }
    return [];
  });
  
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    const savedViewMode = Cookies.get("viewMode");
    return savedViewMode === 'list' ? 'list' : 'card';
  });
  const [filteredRows, setFilteredRows] = useState<CombinedRowData[]>([]); 
  
  // Toast notification state
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Store spreadsheet ID
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  // Effect to get spreadsheet ID and trigger fetch
  useEffect(() => {
    const savedSheetUrl = Cookies.get("lastSheetUrl");
    const id = savedSheetUrl ? extractSpreadsheetId(savedSheetUrl) : null;
    
    // Also check the hardcoded URL from page.tsx as a fallback
    const hardcodedSheetUrl = "https://docs.google.com/spreadsheets/d/1dLV3n1XnbyxMaI71JqcWV-4OYnxa9sAl4kBRcST8rjE";
    const hardcodedId = extractSpreadsheetId(hardcodedSheetUrl);
    
    const finalId = id || hardcodedId; // Prioritize cookie URL, fallback to hardcoded
    
    if (finalId) {
      setSpreadsheetId(finalId);
      fetchDataForAllSheets(finalId);
    } else {
      setError("Could not find a valid Google Sheet ID. Please load jobs on the main page first.");
      setLoading(false);
    }
    
    // Log initial applied jobs state
    console.log("Initial Applied Jobs from Cookie (deduplicated):", appliedJobs);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Effect to filter data when allData or appliedJobs changes
  useEffect(() => {
    // --- START DEBUG LOGGING ---
    console.log("[AppliedJobs Filter] Hook triggered.");
    console.log("[AppliedJobs Filter] Headers:", headers);
    console.log("[AppliedJobs Filter] All Data Rows Count:", allData.length);
    if (allData.length > 0) {
       console.log("[AppliedJobs Filter] Sample Row Data:", JSON.stringify(allData[0]));
    }
    console.log("[AppliedJobs Filter] Applied Jobs from Cookie:", appliedJobs);
    // --- END DEBUG LOGGING ---

    if (headers.length === 0 || allData.length === 0 || appliedJobs.length === 0) {
      console.log("[AppliedJobs Filter] Skipping filter due to missing data/headers/applied jobs.");
      setFilteredRows([]);
      return;
    }
    
    const appliedSet = new Set(appliedJobs); // Use a Set for faster lookups

    // --- START DEBUG LOGGING ---
    console.log("[AppliedJobs Filter] Applied Jobs Set:", appliedSet);
    let processedRowCount = 0;
    let matchFoundCount = 0;
    // --- END DEBUG LOGGING ---

    const filtered = allData.filter(row => {
      processedRowCount++;
      const title = getFieldValue(row, "title", headers);
      const company = getFieldValue(row, "company_name", headers);
      const sheet = row.sheetName; // Get sheet name associated with the row

      // --- START DEBUG LOGGING ---
      // Log only for the first few rows or if title matches the target for clarity
      // if (processedRowCount <= 5 || title?.includes("Backend")) {
      //     console.log(`[AppliedJobs Filter] Processing Row ${processedRowCount}: Sheet='${sheet}', Title='${title}', Company='${company}'`);
      // }
      // --- END DEBUG LOGGING ---

      if (!title) { // Company name might be optional for some matches
          // if (processedRowCount <= 5) console.log(`[AppliedJobs Filter] Row ${processedRowCount}: Skipping due to missing title.`);
          return false; 
      }

      // Create potential IDs to check against the appliedJobs set
      const titleCompanyId = title && company ? `${title}-${company}`.replace(/\s+/g, '-') : "";
      const sheetTitleCompanyId = sheet && titleCompanyId ? `${sheet}:${titleCompanyId}` : "";
      // Handle potential double sheet prefix from older data? (e.g., "Tech Jobs:Tech Jobs:...")
      const doubleSheetTitleCompanyId = sheet && sheetTitleCompanyId ? `${sheet}:${sheetTitleCompanyId}` : "";

      // --- START DEBUG LOGGING ---
      const idsToCheck = [
          title, // Check for title-only legacy format first
          titleCompanyId,
          sheetTitleCompanyId,
          doubleSheetTitleCompanyId
      ].filter(id => !!id); // Filter out empty strings

      // if (processedRowCount <= 5 || title?.includes("Backend")) {
      //    console.log(`[AppliedJobs Filter] Row ${processedRowCount}: IDs generated: [${idsToCheck.join(', ')}]`);
      // }
       // --- END DEBUG LOGGING ---


      // Check if any potential format exists in the applied jobs set
      let isApplied = false;
      for (const idToCheck of idsToCheck) {
          if (appliedSet.has(idToCheck)) {
              isApplied = true;
              matchFoundCount++;
              // --- START DEBUG LOGGING ---
              console.log(`[AppliedJobs Filter] MATCH FOUND! Row ${processedRowCount}: Sheet='${sheet}', Title='${title}', Company='${company}'. Matched ID: '${idToCheck}'`);
              // --- END DEBUG LOGGING ---
              break; // Stop checking once a match is found
          }
      }
      
      // --- START DEBUG LOGGING ---
      // if (!isApplied && (processedRowCount <= 5 || title?.includes("Backend"))) {
      //     console.log(`[AppliedJobs Filter] Row ${processedRowCount}: No match found.`);
      // }
      // --- END DEBUG LOGGING ---

      return isApplied;
    });
    
    // --- START DEBUG LOGGING ---
    console.log(`[AppliedJobs Filter] Filtering complete. Processed: ${processedRowCount}, Initial Matches: ${matchFoundCount}`);
    console.log("[AppliedJobs Filter] Rows after initial filter:", filtered.length);
    // --- END DEBUG LOGGING ---
    
    // Deduplicate based on a composite key (sheet + title + company)
    const uniqueJobsMap = new Map<string, CombinedRowData>();
    filtered.forEach(job => {
        const title = getFieldValue(job, "title", headers);
        const company = getFieldValue(job, "company_name", headers);
        // Use a key robust to missing company/sheet
        const key = `${job.sheetName || 'unknown'}:${title || 'no_title'}:${company || 'no_company'}`; 
        if (!uniqueJobsMap.has(key)) {
            uniqueJobsMap.set(key, job);
        } else {
             // --- START DEBUG LOGGING ---
             console.log(`[AppliedJobs Filter] Deduplicating job: Key='${key}', Title='${title}'`);
             // --- END DEBUG LOGGING ---
        }
    });

    const uniqueAppliedJobRows = Array.from(uniqueJobsMap.values());
    
    // --- START DEBUG LOGGING ---
    console.log("[AppliedJobs Filter] Unique applied job rows after deduplication:", uniqueAppliedJobRows.length);
    // --- END DEBUG LOGGING ---
    
    setFilteredRows(uniqueAppliedJobRows);

  }, [allData, headers, appliedJobs]); // Rerun when data, headers, or applied list changes


  const fetchDataForAllSheets = async (id: string) => {
    setLoading(true);
    setError(null);
    let combinedData: CombinedRowData[] = [];
    let commonHeaders: string[] = [];
    let fetchedHeaders = false;

    try {
      console.log(`Fetching data for sheets: ${SHEET_NAMES.join(', ')} from ID: ${id}`);
      
      for (const sheetName of SHEET_NAMES) {
        // Skip empty sheet names just in case env vars are missing
        if (!sheetName) continue; 
        
        // Construct range dynamically. Assuming data is in columns A:Z. Adjust if needed.
        const range = `${sheetName}!A:Z`; 
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?key=${API_KEY}`;
        
        try {
          // console.log(`Fetching from URL: ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
            // Log non-critical errors (like sheet not found) and continue
            if (response.status === 400 && errorData.error?.message?.includes("Unable to parse range")) {
              console.warn(`Sheet "${sheetName}" not found or empty. Skipping.`);
            } else {
              console.error(`Error fetching sheet "${sheetName}": ${errorData.error?.message || response.statusText}`);
            }
            continue; // Skip to the next sheet
      }

      const result = await response.json();

          if (!result.values || result.values.length < 2) { // Need at least headers + 1 row
            console.warn(`Sheet "${sheetName}" has no data or only headers. Skipping.`);
            continue;
          }
          
          const currentHeaders = result.values[0] as string[];
          const rows = result.values.slice(1) as string[][];

          // Use headers from the first successfully fetched sheet
          if (!fetchedHeaders) {
              commonHeaders = currentHeaders;
              setHeaders(commonHeaders); // Set headers state
              fetchedHeaders = true;
              console.log("Using headers from sheet:", sheetName, commonHeaders);
          } else {
              // Optional: Check if headers match commonHeaders and log warning if not
              if (JSON.stringify(currentHeaders) !== JSON.stringify(commonHeaders)) {
                  console.warn(`Headers mismatch in sheet "${sheetName}". Using headers from first sheet.`);
                  // Potential issue: If column order differs, data mapping might be incorrect.
                  // A more robust solution would involve mapping columns by header name.
              }
          }

          // Process rows from the current sheet
          const processedRows = rows
            .map((rowData, index): CombinedRowData | null => {
              // Basic validation (ensure row is an array with expected length based on headers)
              if (!Array.isArray(rowData)) return null; 
               
              // Pad row with empty strings if it's shorter than headers
              const paddedRowData = [...rowData];
              while (paddedRowData.length < commonHeaders.length) {
                  paddedRowData.push("");
              }

              // Validate required fields using commonHeaders
              if (!validateJobListing(paddedRowData, commonHeaders)) {
                // console.log(`Skipping invalid row ${index + 2} in sheet ${sheetName}`);
                return null;
              }
              
              return {
                data: paddedRowData,
                originalIndex: index + 2, // Sheet-specific original index
                sheetName: sheetName,     // Add sheet name
              };
            })
            .filter((row): row is CombinedRowData => row !== null); // Filter out nulls (invalid rows)

          combinedData = combinedData.concat(processedRows);
          console.log(`Fetched ${processedRows.length} valid rows from sheet "${sheetName}". Total rows now: ${combinedData.length}`);

        } catch (fetchError: any) {
          console.error(`Failed to fetch or process sheet "${sheetName}":`, fetchError.message);
          // Optionally set a partial error state, but continue fetching other sheets
        }
      } // End loop through sheet names

      if (combinedData.length === 0 && fetchedHeaders) {
          // We got headers but no valid data rows from any sheet
          console.warn("Fetched headers but found no valid job data across all sheets.");
          // setError("No valid job listings found in the specified sheets."); // Optional: Set error if desired
      } else if (!fetchedHeaders) {
          // We couldn't even fetch headers from any sheet
          throw new Error("Failed to fetch headers from any sheet. Check Sheet names and permissions.");
      }
      
      // Final deduplication across all sheets
      // We can use the existing dedupJobs, but it doesn't know about sheetName
      // Let's do a simpler title+company deduplication here for applied jobs page
      const finalUniqueJobsMap = new Map<string, CombinedRowData>();
      combinedData.forEach(job => {
          const title = getFieldValue(job, "title", commonHeaders);
          const company = getFieldValue(job, "company_name", commonHeaders);
          const key = `${title}:${company}`; // Key based only on title and company
          if (!finalUniqueJobsMap.has(key)) {
              finalUniqueJobsMap.set(key, job);
          }
          // Note: This simple deduplication keeps the *first* instance found.
          // dedupJobs from dataHelpers keeps the *newest* based on date, which might be better.
          // Consider adapting dedupJobs if keeping the newest applied job instance is critical.
      });
      
      const finalData = Array.from(finalUniqueJobsMap.values());
      console.log(`Total combined valid rows: ${combinedData.length}. Final unique rows (by title+company): ${finalData.length}`);
      
      setAllData(finalData);

    } catch (error: any) {
      console.error("Error fetching data for all sheets:", error);
      setError(error.message || "Failed to fetch data");
      setAllData([]); // Clear data on major error
      setHeaders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApplied = (jobIdentifier: string, jobDetails?: { title: string, company: string, sheetName: string }) => {
    console.log("Toggle applied for identifier:", jobIdentifier, "with details:", jobDetails);
    
    let titleToRemove = jobDetails?.title || jobIdentifier; // Fallback to identifier if details missing
    let companyToRemove = jobDetails?.company || "";
    let sheetToRemove = jobDetails?.sheetName || "";

    // Create IDs to potentially remove based on the provided details or the identifier
    const titleCompanyId = titleToRemove && companyToRemove ? `${titleToRemove}-${companyToRemove}`.replace(/\s+/g, '-') : "";
    const sheetTitleCompanyId = sheetToRemove && titleCompanyId ? `${sheetToRemove}:${titleCompanyId}` : "";
    const doubleSheetTitleCompanyId = sheetToRemove && sheetTitleCompanyId ? `${sheetToRemove}:${sheetTitleCompanyId}` : ""; // Handle sheet:sheet: format

    console.log(`Attempting to remove job. Title: ${titleToRemove}, Company: ${companyToRemove}, Sheet: ${sheetToRemove}`);
    console.log(`IDs to check for removal: [${jobIdentifier}, ${titleToRemove}, ${titleCompanyId}, ${sheetTitleCompanyId}, ${doubleSheetTitleCompanyId}]`);

    const currentAppliedSet = new Set(appliedJobs);
    let changed = false;

    // Try removing all potential formats
    [jobIdentifier, titleToRemove, titleCompanyId, sheetTitleCompanyId, doubleSheetTitleCompanyId].forEach(id => {
        if (id && currentAppliedSet.has(id)) {
            currentAppliedSet.delete(id);
            console.log("Removed ID from applied set:", id);
            changed = true;
        }
    });

    if (changed) {
      const newAppliedJobs = Array.from(currentAppliedSet);
    console.log("New applied jobs list:", newAppliedJobs);
    setAppliedJobs(newAppliedJobs);
    Cookies.set("appliedJobs", JSON.stringify(newAppliedJobs), { expires: 30 });
    
    // Show toast notification
      setToastMessage(`"${titleToRemove}" removed from Applied Jobs`);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
        console.log("Job identifier not found in applied list, no changes made.");
        // Optionally show a message indicating it wasn't found / already removed
    }
  };

  const handleDeleteJob = async (rowIndex: number, sheetName: string) => {
      if (!spreadsheetId || !sheetName) {
          setError("Missing Spreadsheet ID or Sheet Name for deletion.");
          return;
      }

      console.log(`Deleting job with originalIndex: ${rowIndex} from sheet: ${sheetName}`);

      // Find the job details for notification/cookie update before deleting
      const jobToDelete = allData.find(row => row.originalIndex === rowIndex && row.sheetName === sheetName);
      let jobTitle = "";
      let jobCompany = "";
      if (jobToDelete && headers.length > 0) {
          jobTitle = getFieldValue(jobToDelete, "title", headers);
          jobCompany = getFieldValue(jobToDelete, "company_name", headers);
      }
    
    try {
      const response = await fetch("/api/sheets/delete", {
        method: "POST",
              headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex,
                  sheetName, // Pass sheetName to the API endpoint
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
              throw new Error(errorData.error || `Failed to delete row from sheet ${sheetName}`);
          }

          console.log('Delete success response:', await response.json());

          // Remove the job from the local 'allData' state immediately for UI update
          setAllData(prevData => prevData.filter(row => !(row.originalIndex === rowIndex && row.sheetName === sheetName)));

          // Also remove the job from the appliedJobs cookie/state
          if (jobTitle) {
              handleToggleApplied("delete_trigger", { title: jobTitle, company: jobCompany, sheetName: sheetName }); // Use handleToggleApplied to remove all variants
          }

          // Optional: Instead of full refetch, just update local state.
          // fetchDataForAllSheets(spreadsheetId); // Re-fetch all data (can be slow)

          setToastMessage(`"${jobTitle || 'Job'}" deleted successfully`);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 3000);

    } catch (error: any) {
      console.error("Error deleting row:", error);
      setError(error.message || "Failed to delete row");
    }
  };

  const handleUpdateNote = async (rowIndex: number, note: string, columnIndex: number, sheetName: string) => {
      if (!spreadsheetId || !sheetName) {
          setError("Missing Spreadsheet ID or Sheet Name for note update.");
          return;
      }
       if (columnIndex === -1) {
          setError("Could not find 'Notes' column index.");
          return;
      }

      console.log(`Updating note for row ${rowIndex} in sheet ${sheetName}, column ${columnIndex}`);

    try {
      const response = await fetch("/api/sheets/update-note", {
        method: "POST",
              headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          rowIndex,
          note,
          noteColumnIndex: columnIndex,
                  sheetName, // Pass sheetName to the API endpoint
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
              throw new Error(errorData.error || `Failed to update note in sheet ${sheetName}`);
          }

          console.log('Update note success:', await response.json());

          // Update local state immediately for responsiveness
          setAllData(prevData => prevData.map(row => {
              if (row.originalIndex === rowIndex && row.sheetName === sheetName) {
                  const newData = [...row.data];
                  if (columnIndex < newData.length) {
                      newData[columnIndex] = note;
                  }
                  return { ...row, data: newData };
              }
              return row;
          }));

          // Optional: Re-fetch data if needed, but local update is faster
          // fetchDataForAllSheets(spreadsheetId);

    } catch (error: any) {
      console.error("Error updating note:", error);
      setError(error.message || "Failed to update note");
    }
  };


  const toggleViewMode = () => {
    const newViewMode = viewMode === 'card' ? 'list' : 'card';
    setViewMode(newViewMode);
    Cookies.set("viewMode", newViewMode, { expires: 30 });
  };

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
            jobs={filteredRows} // Pass the correctly filtered and structured rows
            appliedJobs={appliedJobs} // Pass the current list of applied job IDs
            onApply={handleToggleApplied} // Pass the updated handler
            onDelete={(rowIndex, jobData) => handleDeleteJob(rowIndex, (jobData as CombinedRowData).sheetName)} // Adapt onDelete call
            onUpdateNote={(rowIndex, note, columnIndex, jobData) => handleUpdateNote(rowIndex, note, columnIndex, (jobData as CombinedRowData).sheetName)} // Adapt onUpdateNote call
                viewMode={viewMode}
                onToggleViewMode={toggleViewMode}
            hideViewToggle={false} // Keep the view toggle
            // We might need to adjust JobCardGrid props if it expects a different data structure
              />
        </>
      ) : (
         // Only show EmptyState if not loading and there was no error fetching headers
        !loading && headers.length > 0 ? <EmptyState /> : null
      )}

      {/* Toast notification */}
      <ToastNotification 
        message={toastMessage} 
        show={showSuccessToast}
      />
    </div>
  );
} 