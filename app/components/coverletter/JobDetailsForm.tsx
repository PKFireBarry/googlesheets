import React from 'react';
import { Building, Briefcase, MapPin, Edit3, Save, Target } from 'lucide-react';

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
    <div className="p-6 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-800/30">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Job Details
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Information about the position you're applying for
            </p>
          </div>
        </div>
        
        {!jobDetailsEditable && (
          <button
            onClick={onToggleEdit}
            className="group inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Edit3 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
            Edit Details
          </button>
        )}
      </div>
      
      {jobDetailsEditable ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Job Title *
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={jobTitle}
                  onChange={onJobTitleChange}
                  placeholder="Software Engineer"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Company Name *
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={companyName}
                  onChange={onCompanyNameChange}
                  placeholder="Acme Inc."
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={onLocationChange}
                  placeholder="New York, NY or Remote"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Key Skills
              </label>
              <input
                type="text"
                value={skills}
                onChange={onSkillsChange}
                placeholder="React, TypeScript, Node.js"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={onJobDescriptionChange}
              placeholder="Paste the job description here..."
              rows={6}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none"
              required
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Copy and paste the complete job posting for best results
            </p>
          </div>
          
          {jobDetailsEditable && (
            <div className="flex justify-end pt-4">
              <button
                onClick={onSaveJobDetails}
                className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                disabled={!jobTitle || !companyName || !jobDescription}
              >
                <Save className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Save Job Details
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                  <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Company</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{companyName}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Position</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{jobTitle}</p>
                </div>
              </div>
            </div>
            
            {location && (
              <div className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Location</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{location}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Job Description
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {jobDescription}
              </p>
            </div>
          </div>
          
          {skills && (
            <div className="bg-white dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3 flex items-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-2">
                {skills.split(',').map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-300 dark:border-blue-700"
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