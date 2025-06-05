import React, { useRef, useState } from 'react';
import { ResumeData, PersonalInfo } from '../../types/resume';
import { parseResumeFile } from '../../utils/resumeParser';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ResumeUploadProps {
  onUploadResume?: (resumeData: ResumeData) => void;
  onUploadPdf?: (pdfData: string) => void;
  onNext?: () => void;
  hasExistingResume?: boolean;
  personalInfo?: PersonalInfo;
  onPersonalInfoChange?: (info: PersonalInfo) => void;
}

type SectionName = 'basic' | 'salary' | 'workEligibility' | 'military' | 'disability' | 'eeo' | 'additional';

/**
 * Resume Upload Component for Auto Apply
 * Handles uploading and managing resume files
 */
const ResumeUpload: React.FC<ResumeUploadProps> = ({
  onUploadResume,
  onUploadPdf,
  onNext,
  hasExistingResume,
  personalInfo,
  onPersonalInfoChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    salary: false,
    workEligibility: false,
    military: false,
    disability: false,
    eeo: false,
    additional: false
  });

  const toggleSection = (section: SectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Process the file based on its type
      if (file.type === 'application/pdf') {
        // Handle PDF file
        const reader = new FileReader();
        reader.onload = (e) => {
          const pdfData = e.target?.result as string;
          if (onUploadPdf) {
            onUploadPdf(pdfData);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Parse resume data from DOCX or other formats
        const resumeData = await parseResumeFile(file);
        if (onUploadResume) {
          onUploadResume(resumeData);
        }
      }

      // Move to next step if provided
      if (onNext) {
        onNext();
      }
    } catch (error) {
      console.error('Error processing resume file:', error);
      // Handle error
    }
  };

  const handlePersonalInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!personalInfo || !onPersonalInfoChange) return;
    
    const { name, value, type } = e.target as HTMLInputElement;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    onPersonalInfoChange({
      ...personalInfo,
      [name]: newValue
    });
  };

  const SectionHeader = ({ title, expanded, onClick }: { title: string; expanded: boolean; onClick: () => void }) => (
    <div 
      className="flex items-center justify-between py-2 px-1 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
      onClick={onClick}
    >
      <h4 className="font-medium">{title}</h4>
      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Upload Your Resume</h3>
      
      {hasExistingResume ? (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-green-800 dark:text-green-300 text-sm flex items-start mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Resume Already Loaded</p>
            <p>Your resume is already loaded. You can continue to the next step or upload a new one.</p>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <div className="flex flex-col items-center justify-center py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h4 className="text-lg font-medium mb-2">Upload Your Resume</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your resume to get started with the auto-apply process.
            </p>
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Select Resume File
            </label>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Supported formats: PDF (recommended), DOCX
            </p>
          </div>
        </div>
      )}
      
      {/* Personal Information Section */}
      {personalInfo && onPersonalInfoChange && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Personal Information</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This information will be used for your job applications. Fields marked with * are commonly required.
          </p>
          
          {/* Basic Information */}
          <div className="mb-6">
            <SectionHeader 
              title="Basic Information" 
              expanded={expandedSections.basic} 
              onClick={() => toggleSection('basic' as SectionName)} 
            />
            
            {expandedSections.basic && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={personalInfo.name || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={personalInfo.email || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={personalInfo.phone || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={personalInfo.location || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    LinkedIn
                  </label>
                  <input
                    type="text"
                    name="linkedin"
                    value={personalInfo.linkedin || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    name="website"
                    value={personalInfo.website || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Salary Expectations */}
          <div className="mb-6">
            <SectionHeader 
              title="Salary Expectations" 
              expanded={expandedSections.salary} 
              onClick={() => toggleSection('salary' as SectionName)} 
            />
            
            {expandedSections.salary && (
              <div className="mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Salary Expectations
                  </label>
                  <input
                    type="text"
                    name="salaryExpectations"
                    value={personalInfo.salaryExpectations || ''}
                    onChange={handlePersonalInfoChange}
                    placeholder="e.g., $80,000 - $100,000 per year"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Many applications ask for salary expectations. Providing a range is often recommended.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Work Eligibility */}
          <div className="mb-6">
            <SectionHeader 
              title="Work Eligibility" 
              expanded={expandedSections.workEligibility} 
              onClick={() => toggleSection('workEligibility' as SectionName)} 
            />
            
            {expandedSections.workEligibility && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Work Authorization Status
                  </label>
                  <select
                    name="workAuthorization"
                    value={personalInfo.workAuthorization || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="US Citizen">US Citizen</option>
                    <option value="Permanent Resident">Permanent Resident (Green Card)</option>
                    <option value="Work Visa">Work Visa Holder</option>
                    <option value="EAD">Employment Authorization Document</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="flex items-center mt-6">
                  <input
                    type="checkbox"
                    id="requireSponsorship"
                    name="requireSponsorship"
                    checked={personalInfo.requireSponsorship || false}
                    onChange={handlePersonalInfoChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="requireSponsorship" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Will you require sponsorship now or in the future?
                  </label>
                </div>
              </div>
            )}
          </div>
          
          {/* Military Status */}
          <div className="mb-6">
            <SectionHeader 
              title="Military Status" 
              expanded={expandedSections.military} 
              onClick={() => toggleSection('military' as SectionName)} 
            />
            
            {expandedSections.military && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Military Status
                  </label>
                  <select
                    name="militaryStatus"
                    value={personalInfo.militaryStatus || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="None">No Military Service</option>
                    <option value="Active">Active Duty</option>
                    <option value="Reserve">Reserve</option>
                    <option value="Veteran">Veteran</option>
                    <option value="Retired">Retired Military</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Veteran Status
                  </label>
                  <select
                    name="veteranStatus"
                    value={personalInfo.veteranStatus || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="Not a Veteran">Not a Veteran</option>
                    <option value="Protected Veteran">Protected Veteran</option>
                    <option value="Disabled Veteran">Disabled Veteran</option>
                    <option value="Recently Separated Veteran">Recently Separated Veteran</option>
                    <option value="Active Wartime Veteran">Active Wartime Veteran</option>
                    <option value="Prefer Not to Answer">Prefer Not to Answer</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Disability Status */}
          <div className="mb-6">
            <SectionHeader 
              title="Disability Status" 
              expanded={expandedSections.disability} 
              onClick={() => toggleSection('disability' as SectionName)} 
            />
            
            {expandedSections.disability && (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Disability Status
                  </label>
                  <select
                    name="disabilityStatus"
                    value={personalInfo.disabilityStatus || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="No">No, I don't have a disability</option>
                    <option value="Yes">Yes, I have a disability</option>
                    <option value="Prefer Not to Answer">Prefer Not to Answer</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Accommodations Needed
                  </label>
                  <textarea
                    name="accommodationsNeeded"
                    value={personalInfo.accommodationsNeeded || ''}
                    onChange={handlePersonalInfoChange}
                    placeholder="If you require any accommodations, please describe them here"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Equal Opportunity Information */}
          <div className="mb-6">
            <SectionHeader 
              title="Equal Opportunity Information" 
              expanded={expandedSections.eeo} 
              onClick={() => toggleSection('eeo' as SectionName)} 
            />
            
            {expandedSections.eeo && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={personalInfo.gender || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Self Identify">Self Identify</option>
                    <option value="Prefer Not to Answer">Prefer Not to Answer</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ethnicity
                  </label>
                  <select
                    name="ethnicity"
                    value={personalInfo.ethnicity || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="White">White</option>
                    <option value="Black or African American">Black or African American</option>
                    <option value="Hispanic or Latino">Hispanic or Latino</option>
                    <option value="Asian">Asian</option>
                    <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                    <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                    <option value="Two or More Races">Two or More Races</option>
                    <option value="Prefer Not to Answer">Prefer Not to Answer</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Additional Questions */}
          <div className="mb-6">
            <SectionHeader 
              title="Additional Questions" 
              expanded={expandedSections.additional} 
              onClick={() => toggleSection('additional' as SectionName)} 
            />
            
            {expandedSections.additional && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="willingToRelocate"
                    name="willingToRelocate"
                    checked={personalInfo.willingToRelocate || false}
                    onChange={handlePersonalInfoChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="willingToRelocate" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Willing to relocate?
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Remote Work Preference
                  </label>
                  <select
                    name="remoteWorkPreference"
                    value={personalInfo.remoteWorkPreference || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select an option</option>
                    <option value="Fully Remote">Fully Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Available Start Date
                  </label>
                  <input
                    type="date"
                    name="availableStartDate"
                    value={personalInfo.availableStartDate || ''}
                    onChange={handlePersonalInfoChange}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Referral Source
                  </label>
                  <input
                    type="text"
                    name="referralSource"
                    value={personalInfo.referralSource || ''}
                    onChange={handlePersonalInfoChange}
                    placeholder="How did you hear about this position?"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="previouslyEmployed"
                      name="previouslyEmployed"
                      checked={personalInfo.previouslyEmployed || false}
                      onChange={handlePersonalInfoChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="previouslyEmployed" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Previously employed at this company?
                    </label>
                  </div>
                  
                  {personalInfo.previouslyEmployed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Previous Employment Details
                      </label>
                      <textarea
                        name="previousEmploymentDetails"
                        value={personalInfo.previousEmploymentDetails || ''}
                        onChange={handlePersonalInfoChange}
                        placeholder="Please provide details about your previous employment with this company"
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Next Button */}
      {onNext && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onNext}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Continue to Job Details
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload; 