import React from 'react';
import { ResumeData } from '../../types/resume';

interface TailoredResumeProps {
  generatedResume: ResumeData | null;
  tailoringNotes: string;
  isLoading: boolean;
  formatSkills: (skills: string | string[] | undefined) => string;
  onDownload: (format: 'pdf' | 'docx') => void;
}

/**
 * Tailored Resume Component
 * Displays the generated resume and provides download options
 */
const TailoredResume: React.FC<TailoredResumeProps> = ({
  generatedResume,
  tailoringNotes,
  isLoading,
  formatSkills,
  onDownload
}) => {
  if (!generatedResume) {
    return null;
  }

  return (
    <>
      {tailoringNotes && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Tailoring Notes</h3>
          <p className="text-yellow-700 dark:text-yellow-400 text-sm">{tailoringNotes}</p>
        </div>
      )}
      
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 bg-white dark:bg-gray-800 shadow-sm">
        <h3 className="font-semibold text-xl mb-3">{generatedResume.name}</h3>
        
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {generatedResume.contact.email} • {generatedResume.contact.phone} • {generatedResume.contact.location}
          {generatedResume.contact.linkedin && ` • ${generatedResume.contact.linkedin}`}
          {generatedResume.contact.website && ` • ${generatedResume.contact.website}`}
        </div>
        
        <div className="mb-4">
          <h4 className="font-semibold mb-1">Summary</h4>
          <p className="text-gray-700 dark:text-gray-300">{generatedResume.summary}</p>
        </div>
        
        <div className="mb-4">
          <h4 className="font-semibold mb-1">Skills</h4>
          <p className="text-gray-700 dark:text-gray-300">
            {generatedResume.skills && Array.isArray(generatedResume.skills) 
              ? generatedResume.skills.join(', ')
              : formatSkills(generatedResume.skills)}
          </p>
        </div>
        
        <div className="mb-4">
          <h4 className="font-semibold mb-2">Experience</h4>
          {generatedResume.experience.map((exp, index) => (
            <div key={index} className="mb-3">
              <div className="flex justify-between items-start">
                <div className="font-medium">{exp.title}</div>
                <div className="text-sm text-gray-500">{exp.dates}</div>
              </div>
              <div className="text-sm text-gray-600 italic">{exp.company}, {exp.location}</div>
              <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                {exp.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="preview-truncated text-center py-4 border-t border-dashed">
          <p className="text-gray-500">Resume preview is truncated. Download to see the full resume.</p>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
        <button
          onClick={() => onDownload('pdf')}
          disabled={isLoading}
          className={`${
            isLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'
          } text-white px-4 py-2 sm:px-6 sm:py-3 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
        >
          {isLoading ? 'Downloading...' : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download as PDF
            </>
          )}
        </button>
        
        <button
          onClick={() => onDownload('docx')}
          disabled={isLoading}
          className={`${
            isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
          } text-white px-4 py-2 sm:px-6 sm:py-3 border border-transparent rounded-md shadow-sm text-sm font-medium transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        >
          {isLoading ? 'Downloading...' : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download as DOCX
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default TailoredResume; 