"use client"

import { useState, useEffect, useRef } from 'react'
import JobCard from './JobCard'
import { ChevronLeft, ChevronRight, Grid, List, MapPin, Calendar, Link2, CheckCircle, Filter, ArrowUpDown } from 'lucide-react'
import { generateJobId, getFieldValue, formatDateSafely } from '../utils/dataHelpers'
import { RowData } from '../types/data'

interface JobData {
  data?: string[];
  originalIndex?: number;
  source?: string;
  [key: string]: any;
}

interface PreparedJob {
  [key: string]: string | undefined;
  id: string;
  originalIndex: number;
  is_applied: boolean;
  title: string;
  company_name: string;
  location: string;
  description: string;
  skills: string;
  date_posted: string;
  currentDate: string;
  currentdate: string;
  url: string;
  company_website: string;
  company_image: string;
  experience: string;
  notes: string;
  source: string;
  job_type: string;
  type: string;
  salary: string;
}

interface JobCardGridProps {
  jobs: JobData[];
  headers: string[];
  appliedJobs: string[];
  onApply: (jobId: string) => void;
  onDelete: (rowIndex: number) => void;
  onUpdateNote: (rowIndex: number, note: string, columnIndex: number) => void;
  onHide?: (jobId: string, title: string, company: string) => void;
  viewMode?: 'card' | 'list';
  onToggleViewMode?: () => void;
  hideViewToggle?: boolean;
}

export default function JobCardGrid({
  jobs,
  headers,
  appliedJobs,
  onApply,
  onDelete,
  onUpdateNote,
  onHide,
  viewMode: externalViewMode,
  onToggleViewMode,
  hideViewToggle = false
}: JobCardGridProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sortedJobs, setSortedJobs] = useState<JobData[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<PreparedJob | null>(null);
  const [keyboardListIndex, setKeyboardListIndex] = useState<number>(-1);
  const keyboardSelectedRef = useRef<HTMLTableRowElement>(null);
  
  // Animation states - only used in card view
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  
  // Only use internal view mode if external is not provided
  const viewMode = externalViewMode ?? 'card';
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  useEffect(() => {
    // Sort jobs by date (newest first)
    if (jobs.length > 0) {
      const datePostedIndex = findColumnIndex('date_posted');
      const currentDateIndex = findColumnIndex('currentdate');
      
      const sortedJobsCopy = [...jobs].sort((a, b) => {
        const jobA = Array.isArray(a) ? a : a.data || [];
        const jobB = Array.isArray(b) ? b : b.data || [];
        
        let dateA: Date | null = null;
        let dateB: Date | null = null;
        
        // Try to get dates from either date_posted or currentDate
        if (datePostedIndex !== -1) {
          dateA = new Date(jobA[datePostedIndex] || '');
          dateB = new Date(jobB[datePostedIndex] || '');
        } else if (currentDateIndex !== -1) {
          dateA = new Date(jobA[currentDateIndex] || '');
          dateB = new Date(jobB[currentDateIndex] || '');
        }
        
        // If both dates are valid, compare them
        if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime();
        }
        
        // Default to original order
        return 0;
      });
      
      setSortedJobs(sortedJobsCopy);
    }
  }, [jobs, headers]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (viewMode !== 'card') return;
    const touchStart = e.touches[0].clientX;
    
    const handleTouchMove = (e: TouchEvent) => {
      const touchEnd = (e as TouchEvent).touches[0].clientX;
      const distance = touchStart - touchEnd;
      
      if (Math.abs(distance) > minSwipeDistance) {
        if (distance > 0) {
          goToNextJob();
        } else {
          goToPrevJob();
        }
        cleanup();
      }
    };
    
    const handleTouchEnd = () => {
      cleanup();
    };
    
    const cleanup = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const findColumnIndex = (fieldName: string) => {
    if (!headers || headers.length === 0) return -1
    
    return headers.findIndex(
      (header) => header.toLowerCase() === fieldName.toLowerCase()
    )
  }
  
  const goToNextJob = () => {
    if (sortedJobs.length === 0 || isAnimating) return
    
    setIsAnimating(true)
    setDirection('left')
    
    setTimeout(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex === sortedJobs.length - 1) {
          return 0
        } else {
          return prevIndex + 1
        }
      })
      
      setTimeout(() => {
        setIsAnimating(false)
        setDirection(null)
      }, 50)
    }, 200)
  }
  
  const goToPrevJob = () => {
    if (sortedJobs.length === 0 || isAnimating) return
    
    setIsAnimating(true)
    setDirection('right')
    
    setTimeout(() => {
      setCurrentIndex((prevIndex) => {
        if (prevIndex === 0) {
          return sortedJobs.length - 1
        } else {
          return prevIndex - 1
        }
      })
      
      setTimeout(() => {
        setIsAnimating(false)
        setDirection(null)
      }, 50)
    }, 200)
  }
  
  const isJobInAppliedList = (job: JobData, index: number): boolean => {
    const id = generateJobId(job, index, headers)
    return appliedJobs.includes(id)
  }
  
  const prepareJobData = (job: JobData, index: number): PreparedJob => {
    // Use our utility function
    const id = generateJobId(job, index, headers)
    
    // Use the getFieldValue utility
    const title = getFieldValue(job, "title", headers)
    const company = getFieldValue(job, "company_name", headers)
    const location = getFieldValue(job, "location", headers)
    const jobType = getFieldValue(job, "job_type", headers) || getFieldValue(job, "type", headers)
    const salary = getFieldValue(job, "salary", headers)
    const datePosted = getFieldValue(job, "date_posted", headers) || getFieldValue(job, "currentdate", headers) || getFieldValue(job, "currentDate", headers)
    const description = getFieldValue(job, "description", headers)
    const url = getFieldValue(job, "url", headers)
    const companyWebsite = getFieldValue(job, "company_website", headers)
    const companyImage = getFieldValue(job, "company_image", headers)
    const experience = getFieldValue(job, "experience", headers)
    const skills = getFieldValue(job, "skills", headers)
    const notes = getFieldValue(job, "notes", headers)
    
    return {
      id,
      originalIndex: typeof job.originalIndex === 'number' ? job.originalIndex : index,
      is_applied: appliedJobs.includes(id),
      title,
      company_name: company,
      location,
      description,
      job_type: jobType,
      type: jobType,
      salary,
      date_posted: datePosted,
      currentDate: datePosted,
      currentdate: datePosted,
      url,
      company_website: companyWebsite,
      company_image: companyImage,
      experience,
      skills,
      notes,
      source: job.source || 'Unknown'
    }
  }
  
  const handleDelete = () => {
    if (sortedJobs.length === 0) return
    
    const job = sortedJobs[currentIndex]
    const originalIndex = job.originalIndex || 0
    
    onDelete(originalIndex)
  }
  
  const handleApply = () => {
    if (sortedJobs.length === 0) return
    
    const job = sortedJobs[currentIndex]
    
    // Get the job title and company to use for marking as applied
    const titleIndex = findColumnIndex('title')
    const companyIndex = findColumnIndex('company_name')
    
    const jobTitle = titleIndex !== -1 ? 
      (Array.isArray(job) ? job[titleIndex] : 
       ((job as any).data ? (job as any).data[titleIndex] : '')) : ''
       
    const jobCompany = companyIndex !== -1 ? 
      (Array.isArray(job) ? job[companyIndex] : 
       ((job as any).data ? (job as any).data[companyIndex] : '')) : ''
    
    // Create a consistent job ID from title and company
    const consistentJobId = jobTitle && jobCompany ? 
      `${jobTitle}-${jobCompany}`.replace(/\s+/g, '-') : 
      jobTitle // Fall back to just the title if no company
    
    console.log("Marking job as applied:", {
      index: currentIndex,
      title: jobTitle,
      company: jobCompany,
      consistentJobId
    });
    
    // Use the consistent job ID if available, otherwise fall back to title or generated ID
    const jobId = consistentJobId || generateJobId(job, currentIndex, headers)
    
    onApply(jobId)
  }
  
  const handleUpdateNote = (note: string) => {
    if (sortedJobs.length === 0) return
    
    const job = sortedJobs[currentIndex]
    const originalIndex = job.originalIndex || 0
    const notesIndex = findColumnIndex('notes')
    
    if (notesIndex !== -1) {
      onUpdateNote(originalIndex, note, notesIndex)
    }
  }

  const toggleViewMode = () => {
    if (onToggleViewMode) {
      // Use external toggle if provided
      onToggleViewMode();
    } else {
      // Otherwise use internal toggle
      setCurrentIndex(0);
    }
    setSelectedJobForDetail(null);
  }

  const handleListItemClick = (job: JobData, index: number) => {
    const preparedJob = prepareJobData(job, index)
    
    // Save job data to localStorage to support mock interview
    try {
      const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}');
      savedJobs[preparedJob.id] = preparedJob;
      localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
      console.log(`Saved job data for ${preparedJob.id} to localStorage from list view`);
    } catch (error) {
      console.error('Error saving job data to localStorage from list view:', error);
    }
    
    setSelectedJobForDetail(preparedJob)
  }

  const handleBackToList = () => {
    setSelectedJobForDetail(null)
  }
  
  // Function to handle hiding a job
  const handleHide = (job: JobData) => {
    if (onHide) {
      const jobData = prepareJobData(job, currentIndex);
      onHide(jobData.id, jobData.title, jobData.company_name);
    }
  };
  
  // Add keyboard navigation event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sortedJobs.length === 0) return;
      
      // Handle arrow keys for card view
      if (viewMode === 'card') {
        if (e.key === 'ArrowRight') {
          goToNextJob();
        } else if (e.key === 'ArrowLeft') {
          goToPrevJob();
        }
      } 
      // Handle arrow keys for list view
      else if (viewMode === 'list') {
        if (selectedJobForDetail) {
          // If in detail view, allow Escape or left arrow to go back to list
          if (e.key === 'Escape' || e.key === 'ArrowLeft') {
            handleBackToList();
          }
        } else {
          // Up and down navigation in list view
          if (e.key === 'ArrowDown') {
            e.preventDefault(); // Prevent page scrolling
            setKeyboardListIndex(prev => {
              const newIndex = prev < sortedJobs.length - 1 ? prev + 1 : prev;
              // If first selection, start from the beginning
              if (prev === -1) return 0;
              return newIndex;
            });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault(); // Prevent page scrolling
            setKeyboardListIndex(prev => prev > 0 ? prev - 1 : prev);
          } else if (e.key === 'Enter' && keyboardListIndex >= 0) {
            // Select the currently highlighted job on Enter
            handleListItemClick(sortedJobs[keyboardListIndex], keyboardListIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode, sortedJobs.length, selectedJobForDetail, keyboardListIndex]);

  // Scroll the selected item into view when using keyboard navigation
  useEffect(() => {
    if (keyboardListIndex >= 0 && keyboardSelectedRef.current) {
      keyboardSelectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [keyboardListIndex]);

  // Save current job data to localStorage to support mock interview
  useEffect(() => {
    // Only save when in card view and we have a valid job
    if (viewMode === 'card' && sortedJobs.length > 0) {
      const currentJob = sortedJobs[currentIndex];
      const preparedJob = prepareJobData(currentJob, currentIndex);
      
      if (preparedJob && preparedJob.id) {
        try {
          const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}');
          savedJobs[preparedJob.id] = preparedJob;
          localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
          console.log(`Saved job data for ${preparedJob.id} to localStorage from card view`);
        } catch (error) {
          console.error('Error saving job data to localStorage from card view:', error);
        }
      }
    }
  }, [currentIndex, viewMode, sortedJobs]);

  if (sortedJobs.length === 0) {
    return <div className="text-center py-8 text-gray-500">No job listings found</div>
  }

  // View mode toggle button
  const ViewToggle = () => (
    !hideViewToggle ? (
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          {sortedJobs.length} Job Listings
        </h2>
        <div className="flex gap-2">
          <button
            onClick={toggleViewMode}
            className="inline-flex items-center px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium 
                      text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 
                      hover:bg-gray-50 dark:hover:bg-gray-700 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 
                      transition-all duration-200 ease-in-out"
            aria-label={viewMode === 'card' ? "Switch to list view" : "Switch to card view"}
          >
            {viewMode === 'card' ? (
              <>
                <List className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">List View</span>
              </>
            ) : (
              <>
                <Grid className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Card View</span>
              </>
            )}
          </button>
        </div>
      </div>
    ) : null
  )
  
  // When in list view mode
  if (viewMode === 'list') {
    if (selectedJobForDetail) {
      // Show detail view for selected job
      const isJobApplied = isJobInAppliedList(selectedJobForDetail, 0) || 
                          appliedJobs.includes(selectedJobForDetail.id) || 
                          appliedJobs.includes(selectedJobForDetail.title);

      return (
        <div className="animate-fade-in">
          <ViewToggle />
          <div className="flex items-center mb-4">
            <button
              onClick={handleBackToList}
              className="inline-flex items-center px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium 
                       text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 
                       hover:bg-gray-50 dark:hover:bg-gray-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 
                       transition-all duration-200 ease-in-out"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to List
            </button>
            <div className="ml-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="hidden sm:inline">Tip: </span>
              Press <kbd className="px-1.5 py-0.5 mx-1 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">Esc</kbd> 
              or <kbd className="px-1.5 py-0.5 mx-1 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">←</kbd> 
              to go back
            </div>
          </div>
          <JobCard
            job={selectedJobForDetail}
            isApplied={isJobApplied}
            onApply={() => {
              // Generate a consistent job ID from title and company if possible
              const title = selectedJobForDetail.title;
              const company = selectedJobForDetail.company_name;
              
              // Create a consistent job ID
              const consistentJobId = title && company ? 
                `${title}-${company}`.replace(/\s+/g, '-') : 
                title; // Fall back to just the title if no company
              
              console.log("List view - toggling job as applied:", {
                title,
                company,
                consistentJobId
              });
              
              // Use the consistent job ID, or fall back to id or title
              onApply(consistentJobId || selectedJobForDetail.id || selectedJobForDetail.title)
            }}
            onDelete={() => {
              onDelete(selectedJobForDetail.originalIndex)
              handleBackToList()
            }}
            onUpdateNote={(note) => {
              const notesIndex = findColumnIndex('notes')
              if (notesIndex !== -1) {
                onUpdateNote(selectedJobForDetail.originalIndex, note, notesIndex)
              }
            }}
          />
        </div>
      )
    }

    return (
      <div className="animate-fade-in transition-opacity duration-300 ease-in-out">
        <ViewToggle />
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 h-[calc(100vh-250px)] min-h-[500px] flex flex-col">
          <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/60">
            <div className="text-sm text-gray-600 dark:text-gray-300 font-medium flex items-center">
              <Filter className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400" />
              <span>{sortedJobs.length} job listings</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <div>
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-400 inline-block" />
                <span>Sorted by date</span>
              </div>
              <div className="hidden md:block">
                <span>Use </span>
                <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">↑</kbd>
                <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">↓</kbd>
                <span> to navigate</span>
              </div>
            </div>
          </div>
          
          {/* Mobile list view - optimized for small screens */}
          <div className="block md:hidden h-full">
            <div className="grid gap-3 overflow-y-auto px-3 py-2 h-full custom-scrollbar">
              {sortedJobs.map((job, index) => {
                const preparedJob = prepareJobData(job, index);
                const isJobApplied = isJobInAppliedList(job, index) || 
                                  appliedJobs.includes(preparedJob.id) || 
                                  appliedJobs.includes(preparedJob.title);
                
                return (
                  <div 
                    key={preparedJob.id || index}
                    ref={keyboardListIndex === index ? keyboardSelectedRef : null}
                    onClick={() => handleListItemClick(job, index)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer p-4 border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all hover:shadow-md animate-fade-in ${
                      keyboardListIndex === index ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 mr-2">
                        {preparedJob.title}
                      </h3>
                      {isJobApplied ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ml-2 whitespace-nowrap flex-shrink-0">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Applied
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ml-2 whitespace-nowrap flex-shrink-0">
                          Not Applied
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs mb-2 font-medium">
                      {preparedJob.company_name}
                    </div>
                    <div className="flex flex-wrap gap-y-1.5 gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                      {preparedJob.location && (
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-gray-400" />
                          <span className="truncate max-w-[150px]">{preparedJob.location}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1 flex-shrink-0 text-gray-400" />
                        <span>
                          {formatDateSafely(preparedJob.date_posted || preparedJob.currentDate || preparedJob.currentdate)}
                        </span>
                      </div>
                      {preparedJob.source && (
                        <div className="flex items-center">
                          <Link2 className="w-3 h-3 mr-1 flex-shrink-0 text-gray-400" />
                          <span>{preparedJob.source}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block h-full overflow-y-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">
                    Job Title
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/5">
                    Company
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/5">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/5">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedJobs.map((job, index) => {
                  const preparedJob = prepareJobData(job, index);
                  const isJobApplied = isJobInAppliedList(job, index) || 
                                    appliedJobs.includes(preparedJob.id) || 
                                    appliedJobs.includes(preparedJob.title);
                  
                  return (
                    <tr 
                      key={preparedJob.id || index}
                      ref={keyboardListIndex === index ? keyboardSelectedRef : null}
                      onClick={() => handleListItemClick(job, index)}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                        keyboardListIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900 dark:text-white line-clamp-2">
                          {preparedJob.title}
                        </div>
                        {preparedJob.source && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                            <Link2 className="w-3 h-3 mr-1" />
                            {preparedJob.source}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {preparedJob.company_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {preparedJob.location && (
                          <div className="flex items-center">
                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400 flex-shrink-0" />
                            <span className="line-clamp-1">{preparedJob.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDateSafely(preparedJob.date_posted || preparedJob.currentDate || preparedJob.currentdate)}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {isJobApplied ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Applied
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            Not Applied
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  
  // Default card view mode
  const currentJob = sortedJobs[currentIndex]
  const preparedJob = prepareJobData(currentJob, currentIndex)
  
  // Replace the existing isJobApplied check with our more robust function
  const isJobApplied = isJobInAppliedList(currentJob, currentIndex) || 
                       appliedJobs.includes(preparedJob.id) || 
                       appliedJobs.includes(preparedJob.title);
  
  const animationClass = direction === 'left' 
    ? 'animate-slide-out-left' 
    : direction === 'right' 
      ? 'animate-slide-out-right' 
      : ''
  
  return (
    <div className="relative animate-fade-in transition-opacity duration-300 ease-in-out">
      <ViewToggle />
      <div
        ref={cardRef}
        className={`relative ${animationClass}`}
        onTouchStart={onTouchStart}
      >
        <JobCard
          job={preparedJob}
          isApplied={isJobApplied}
          onApply={handleApply}
          onDelete={handleDelete}
          onHide={() => handleHide(currentJob)}
          onUpdateNote={handleUpdateNote}
        />
      </div>
      
      <div className="flex justify-center mt-6 gap-3">
        <button
          onClick={goToPrevJob}
          className="inline-flex items-center justify-center p-2 rounded-full 
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                   shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500
                   transition-all duration-200 ease-in-out"
          aria-label="Previous job"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        
        <div className="flex items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {currentIndex + 1} of {sortedJobs.length}
          </span>
        </div>
        
        <button
          onClick={goToNextJob}
          className="inline-flex items-center justify-center p-2 rounded-full 
                   bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                   shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500
                   transition-all duration-200 ease-in-out"
          aria-label="Next job"
        >
          <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <span>Use </span>
        <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">←</kbd>
        <kbd className="px-1.5 py-0.5 mx-0.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800">→</kbd>
        <span> to navigate between jobs</span>
      </div>
    </div>
  )
}
