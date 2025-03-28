import React from 'react';
import Cookies from 'js-cookie';
import { toast } from 'react-hot-toast';

interface ResumeData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
  certifications?: string;
  projects?: string;
}

interface ResumeFormProps {
  resumeData: ResumeData;
  onChangeResumeData: (data: ResumeData) => void;
  onSave: () => void;
}

const ResumeForm: React.FC<ResumeFormProps> = ({ resumeData, onChangeResumeData, onSave }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChangeResumeData({
      ...resumeData,
      [name]: value
    });
  };

  return (
    <div className="space-y-4 mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Enter Your Resume Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Personal Info */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            name="fullName"
            value={resumeData.fullName}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="John Doe"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={resumeData.email}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="john.doe@example.com"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone
          </label>
          <input
            type="text"
            name="phone"
            value={resumeData.phone}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="(123) 456-7890"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location
          </label>
          <input
            type="text"
            name="location"
            value={resumeData.location}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="City, State"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Website/Portfolio (Optional)
          </label>
          <input
            type="text"
            name="website"
            value={resumeData.website}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="https://yourportfolio.com"
          />
        </div>
      </div>
      
      {/* Longer Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Professional Summary
          </label>
          <textarea
            name="summary"
            value={resumeData.summary}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="Briefly describe your professional background and strengths..."
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Work Experience
          </label>
          <textarea
            name="experience"
            value={resumeData.experience}
            onChange={handleChange}
            rows={4}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="List your relevant work experience (include job titles, companies, dates, and accomplishments)..."
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Education
          </label>
          <textarea
            name="education"
            value={resumeData.education}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="List your degrees, schools, and graduation dates..."
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Skills
          </label>
          <textarea
            name="skills"
            value={resumeData.skills}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="List your technical and soft skills..."
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Certifications (Optional)
          </label>
          <textarea
            name="certifications"
            value={resumeData.certifications}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="List any relevant certifications or licenses..."
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Projects (Optional)
          </label>
          <textarea
            name="projects"
            value={resumeData.projects}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="Describe key projects that showcase your skills..."
          />
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Resume Data
        </button>
      </div>
    </div>
  );
};

// Helper functions for working with resume data
export const getInitialResumeData = (): ResumeData => {
  try {
    const savedData = Cookies.get("resumeData");
    return savedData ? JSON.parse(savedData) : {
      fullName: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
      experience: "",
      education: "",
      skills: "",
      certifications: "",
      projects: ""
    };
  } catch (e) {
    console.error("Error loading resume data from cookies:", e);
    return {
      fullName: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
      experience: "",
      education: "",
      skills: "",
      certifications: "",
      projects: ""
    };
  }
};

export const generateResumeText = (resumeData: ResumeData): string => {
  try {
    let resumeText = `${resumeData.fullName || "Applicant Name"}\n`;
    resumeText += `${resumeData.email || "email@example.com"}${resumeData.phone ? ` | ${resumeData.phone}` : ""}\n`;
    resumeText += `${resumeData.location || "Location"}${resumeData.website ? ` | ${resumeData.website}` : ""}\n\n`;
    
    // Summary
    if (resumeData.summary) {
      resumeText += `PROFESSIONAL SUMMARY\n${resumeData.summary}\n\n`;
    }
    
    // Experience
    if (resumeData.experience) {
      resumeText += `PROFESSIONAL EXPERIENCE\n${resumeData.experience}\n\n`;
    }
    
    // Education
    if (resumeData.education) {
      resumeText += `EDUCATION\n${resumeData.education}\n\n`;
    }
    
    // Skills
    if (resumeData.skills) {
      resumeText += `SKILLS\n${resumeData.skills}\n\n`;
    }
    
    // Certifications
    if (resumeData.certifications) {
      resumeText += `CERTIFICATIONS\n${resumeData.certifications}\n\n`;
    }
    
    // Projects
    if (resumeData.projects) {
      resumeText += `PROJECTS\n${resumeData.projects}\n\n`;
    }
    
    return resumeText;
  } catch (error) {
    console.error("Error generating resume text:", error);
    return "";
  }
};

export const saveResumeData = (resumeData: ResumeData, callback?: (text: string) => void) => {
  try {
    // Convert resume data to formatted text
    const formattedText = generateResumeText(resumeData);
    
    // Save resume data to cookies (expires in 30 days)
    Cookies.set("resumeData", JSON.stringify(resumeData), { expires: 30 });
    
    toast.success("Resume information saved");
    
    if (callback) {
      callback(formattedText);
    }
    
    return formattedText;
  } catch (error) {
    console.error("Error saving resume data:", error);
    toast.error("Failed to save resume data");
    return "";
  }
};

export default ResumeForm; 