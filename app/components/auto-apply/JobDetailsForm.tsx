import React, { useState, useEffect } from 'react';
import { Briefcase, Building, FileText, Code } from 'lucide-react';

interface JobDetailsFormProps {
  selectedJob: any;
  onJobDataChange?: (jobData: any) => void;
}

/**
 * Job Details Form Component for Auto Apply
 * Displays job details and allows for editing
 */
const JobDetailsForm: React.FC<JobDetailsFormProps> = ({
  selectedJob,
  onJobDataChange
}) => {
  const [jobData, setJobData] = useState({
    title: '',
    company_name: '',
    description: '',
    skills: '',
    url: '',
    company_website: ''
  });

  // Initialize form with selected job data
  useEffect(() => {
    console.log('JobDetailsForm - selectedJob received:', selectedJob);
    
    if (selectedJob) {
      // Parse skills if they're in JSON string format
      let parsedSkills = selectedJob.skills;
      if (typeof selectedJob.skills === 'string' && selectedJob.skills.trim().startsWith('[')) {
        try {
          parsedSkills = JSON.parse(selectedJob.skills);
          parsedSkills = Array.isArray(parsedSkills) ? parsedSkills.join(', ') : selectedJob.skills;
        } catch (e) {
          console.error('Failed to parse skills JSON:', e);
        }
      }
      
      setJobData({
        title: selectedJob.title || selectedJob.job_title || '',
        company_name: selectedJob.company_name || selectedJob.company || '',
        description: selectedJob.description || selectedJob.job_description || '',
        skills: Array.isArray(parsedSkills) 
          ? parsedSkills.join(', ') 
          : typeof parsedSkills === 'string' ? parsedSkills : '',
        url: selectedJob.url || '',
        company_website: selectedJob.company_website || ''
      });
    }
  }, [selectedJob]);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedJobData = { ...jobData, [name]: value };
    setJobData(updatedJobData);
    
    if (onJobDataChange) {
      onJobDataChange(updatedJobData);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Job Details</h3>
      
      {selectedJob ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <Briefcase className="w-4 h-4 mr-1" />
              Job Title
            </label>
            <input
              type="text"
              name="title"
              value={jobData.title}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <Building className="w-4 h-4 mr-1" />
              Company
            </label>
            <input
              type="text"
              name="company_name"
              value={jobData.company_name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <FileText className="w-4 h-4 mr-1" />
              Job Description
            </label>
            <textarea
              name="description"
              value={jobData.description}
              onChange={handleChange}
              rows={6}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <Code className="w-4 h-4 mr-1" />
              Skills Required (comma separated)
            </label>
            <input
              type="text"
              name="skills"
              value={jobData.skills}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Website
            </label>
            <input
              type="text"
              name="company_website"
              value={jobData.company_website}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="https://company.com"
            />
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md text-yellow-800 dark:text-yellow-300 text-sm">
          <p className="font-medium">No job data found</p>
          <p>The job data could not be loaded from the URL parameters.</p>
          <p className="mt-2 text-xs">
            This usually happens when:
            <br />• The URL doesn't contain valid job data
            <br />• The job data parameter is malformed
            <br />• You navigated directly to this page without coming from a job listing
          </p>
          <p className="mt-2">
            <strong>Solution:</strong> Please go back to the job listings and select a job to apply for.
          </p>
        </div>
      )}
    </div>
  );
};

export default JobDetailsForm; 