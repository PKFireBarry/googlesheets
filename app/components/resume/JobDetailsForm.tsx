import React from 'react';

interface JobData {
  title: string;
  description: string;
  skills: string;
  company: string;
}

interface JobDetailsFormProps {
  manualJobData: JobData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  selectedJob: any;
  formatSkills: (skills: string | string[] | undefined) => string;
}

/**
 * Job Details Form Component
 * Allows users to manually enter job details for resume tailoring
 */
const JobDetailsForm: React.FC<JobDetailsFormProps> = ({
  manualJobData,
  onChange,
  onSubmit,
  selectedJob,
  formatSkills
}) => {
  return (
    <div className="space-y-6">
      <p className="text-gray-600 dark:text-gray-300 mb-6 text-mobile-sm">
        Enter the details of the job you're applying for to create a tailored resume.
      </p>
      
      {selectedJob && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Selected Job</h3>
          <div className="text-blue-700 dark:text-blue-300 space-y-2">
            <p className="font-medium">{selectedJob.title || selectedJob.job_title} at {selectedJob.company_name || selectedJob.company}</p>
            
            {(selectedJob.description || selectedJob.job_description) && (
              <div className="mt-2">
                <p className="text-sm font-medium">Description:</p>
                <p className="text-sm">{selectedJob.description || selectedJob.job_description}</p>
              </div>
            )}
            
            {selectedJob.requirements && selectedJob.requirements.trim() !== '' && (
              <div className="mt-2">
                <p className="text-sm font-medium">Requirements:</p>
                <p className="text-sm">{selectedJob.requirements}</p>
              </div>
            )}
            
            {selectedJob.skills && (
              <div className="mt-2">
                <p className="text-sm font-medium">Skills:</p>
                <p className="text-sm">
                  {formatSkills(selectedJob.skills)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!selectedJob && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300">Enter Job Details</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                id="jobTitle"
                name="title"
                value={manualJobData.title}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Senior Software Engineer"
                required
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={manualJobData.company}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                placeholder="e.g., Google"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Job Description
              </label>
              <textarea
                id="description"
                name="description"
                value={manualJobData.description}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                rows={4}
                placeholder="Paste the job description here..."
              />
            </div>

            <div>
              <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-1">
                Skills
              </label>
              <textarea
                id="skills"
                name="skills"
                value={manualJobData.skills}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                rows={2}
                placeholder="JavaScript, React, TypeScript, etc."
              />
              <p className="text-xs text-gray-500 mt-1">Separate skills with commas</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onSubmit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Save Job Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailsForm; 