"use client"

import { useState, useEffect, useRef, TouchEvent } from 'react'
import JobCard from './JobCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface JobCardGridProps {
  jobs: Array<any>;
  headers: string[];
  appliedJobs: string[];
  onApply: (jobId: string) => void;
  onDelete: (rowIndex: number) => void;
  onUpdateNote: (rowIndex: number, note: string, columnIndex: number) => void;
}

export default function JobCardGrid({
  jobs,
  headers,
  appliedJobs,
  onApply,
  onDelete,
  onUpdateNote
}: JobCardGridProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [sortedJobs, setSortedJobs] = useState<any[]>([])
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  
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
  
  const generateJobId = (job: any, index: number) => {
    // Try to use a unique identifier from the job data
    const jobData = Array.isArray(job) ? job : job.data
    
    // Check if there's an ID field
    const idIndex = findColumnIndex('id')
    if (idIndex !== -1 && jobData[idIndex]) {
      const id = jobData[idIndex];
      console.log(`Generated job ID from ID field: ${id} for job at index ${index}`);
      return id;
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
  
  const prepareJobData = (job: any, index: number) => {
    const jobData = Array.isArray(job) ? job : job.data
    const originalIndex = job.originalIndex || index + 2
    
    // Create a structured job object
    const structuredJob: any = {
      id: generateJobId(job, index),
      originalIndex
    }
    
    // Map all available fields from the headers
    headers.forEach((header, idx) => {
      const key = header.toLowerCase().replace(/\s+/g, '_')
      structuredJob[key] = jobData[idx] || ''
    })
    
    return structuredJob
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
    
    // Get the job title to use for marking as applied
    const titleIndex = findColumnIndex('title')
    const jobTitle = titleIndex !== -1 ? 
      (Array.isArray(job) ? job[titleIndex] : 
       ((job as any).data ? (job as any).data[titleIndex] : '')) : ''
    
    // Use the job title if available, otherwise fall back to ID
    const jobId = jobTitle || generateJobId(job, currentIndex)
    
    console.log("Marking job as applied:", {
      index: currentIndex,
      title: jobTitle,
      company: Array.isArray(job) ? job[findColumnIndex('company_name')] : 
               ((job as any).data ? (job as any).data[findColumnIndex('company_name')] : 'Unknown'),
      jobId
    });
    
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
  
  if (sortedJobs.length === 0) {
    return <div className="text-center py-8 text-gray-500">No job listings found</div>
  }
  
  const currentJob = sortedJobs[currentIndex]
  const preparedJob = prepareJobData(currentJob, currentIndex)
  
  // Check if the job is applied based on its title
  const titleIndex = findColumnIndex('title')
  const jobTitle = titleIndex !== -1 ? 
    (Array.isArray(currentJob) ? currentJob[titleIndex] : 
     ((currentJob as any).data ? (currentJob as any).data[titleIndex] : '')) : ''
  
  // First check if the job title is in the applied jobs list
  let isCurrentJobApplied = jobTitle && appliedJobs.includes(jobTitle)
  
  // If not found by title, fall back to checking by ID
  if (!isCurrentJobApplied) {
    isCurrentJobApplied = appliedJobs.includes(preparedJob.id)
  }
  
  console.log("Current job:", {
    title: jobTitle,
    id: preparedJob.id,
    isApplied: isCurrentJobApplied,
    appliedJobs
  })
  
  return (
    <div className="relative">
      <div 
        ref={cardRef}
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div 
          className={`transition-transform duration-300 ease-in-out ${
            isAnimating && direction === 'left' ? 'translate-x-[-100%] opacity-0' : 
            isAnimating && direction === 'right' ? 'translate-x-[100%] opacity-0' : 
            'translate-x-0 opacity-100'
          }`}
        >
          <JobCard 
            job={preparedJob}
            isApplied={isCurrentJobApplied}
            onApply={handleApply}
            onDelete={handleDelete}
            onUpdateNote={handleUpdateNote}
          />
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-6">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Job {currentIndex + 1} of {sortedJobs.length}
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={goToPrevJob}
            className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            aria-label="Previous job"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={goToNextJob}
            className="p-2 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            aria-label="Next job"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
