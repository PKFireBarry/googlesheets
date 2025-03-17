"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  MapPin, 
  Building, 
  Clock, 
  Briefcase, 
  DollarSign, 
  Trash2, 
  CheckCircle,
  MessageSquare,
  ExternalLink,
  Calendar,
  Globe,
  ChevronRight,
  X,
  Linkedin,
  Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface JobCardProps {
  job: {
    title: string;
    company_name: string;
    location: string;
    job_type: string;
    type: string;
    salary: string;
    date_posted: string;
    currentDate: string;
    description: string;
    url: string;
    company_website: string;
    company_image: string;
    experience: string;
    skills: string;
    notes: string;
    id: string;
    [key: string]: string; // Allow for additional fields
  };
  isApplied: boolean;
  onApply: () => void;
  onDelete: () => void;
  onUpdateNote: (note: string) => void;
}

export default function JobCard({ 
  job, 
  isApplied, 
  onApply, 
  onDelete, 
  onUpdateNote 
}: JobCardProps) {
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(job.notes || '')
  const [showSkills, setShowSkills] = useState(false)
  const [imageError, setImageError] = useState(false)
  const router = useRouter()
  
  // Log job data for debugging
  useEffect(() => {
    console.log("Job data in JobCard:", job);
  }, [job]);
  
  const truncateDescription = (text: string, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }
  
  const handleNoteSubmit = () => {
    onUpdateNote(noteText)
    setIsEditingNote(false)
  }
  
  const handleLinkedInLookup = () => {
    // Store the company name in a cookie for the LinkedIn lookup page
    const companyName = job.company_name
    if (companyName) {
      // Navigate to the LinkedIn lookup page
      router.push(`/linkedin-lookup?company=${encodeURIComponent(companyName)}`)
    }
  }
  
  const formatDate = (dateString: string) => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl">
      {/* Status indicator */}
      <div className={`h-1.5 w-full ${isApplied ? 'bg-green-500' : 'bg-blue-500'}`}></div>
      
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-5">
          <div className="flex gap-4">
            {job.company_image && !imageError ? (
              <div className="flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white">
                <Image
                  src={job.company_image}
                  alt={`${job.company_name} logo`}
                  width={56}
                  height={56}
                  className="object-contain"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <Building className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">{job.title}</h2>
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Building className="w-4 h-4 mr-1.5 flex-shrink-0" />
                <span className="font-medium">{job.company_name}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
            {isApplied ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Applied
              </span>
            ) : (
              <button 
                onClick={onApply}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Mark Applied
              </button>
            )}
            
            {job.job_type && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                <Briefcase className="w-3.5 h-3.5 mr-1" />
                {job.job_type}
              </span>
            )}
            
            {job.type && !job.job_type && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                <Briefcase className="w-3.5 h-3.5 mr-1" />
                {job.type}
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {job.location && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
              <span>{job.location}</span>
            </div>
          )}
          
          {job.salary && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <DollarSign className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
              <span>{job.salary}</span>
            </div>
          )}
          
          {job.experience && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Briefcase className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
              <span>{job.experience}</span>
            </div>
          )}
          
          {(job.date_posted || job.currentDate) && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-500 flex-shrink-0" />
              <span>Posted: {formatDate(job.date_posted || job.currentDate)}</span>
            </div>
          )}
        </div>
        
        {/* HR Lookup Actions */}
        <div className="flex flex-wrap gap-2 mt-4 mb-4 border-t border-b border-gray-100 dark:border-gray-700 py-3">
          <button
            onClick={handleLinkedInLookup}
            className="inline-flex items-center px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            <Linkedin className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
            LinkedIn Lookup
          </button>
        </div>
        
        {/* Description */}
        <div className="mb-5">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Description</h3>
          <div className="text-gray-600 dark:text-gray-400 text-sm">
            {showFullDescription ? (
              <>
                <div className="whitespace-pre-line">{job.description}</div>
                <button 
                  onClick={() => setShowFullDescription(false)}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
                >
                  Show Less
                </button>
              </>
            ) : (
              <>
                <div className="whitespace-pre-line">{truncateDescription(job.description)}</div>
                {job.description && job.description.length > 150 && (
                  <button 
                    onClick={() => setShowFullDescription(true)}
                    className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
                  >
                    Show More <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Skills */}
        {job.skills && (
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Skills</h3>
              <button 
                onClick={() => setShowSkills(!showSkills)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
              >
                {showSkills ? 'Hide' : 'Show'} <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${showSkills ? 'rotate-90' : ''}`} />
              </button>
            </div>
            
            {showSkills && (
              <div className="flex flex-wrap gap-2 mt-2">
                {job.skills.split(',').map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {skill.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Notes */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">Notes</h3>
            {!isEditingNote && (
              <button 
                onClick={() => setIsEditingNote(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
              >
                {job.notes ? 'Edit' : 'Add'} <MessageSquare className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
          
          {isEditingNote ? (
            <div className="mt-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                rows={3}
                placeholder="Add your notes here..."
              />
              <div className="flex justify-end mt-2 space-x-2">
                <button 
                  onClick={() => setIsEditingNote(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </button>
                <button 
                  onClick={handleNoteSubmit}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-400 text-sm">
              {job.notes ? (
                <div className="whitespace-pre-line">{job.notes}</div>
              ) : (
                <p className="italic text-gray-500 dark:text-gray-500">No notes added yet</p>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-5">
          {job.url && (
            <a 
              href={job.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ExternalLink className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
              View Job
            </a>
          )}
          
          {job.company_website && (
            <a 
              href={job.company_website.startsWith('http') ? job.company_website : `https://${job.company_website}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Globe className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
              Company Site
            </a>
          )}
          
          <button
            onClick={onDelete}
            className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-800 rounded-md text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 ml-auto"
          >
            <Trash2 className="w-4 h-4 mr-2 text-red-500 dark:text-red-400" />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}
