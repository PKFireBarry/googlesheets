import React, { useState } from 'react';
import { 
  Briefcase, Building, MapPin, DollarSign, 
  Clock, Sparkles, MessageSquare,
  ExternalLink, Loader2, Linkedin, ChevronDown, ChevronUp
} from 'lucide-react';
import ActionButton from '../ActionButton';

interface JobDetailsProps {
  job: Record<string, unknown>;
  getJobValue: (job: Record<string, unknown> | null, keys: string[]) => string;
  getSkillsArray: (job: Record<string, unknown> | null) => string[];
  isSearching: boolean;
  onSearch: () => void;
}

// Define a threshold for description length to trigger truncation
const DESCRIPTION_THRESHOLD = 300; // Example: 300 characters

/**
 * Job Details Component
 * Displays comprehensive information about a selected job
 */
const JobDetails: React.FC<JobDetailsProps> = ({
  job,
  getJobValue,
  getSkillsArray,
  isSearching,
  onSearch
}) => {
  // State for description expansion
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const fullDescription = getJobValue(job, ['description']);
  const shouldTruncate = fullDescription.length > DESCRIPTION_THRESHOLD;

  return (
    <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
          <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Selected Job Details
        </h2>
      </div>
      
      <div className="space-y-5">
        {/* Job Header - Title, Company, Logo, Links/Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center shadow-sm">
              {job.company_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={typeof job.company_image === 'string' ? job.company_image : ''} 
                  alt={`${getJobValue(job, ['company_name', 'company'])} logo`}
                  className="w-full h-full object-contain p-1 rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Building className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">
                {getJobValue(job, ['title', 'job_title'])}
              </h2>
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <Building className="w-4 h-4 mr-1.5 flex-shrink-0" />
                <span className="font-medium">{getJobValue(job, ['company_name', 'company'])}</span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            {getJobValue(job, ['url']) && (
              <a
                href={getJobValue(job, ['url'])}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-5 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Job Posting
              </a>
            )}
            
            <ActionButton
              onClick={onSearch}
              disabled={isSearching}
              color={isSearching ? "gray" : "green"}
              icon={isSearching ? Loader2 : Linkedin}
              className={isSearching ? "animate-spin" : ""}
            >
              {isSearching ? "Searching..." : "Find HR Contacts"}
            </ActionButton>
          </div>
        </div>
        
        {/* Job Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {getJobValue(job, ['location']) && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <MapPin className="w-5 h-5 mr-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span>{getJobValue(job, ['location'])}</span>
            </div>
          )}
          
          {getJobValue(job, ['salary']) && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <DollarSign className="w-5 h-5 mr-3 text-green-500 dark:text-green-400 flex-shrink-0" />
              <span>{getJobValue(job, ['salary'])}</span>
            </div>
          )}
          
          {getJobValue(job, ['experience']) && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <Briefcase className="w-5 h-5 mr-3 text-purple-500 dark:text-purple-400 flex-shrink-0" />
              <span>{getJobValue(job, ['experience'])}</span>
            </div>
          )}
          
          {getJobValue(job, ['job_type', 'type']) && (
            <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <Clock className="w-5 h-5 mr-3 text-orange-500 dark:text-orange-400 flex-shrink-0" />
              <span>{getJobValue(job, ['job_type', 'type'])}</span>
            </div>
          )}
        </div>
        
        {/* Skills and Description */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {getSkillsArray(job).length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-yellow-500 dark:text-yellow-400" />
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {getSkillsArray(job).map((skill, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {getJobValue(job, ['description']) && (
            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
                Description
              </h4>
              {/* Description container with conditional max-height */}
              <div 
                className={`text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ease-in-out ${!isDescriptionExpanded && shouldTruncate ? 'max-h-24' : 'max-h-none'}`}
              >
                {fullDescription}
              </div>
              {/* Toggle Button */}  
              {shouldTruncate && (
                <button
                  className="text-blue-600 dark:text-blue-400 text-xs mt-2 hover:underline flex items-center"
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                >
                  {isDescriptionExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 mr-1" />
                      Show More
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetails; 