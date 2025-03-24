"use client"

import { useState, useEffect, useRef, TouchEvent } from 'react'
import JobCard from './JobCard'
import { ChevronLeft, ChevronRight, Grid, List, MapPin, Calendar, Link2, CheckCircle, Filter, ArrowUpDown } from 'lucide-react'

// Define types for job data
interface JobData {
  [key: number]: string | number | boolean | null;
  data?: string[];
  originalIndex?: number;
}

interface PreparedJob {
  id: string;
  originalIndex: number;
  is_applied: boolean;
  title: string;
  company_name: string;
  location?: string;
  description?: string;
  skills?: string;
  date_posted?: string;
  currentDate?: string;
  currentdate?: string;
  url?: string;
  company_website?: string;
  company_image?: string;
  experience?: string;
  notes?: string;
  source: string;
  [key: string]: any;
}

interface JobCardGridProps {
  jobs: JobData[];
  headers: string[];
  appliedJobs: string[];
  onApply: (jobId: string) => void;
  onDelete: (rowIndex: number) => void;
  onUpdateNote: (rowIndex: number, note: string, columnIndex: number) => void;
  onHide?: (jobId: string, title: string, company: string) => void;
  viewMode?: 'card' | 'list'; // Optional prop to control view mode externally
  onToggleViewMode?: () => void; // Optional callback for view mode toggle
  hideViewToggle?: boolean; // Whether to hide the internal view toggle
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [sortedJobs, setSortedJobs] = useState<JobData[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [internalViewMode, setInternalViewMode] = useState<'card' | 'list'>('card')
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<PreparedJob | null>(null)
  
  // Determine which view mode to use (external or internal)
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50
  
  // Log jobs data for debugging
  useEffect(() => {
    console.log("Jobs data in JobCardGrid:", jobs);
    console.log("Headers in JobCardGrid:", headers);
    
    // Sort jobs by date (newest first)
    if (jobs.length > 0) {
      const datePostedIndex = findColumnIndex('date_posted')
      const currentDateIndex = findColumnIndex('currentdate')
      
      const sortedJobsCopy = [...jobs].sort((a, b) => {
        const jobA = Array.isArray(a) ? a : a.data
        const jobB = Array.isArray(b) ? b : b.data
        
        let dateA: Date | null = null
        let dateB: Date | null = null
        
        // Try to get dates from either date_posted or currentDate
        if (datePostedIndex !== -1) {
          dateA = new Date(jobA[datePostedIndex] || '')
          dateB = new Date(jobB[datePostedIndex] || '')
        } else if (currentDateIndex !== -1) {
          dateA = new Date(jobA[currentDateIndex] || '')
          dateB = new Date(jobB[currentDateIndex] || '')
        }
        
        // If both dates are valid, compare them
        if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime()
        }
        
        // Default to original order
        return 0
      })
      
      setSortedJobs(sortedJobsCopy)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, headers])
  
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
  
  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe) {
      goToNextJob()
    } else if (isRightSwipe) {
      goToPrevJob()
    }
  }
  
  const generateJobId = (job: JobData, index: number) => {
    // Try to use a unique identifier from the job data
    const jobData = Array.isArray(job) ? job : job.data || []
    
    // Check if there's an ID field
    const idIndex = findColumnIndex('id')
    if (idIndex !== -1 && jobData[idIndex]) {
      const id = jobData[idIndex];
      console.log(`Generated job ID from ID field: ${id} for job at index ${index}`);
      return id.toString();
    }
    
    // Use a combination of title and company name if available
    const titleIndex = findColumnIndex('title')
    const companyIndex = findColumnIndex('company_name')
    
    if (titleIndex !== -1 && companyIndex !== -1 && jobData[titleIndex] && jobData[companyIndex]) {
      const id = `${jobData[titleIndex]}-${jobData[companyIndex]}-${index}`;
      console.log(`Generated job ID from title and company: ${id} for job at index ${index}`);
      return id;
    }
    
    // Fallback to index
    const id = `job-${index}`;
    console.log(`Generated fallback job ID: ${id} for job at index ${index}`);
    return id;
  }
  
  // Check if a job is applied using all possible ID formats
  const isJobInAppliedList = (job: JobData, index: number): boolean => {
    // Get the job title and company
    const titleIndex = findColumnIndex('title');
    const companyIndex = findColumnIndex('company_name');
    
    // Extract job data depending on format
    const jobData = Array.isArray(job) ? job : (job.data || []);
    
    // Get title and company name
    const title = titleIndex !== -1 ? jobData[titleIndex] || '' : '';
    const company = companyIndex !== -1 ? jobData[companyIndex] || '' : '';
    
    if (!title) return false;
    
    // Create the consistent ID format
    const consistentJobId = title && company ? 
      `${title}-${company}`.replace(/\s+/g, '-') : title;
    
    // Check all possible formats:
    // 1. As the consistent ID (title-company)
    // 2. Just by the title (older format)
    // 3. With the title-company prefix (may have additional suffix)
    return (
      appliedJobs.includes(consistentJobId) ||
      appliedJobs.includes(title) ||
      (company && appliedJobs.some(id => id.startsWith(`${title}-${company}`)))
    );
  };
  
  const prepareJobData = (job: JobData, index: number): PreparedJob => {
    // Ensure we have valid job data
    if (!job) {
      console.error('Invalid job data:', job);
      return {
        id: `job-${index}`,
        originalIndex: index + 2,
        title: 'Unknown Job',
        company_name: 'Unknown Company',
        location: '',
        description: '',
        skills: '',
        date_posted: '',
        currentDate: '',
        currentdate: '',
        url: '',
        company_website: '',
        company_image: '',
        experience: '',
        notes: '',
        source: 'Unknown',
        is_applied: false
      };
    }

    // Get the job data array, handling both array and object formats
    const jobData = Array.isArray(job) ? job : (job.data || []);
    
    // Ensure we have a valid originalIndex
    const originalIndex = job.originalIndex || index + 2;
    
    // Create a structured job object
    const structuredJob: PreparedJob = {
      id: generateJobId(job, index),
      originalIndex,
      is_applied: isJobInAppliedList(job, index), // Add applied status
      title: '',
      company_name: '',
      source: 'Unknown'
    };
    
    // Map all available fields from the headers
    headers.forEach((header, idx) => {
      const key = header.toLowerCase().replace(/\s+/g, '_');
      structuredJob[key] = jobData[idx] || '';
    });
    
    // Extract source from company_website or url field
    structuredJob.source = extractSourceFromUrl(structuredJob.company_website || structuredJob.url || '');
    
    return structuredJob;
  }
  
  // Extract source name from URL (e.g., linkedin.com, indeed.com)
  const extractSourceFromUrl = (url: string): string => {
    if (!url) return 'Unknown'
    
    try {
      // Remove protocol and www. prefix
      let domain = url.replace(/^(https?:\/\/)?(www\.)?/i, '')
      
      // Get domain name without path
      domain = domain.split('/')[0]
      
      // Special case handling for common job sites
      if (domain.includes('linkedin')) return 'LinkedIn'
      if (domain.includes('indeed')) return 'Indeed'
      if (domain.includes('ziprecruiter')) return 'ZipRecruiter'
      if (domain.includes('monster')) return 'Monster'
      if (domain.includes('glassdoor')) return 'Glassdoor'
      if (domain.includes('dice')) return 'Dice'
      if (domain.includes('simplyhired')) return 'SimplyHired'
      if (domain.includes('careerbuilder')) return 'CareerBuilder'
      if (domain.includes('google.com/about/careers')) return 'Google Careers'
      
      // Return just the domain part
      return domain
    } catch (error) {
      console.error('Error extracting source from URL:', url, error)
      return 'Unknown'
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
    const jobId = consistentJobId || generateJobId(job, currentIndex)
    
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
      setInternalViewMode(viewMode === 'card' ? 'list' : 'card');
    }
    setSelectedJobForDetail(null);
  }

  const handleListItemClick = (job: JobData, index: number) => {
    const preparedJob = prepareJobData(job, index)
    setSelectedJobForDetail(preparedJob)
  }

  const handleBackToList = () => {
    setSelectedJobForDetail(null)
  }
  
  // Format a date string safely
  const formatDateSafely = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.log('Invalid date in JobCardGrid:', dateString);
        return dateString;
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date in JobCardGrid:', dateString, e);
      return dateString || 'Unknown';
    }
  }
  
  // Function to handle hiding a job
  const handleHide = (job: JobData) => {
    if (onHide) {
      const jobData = prepareJobData(job, currentIndex);
      onHide(jobData.id, jobData.title, jobData.company_name);
    }
  };
  
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
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-400" />
              <span>Sorted by date</span>
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
                    onClick={() => handleListItemClick(job, index)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer p-4 border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-all hover:shadow-md animate-fade-in"
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
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/8">
                    Date Posted
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/8">
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
                      onClick={() => handleListItemClick(job, index)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
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
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
    </div>
  )
}
