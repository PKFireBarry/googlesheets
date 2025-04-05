"use client"

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { 
  MapPin, 
  Building, 
  Briefcase, 
  DollarSign, 
  Trash2, 
  CheckCircle,
  ExternalLink,
  Calendar,
  Globe,
  ChevronDown,
  ChevronUp,
  X,
  Linkedin,
  Link2,
  EyeOff,
  FileText,
  File,
  Bookmark
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { extractSourceFromUrl, formatDateSafely } from '../utils/dataHelpers'

interface JobData {
  id: string;
  company_name: string;
  company_website?: string;
  company_image?: string;
  title: string;
  description: string;
  url?: string;
  date_posted?: string;
  currentDate?: string;
  currentdate?: string;
  location?: string;
  job_type?: string;
  type?: string;
  skills?: string;
  salary?: string;
  experience?: string;
  source?: string;
}

interface JobCardProps {
  job: JobData;
  isApplied: boolean;
  onApply: () => void;
  onDelete: () => void;
  onHide?: () => void;
}

// Helper to create tag elements
const Tag = ({ text, icon: Icon }: { text: string | undefined | null, icon?: React.ElementType }) => {
  if (!text) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/70 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
      {Icon && <Icon className="w-3.5 h-3.5 mr-1" />}
      {text}
    </span>
  );
};

export default function JobCard({ 
  job, 
  isApplied, 
  onApply, 
  onDelete, 
  onHide,
}: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState(job.company_image || '')
  const router = useRouter()
  
  // Log image URL on component mount for debugging
  useEffect(() => {
    if (job.company_image) {
      console.log(`Loading company image for ${job.company_name}:`, job.company_image);
    }
  }, [job.company_name, job.company_image]);

  // Simple image error handler - just show the fallback if image fails to load
  const handleImageError = () => {
    console.log(`Image loading error for ${job.company_name}`);
    setImageError(true);
  };
  
  const truncateDescription = (text: string, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }
  
  const handleLinkedInLookup = () => {
    const companyName = job.company_name
    if (companyName) {
      // Save this job to localStorage before navigating
      try {
        const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '{}');
        savedJobs[job.id] = job;
        localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
        console.log(`Saved job data for ${job.id} to localStorage for LinkedIn lookup`);
      } catch (error) {
        console.error('Error saving job data to localStorage:', error);
      }
      
      // Pass company name and job ID to the LinkedIn lookup page
      router.push(`/linkedin-lookup?company=${encodeURIComponent(companyName)}&jobId=${encodeURIComponent(job.id)}`);
    }
  }
  
  const getJobSource = (): string => {
    if (job.source) return job.source;
    
    const url = job.company_website || job.url || '';
    if (!url) return 'Unknown';
    
    return extractSourceFromUrl(url);
  }
    
  const handleCreateResume = () => {
    // Create the query parameters with job ID
    const params = new URLSearchParams();
    if (job.id) {
      params.set('jobId', job.id);
    }
    
    // Navigate to the resume builder with job data
    window.location.href = `/resume-builder?${params.toString()}`;
  };

  const toggleDetails = () => setShowDetails(!showDetails);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all hover:shadow-xl flex flex-col">
      {/* Top Section - Mimicking the image style */}
      <div className="p-5 sm:p-6 bg-orange-50 dark:bg-gray-800/50 relative">
        {/* Date and Bookmark */}
        <div className="flex justify-between items-center mb-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            {formatDateSafely(job.date_posted || job.currentDate || job.currentdate)}
          </span>
        </div>

        {/* Company, Title, Logo */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{job.company_name}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white line-clamp-2">{job.title}</h2>
          </div>
          <div className="flex-shrink-0">
            {!imageError ? (
              <div className="w-24 h-24 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center">
                <Image
                  src={imageSrc}
                  alt={`${job.company_name} logo`}
                  width={56}
                  height={56}
                  className="object-contain w-full h-full"
                  unoptimized={true}
                  onError={handleImageError}
                />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <Building className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <Tag text={job.job_type || job.type} icon={Briefcase} />
          <Tag text={job.experience} />
          <Tag text={getJobSource()} icon={Link2} />
        </div>
      </div>

      {/* Description - Now always visible */}
      <div className="p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700">
        {/* Description */}
        <div className="mb-5">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">Description</h3>
          <div className="text-gray-600 dark:text-gray-400 text-sm prose dark:prose-invert max-w-none">
            {showFullDescription ? (
              <>
                <div className="whitespace-pre-line">{job.description}</div>
                <button 
                  onClick={() => setShowFullDescription(false)}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm flex items-center"
                >
                  Show Less <ChevronUp className="w-4 h-4 ml-1" />
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
                    Show More <ChevronDown className="w-4 h-4 ml-1" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Skills - Now always visible */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">Skills</h3>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {job.skills ? 
              job.skills.split(',')
                .filter((skill): skill is string => Boolean(skill))
                .map((skill, index) => {
                  const cleanedSkill = skill.replace(/[\[\]"'{}]/g, '').trim();
                  if (!cleanedSkill) return null;
                  return (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {cleanedSkill}
                    </span>
                  );
                })
              : (
                <span className="text-sm text-gray-500 dark:text-gray-400">No skills listed for this position</span>
              )
            }
          </div>
        </div>
      </div>

      {/* Bottom Section with salary, location and details button */}
      <div className="p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          {job.salary && (
            <p className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
              {job.salary.includes('/') ? job.salary : `$${job.salary}`}
            </p>
          )}
          {job.location && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0" />
              <span>{job.location}</span>
            </div>
          )}
        </div>
        <button 
          onClick={toggleDetails}
          className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold 
                   bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 
                   hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors shadow-md"
        >
          Actions
          {showDetails ? <ChevronUp className="w-4 h-4 ml-1.5" /> : <ChevronDown className="w-4 h-4 ml-1.5" />}
        </button>
      </div>

      {/* Collapsible Actions Section */}
      {showDetails && (
        <div className="p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 animate-fade-in">
          {/* Applied Status Button (Simplified) */} 
          <div className="mb-4">
            {isApplied ? (
              <button
                onClick={onApply}
                className="inline-flex items-center w-full justify-center px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-800 dark:hover:text-red-400 transition-colors group border border-green-200 dark:border-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2 group-hover:hidden" />
                <X className="w-4 h-4 mr-2 hidden group-hover:block" />
                <span className="group-hover:hidden">Applied</span>
                <span className="hidden group-hover:block">Mark as Not Applied</span>
              </button>
            ) : (
              <button 
                onClick={onApply}
                className="inline-flex items-center w-full justify-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark as Applied
              </button>
            )}
          </div>
          
          {/* Action Buttons */} 
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Actions</h3>
            
            {/* Primary Actions */} 
            <div className="flex flex-col sm:flex-row gap-2">
              {job.url && (
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg 
                           bg-blue-600 hover:bg-blue-700 text-white
                           transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Job
                </a>
              )}
              {job.company_website && (
                <a 
                  href={job.company_website.startsWith('http') ? job.company_website : `https://${job.company_website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                           border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                           text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600
                           transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Company Site
                </a>
              )}
            </div>

            {/* Document & Network Actions (Combined Row) */} 
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleCreateResume}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                         border border-green-600 dark:border-green-500 bg-white dark:bg-gray-700
                         text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20
                         transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <File className="w-4 h-4 mr-2" />
                Resume
              </button>
              <button
                onClick={() => router.push(`/cover-letter?jobId=${encodeURIComponent(job.id)}`)}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                         border border-purple-600 dark:border-purple-500 bg-white dark:bg-gray-700
                         text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20
                         transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <FileText className="w-4 h-4 mr-2" />
                Cover Letter
              </button>
              <button
                onClick={handleLinkedInLookup}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                         border border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700
                         text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                         transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Linkedin className="w-4 h-4 mr-2" />
                Recruiter
              </button>
            </div>

            {/* Management Actions */} 
            <div className="flex flex-col sm:flex-row gap-2">
              {onHide && (
                <button
                  onClick={onHide}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                           border border-amber-600 dark:border-amber-500 bg-white dark:bg-gray-700
                           text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20
                           transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Job
                </button>
              )}
              <button
                onClick={onDelete}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg
                         border border-red-600 dark:border-red-500 bg-white dark:bg-gray-700
                         text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                         transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
