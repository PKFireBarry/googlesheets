import React from 'react';
import { Building, Briefcase, MapPin, Edit3, Save } from 'lucide-react';

interface JobDetailsFormProps {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  skills: string;
  location: string;
  jobDetailsEditable: boolean;
  onJobTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCompanyNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJobDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSkillsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleEdit: () => void;
  onSaveJobDetails: () => void;
}

/**
 * Job Details Form Component for Cover Letter
 * Allows editing and displaying job details
 */
const JobDetailsForm: React.FC<JobDetailsFormProps> = ({
  jobTitle,
  companyName,
  jobDescription,
  skills,
  location,
  jobDetailsEditable,
  onJobTitleChange,
  onCompanyNameChange,
  onJobDescriptionChange,
  onSkillsChange,
  onLocationChange,
  onToggleEdit,
  onSaveJobDetails,
}) => {
  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <Briefcase className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
          Job Details
        </h3>
        
        {!jobDetailsEditable && (
          <button
            onClick={onToggleEdit}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
          >
            <Edit3 className="w-3 h-3 mr-1" /> Edit Job Details
          </button>
        )}
      </div>
      
      {jobDetailsEditable ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={onJobTitleChange}
                placeholder="Software Engineer"
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={onCompanyNameChange}
                placeholder="Acme Inc."
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={onLocationChange}
                placeholder="New York, NY or Remote"
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skills
              </label>
              <input
                type="text"
                value={skills}
                onChange={onSkillsChange}
                placeholder="React, TypeScript, Node.js"
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={onJobDescriptionChange}
              placeholder="Paste the job description here..."
              rows={6}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          
          {jobDetailsEditable && (
            <div className="flex justify-end">
              <button
                onClick={onSaveJobDetails}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={!jobTitle || !companyName || !jobDescription}
              >
                <Save className="w-4 h-4 mr-1" /> Save Job Details
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start">
              <Building className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</p>
                <p className="text-base text-gray-900 dark:text-white">{companyName}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Briefcase className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Position</p>
                <p className="text-base text-gray-900 dark:text-white">{jobTitle}</p>
              </div>
            </div>
            
            {location && (
              <div className="flex items-start">
                <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</p>
                  <p className="text-base text-gray-900 dark:text-white">{location}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Job Description</p>
            <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-750 p-3 rounded border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
              <p className="whitespace-pre-line">{jobDescription}</p>
            </div>
          </div>
          
          {skills && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Required Skills</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {skills.split(',').map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {skill.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobDetailsForm; 