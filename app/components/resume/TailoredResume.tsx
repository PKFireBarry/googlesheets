import React from 'react';
import { ResumeData } from '../../types/resume';
import { Download } from 'lucide-react';
import ActionButton from '../ActionButton';

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
        <ActionButton onClick={() => onDownload('pdf')} icon={Download} color="green" disabled={isLoading}>
          {isLoading ? 'Downloading...' : 'Download as PDF'}
        </ActionButton>
        <ActionButton onClick={() => onDownload('docx')} icon={Download} color="blue" disabled={isLoading}>
          {isLoading ? 'Downloading...' : 'Download as DOCX'}
        </ActionButton>
      </div>
    </>
  );
};

export default TailoredResume; 