import React, { useState } from 'react';
import { ResumeData, ExperienceEntry, ProjectEntry, EducationEntry, CertificationEntry } from '../../types/resume';

interface ResumeEditorProps {
  generatedResume: ResumeData | null;
  onSaveChanges: (updatedResume: ResumeData) => void;
  isLoading: boolean;
}

/**
 * Resume Editor Component
 * Allows users to edit the generated resume before downloading
 */
const ResumeEditor: React.FC<ResumeEditorProps> = ({
  generatedResume,
  onSaveChanges,
  isLoading
}) => {
  const [editableResume, setEditableResume] = useState<ResumeData | null>(generatedResume);
  
  // Debug logging for received resume data
  React.useEffect(() => {
    if (generatedResume) {
      console.log('📝 ResumeEditor received data:');
      console.log('  - Name:', generatedResume.name);
      console.log('  - Contact:', generatedResume.contact ? 'Present' : 'Missing');
      console.log('  - Summary length:', generatedResume.summary ? generatedResume.summary.length : 0, 'characters');
      console.log('  - Skills count:', Array.isArray(generatedResume.skills) ? generatedResume.skills.length : 0);
      console.log('  - Experience entries:', Array.isArray(generatedResume.experience) ? generatedResume.experience.length : 0);
      console.log('  - Education entries:', Array.isArray(generatedResume.education) ? generatedResume.education.length : 0);
      console.log('  - Project entries:', Array.isArray(generatedResume.projects) ? generatedResume.projects.length : 0);
      console.log('  - Certification entries:', Array.isArray(generatedResume.certifications) ? generatedResume.certifications.length : 0);
      
      // Log education details specifically
      if (Array.isArray(generatedResume.education)) {
        generatedResume.education.forEach((edu: any, index: number) => {
          console.log(`  🎓 Education ${index + 1} in editor:`, {
            degree: edu.degree,
            institution: edu.institution,
            location: edu.location,
            dates: edu.dates,
            details: edu.details
          });
        });
      }
      
      setEditableResume(generatedResume);
    }
  }, [generatedResume]);
  
  if (!editableResume) {
    console.log('⚠️ ResumeEditor: No editable resume data available');
    return null;
  }

  // Handle changes to the summary
  const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableResume({
      ...editableResume,
      summary: e.target.value
    });
  };

  // Handle changes to skills
  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const skillsArray = e.target.value.split(',').map(skill => skill.trim()).filter(Boolean);
    setEditableResume({
      ...editableResume,
      skills: skillsArray
    });
  };

  // Handle changes to experience highlights
  const handleHighlightChange = (expIndex: number, highlightIndex: number, value: string) => {
    const updatedExperience = [...editableResume.experience];
    updatedExperience[expIndex].highlights[highlightIndex] = value;
    
    setEditableResume({
      ...editableResume,
      experience: updatedExperience
    });
  };

  // Add a new highlight to an experience entry
  const addHighlight = (expIndex: number) => {
    const updatedExperience = [...editableResume.experience];
    updatedExperience[expIndex].highlights.push('');
    
    setEditableResume({
      ...editableResume,
      experience: updatedExperience
    });
  };

  // Remove a highlight from an experience entry
  const removeHighlight = (expIndex: number, highlightIndex: number) => {
    const updatedExperience = [...editableResume.experience];
    updatedExperience[expIndex].highlights.splice(highlightIndex, 1);
    
    setEditableResume({
      ...editableResume,
      experience: updatedExperience
    });
  };

  // Remove an entire experience entry
  const removeExperience = (expIndex: number) => {
    const updatedExperience = [...editableResume.experience];
    updatedExperience.splice(expIndex, 1);
    
    setEditableResume({
      ...editableResume,
      experience: updatedExperience
    });
  };



  // Handle changes to project highlights
  const handleProjectHighlightChange = (projectIndex: number, highlightIndex: number, value: string) => {
    const updatedProjects = [...(editableResume.projects || [])];
    if (!updatedProjects[projectIndex].highlights) {
      updatedProjects[projectIndex].highlights = [];
    }
    updatedProjects[projectIndex].highlights![highlightIndex] = value;
    
    setEditableResume({
      ...editableResume,
      projects: updatedProjects
    });
  };

  // Add a new highlight to a project
  const addProjectHighlight = (projectIndex: number) => {
    const updatedProjects = [...(editableResume.projects || [])];
    if (!updatedProjects[projectIndex].highlights) {
      updatedProjects[projectIndex].highlights = [];
    }
    updatedProjects[projectIndex].highlights!.push('');
    
    setEditableResume({
      ...editableResume,
      projects: updatedProjects
    });
  };

  // Remove a highlight from a project
  const removeProjectHighlight = (projectIndex: number, highlightIndex: number) => {
    const updatedProjects = [...(editableResume.projects || [])];
    if (updatedProjects[projectIndex].highlights) {
      updatedProjects[projectIndex].highlights!.splice(highlightIndex, 1);
    }
    
    setEditableResume({
      ...editableResume,
      projects: updatedProjects
    });
  };

  // Add a new project
  const addProject = () => {
    const newProject: ProjectEntry = {
      name: 'New Project',
      technologies: [],
      highlights: ['', ''] // Start with 2 empty highlights as per baseline requirements
    };

    setEditableResume({
      ...editableResume,
      projects: [...(editableResume.projects || []), newProject]
    });
  };

  // Remove a project
  const removeProject = (projectIndex: number) => {
    const updatedProjects = [...(editableResume.projects || [])];
    updatedProjects.splice(projectIndex, 1);
    
    setEditableResume({
      ...editableResume,
      projects: updatedProjects
    });
  };

  // Handle changes to project technologies
  const handleProjectTechnologiesChange = (projectIndex: number, value: string) => {
    const updatedProjects = [...(editableResume.projects || [])];
    updatedProjects[projectIndex].technologies = value.split(',').map(tech => tech.trim()).filter(Boolean);
    
    setEditableResume({
      ...editableResume,
      projects: updatedProjects
    });
  };

  // Add a new education entry
  const addEducation = () => {
    const newEducation: EducationEntry = {
      degree: '',
      institution: '',
      location: '',
      dates: '',
      details: []
    };

    setEditableResume({
      ...editableResume,
      education: [...(editableResume.education || []), newEducation]
    });
  };

  // Remove an education entry
  const removeEducation = (eduIndex: number) => {
    const updatedEducation = [...(editableResume.education || [])];
    updatedEducation.splice(eduIndex, 1);
    
    setEditableResume({
      ...editableResume,
      education: updatedEducation
    });
  };



  // Add a new certification
  const addCertification = () => {
    const newCertification: CertificationEntry = {
      name: '',
      issuer: '',
      date: ''
    };

    setEditableResume({
      ...editableResume,
      certifications: [...(editableResume.certifications || []), newCertification]
    });
  };

  // Remove a certification
  const removeCertification = (certIndex: number) => {
    const updatedCertifications = [...(editableResume.certifications || [])];
    updatedCertifications.splice(certIndex, 1);
    
    setEditableResume({
      ...editableResume,
      certifications: updatedCertifications
    });
  };

  // Save changes
  const handleSave = () => {
    if (editableResume) {
      console.log('💾 Saving edited resume data:');
      console.log('  - Name:', editableResume.name);
      console.log('  - Contact:', editableResume.contact ? 'Present' : 'Missing');
      console.log('  - Summary length:', editableResume.summary ? editableResume.summary.length : 0, 'characters');
      console.log('  - Skills count:', Array.isArray(editableResume.skills) ? editableResume.skills.length : 0);
      console.log('  - Experience entries:', Array.isArray(editableResume.experience) ? editableResume.experience.length : 0);
      console.log('  - Education entries:', Array.isArray(editableResume.education) ? editableResume.education.length : 0);
      console.log('  - Project entries:', Array.isArray(editableResume.projects) ? editableResume.projects.length : 0);
      console.log('  - Certification entries:', Array.isArray(editableResume.certifications) ? editableResume.certifications.length : 0);
      
      // Log education details specifically
      if (Array.isArray(editableResume.education)) {
        editableResume.education.forEach((edu: any, index: number) => {
          console.log(`  🎓 Education ${index + 1} being saved:`, {
            degree: edu.degree,
            institution: edu.institution,
            location: edu.location,
            dates: edu.dates,
            details: edu.details
          });
        });
      }
      
      onSaveChanges(editableResume);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Edit Your Resume</h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
              Make any necessary changes to your resume before downloading. All sections are editable and will be reflected in your final document.
            </p>
          </div>
        </div>
      </div>
      
      {/* Personal Information */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personal Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={editableResume.name}
              onChange={(e) => setEditableResume({...editableResume, name: e.target.value})}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={editableResume.contact.email}
              onChange={(e) => setEditableResume({
                ...editableResume, 
                contact: {...editableResume.contact, email: e.target.value}
              })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="your.email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={editableResume.contact.phone}
              onChange={(e) => setEditableResume({
                ...editableResume, 
                contact: {...editableResume.contact, phone: e.target.value}
              })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={editableResume.contact.location}
              onChange={(e) => setEditableResume({
                ...editableResume, 
                contact: {...editableResume.contact, location: e.target.value}
              })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="City, State"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              LinkedIn
            </label>
            <input
              type="url"
              value={editableResume.contact.linkedin || ''}
              onChange={(e) => setEditableResume({
                ...editableResume, 
                contact: {...editableResume.contact, linkedin: e.target.value}
              })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="https://linkedin.com/in/yourprofile"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={editableResume.contact.website || ''}
              onChange={(e) => setEditableResume({
                ...editableResume, 
                contact: {...editableResume.contact, website: e.target.value}
              })}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Professional Summary</h3>
        </div>
        <textarea
          value={editableResume.summary}
          onChange={handleSummaryChange}
          rows={4}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          placeholder="Write a compelling professional summary that highlights your key qualifications and career objectives..."
        />
      </div>
      
      {/* Skills */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-2 mb-4">
          <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Skills</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Separate skills with commas</p>
        <input
          type="text"
          value={Array.isArray(editableResume.skills) ? editableResume.skills.join(', ') : ''}
          onChange={handleSkillsChange}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
          placeholder="JavaScript, React, Node.js, Python, SQL, etc."
        />
      </div>
      
      {/* Experience */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-2 mb-6">
          <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8zM16 10h.01M12 14h.01M8 14h.01M8 10h.01" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Work Experience</h3>
        </div>
        
        {editableResume.experience.map((exp, expIndex) => (
          <div key={expIndex} className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">Position {expIndex + 1}</h4>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">Experience Entry</span>
                <button
                  onClick={() => removeExperience(expIndex)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove experience entry"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => {
                    const updated = [...editableResume.experience];
                    updated[expIndex].title = e.target.value;
                    setEditableResume({...editableResume, experience: updated});
                  }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  placeholder="Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dates
                </label>
                <input
                  type="text"
                  value={exp.dates}
                  onChange={(e) => {
                    const updated = [...editableResume.experience];
                    updated[expIndex].dates = e.target.value;
                    setEditableResume({...editableResume, experience: updated});
                  }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  placeholder="Jan 2020 - Present"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company
                </label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...editableResume.experience];
                      updated[expIndex].company = e.target.value;
                      setEditableResume({...editableResume, experience: updated});
                    }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  placeholder="Company Name"
                  />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location
                </label>
                  <input
                    type="text"
                    value={exp.location}
                    onChange={(e) => {
                      const updated = [...editableResume.experience];
                      updated[expIndex].location = e.target.value;
                      setEditableResume({...editableResume, experience: updated});
                    }}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  placeholder="City, State or Remote"
                  />
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Key Achievements & Responsibilities:</h4>
              <div className="space-y-3">
            {exp.highlights.map((highlight, highlightIndex) => (
                  <div key={highlightIndex} className="flex items-start space-x-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                <textarea
                  value={highlight}
                  onChange={(e) => handleHighlightChange(expIndex, highlightIndex, e.target.value)}
                      className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  rows={2}
                      placeholder="Describe a key achievement or responsibility..."
                />
                <button
                  onClick={() => removeHighlight(expIndex, highlightIndex)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove highlight"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
              </div>
            
            <button
              onClick={() => addHighlight(expIndex)}
                className="mt-3 inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
                Add Achievement
            </button>
            </div>
          </div>
        ))}
      </div>

      {/* Education */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Education</h3>
          <button
            onClick={addEducation}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Education
          </button>
        </div>
        
        {editableResume.education && editableResume.education.length > 0 ? (
          editableResume.education.map((edu, eduIndex) => (
            <div key={eduIndex} className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex justify-between items-start mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mr-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Degree
                    </label>
                    <input
                      type="text"
                      value={edu.degree || ''}
                      onChange={(e) => {
                        const updated = [...(editableResume.education || [])];
                        updated[eduIndex].degree = e.target.value;
                        setEditableResume({...editableResume, education: updated});
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="Bachelor of Science in Computer Science"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Institution
                    </label>
                    <input
                      type="text"
                      value={edu.institution || ''}
                      onChange={(e) => {
                        const updated = [...(editableResume.education || [])];
                        updated[eduIndex].institution = e.target.value;
                        setEditableResume({...editableResume, education: updated});
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="University Name"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeEducation(eduIndex)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Remove education"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              

            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p>No education entries yet. Click "Add Education" to add one.</p>
          </div>
        )}
      </div>
      
      {/* Projects */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Projects</h3>
          <button
            onClick={addProject}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Project
          </button>
        </div>
        
        {editableResume.projects && editableResume.projects.length > 0 ? (
          editableResume.projects.map((project, projectIndex) => (
            <div key={projectIndex} className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex justify-between items-start mb-2">
                <div className="w-full">
                  <div className="flex justify-between mb-2">
                    <input
                      type="text"
                      value={project.name}
                      onChange={(e) => {
                        const updated = [...(editableResume.projects || [])];
                        updated[projectIndex].name = e.target.value;
                        setEditableResume({...editableResume, projects: updated});
                      }}
                      className="font-medium p-2 border border-gray-300 dark:border-gray-600 rounded-md flex-grow mr-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="Project Name"
                    />
                    <button
                      onClick={() => removeProject(projectIndex)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="Remove project"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Technologies (comma separated)
                    </label>
                    <input
                      type="text"
                      value={project.technologies ? project.technologies.join(', ') : ''}
                      onChange={(e) => handleProjectTechnologiesChange(projectIndex, e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="Python, TensorFlow, React, etc."
                    />
                  </div>

                  {/* Project Highlights */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Project Highlights:</h4>
                    <div className="space-y-3">
                      {(project.highlights || []).map((highlight, highlightIndex) => (
                        <div key={highlightIndex} className="flex items-start space-x-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                          <textarea
                            value={highlight}
                            onChange={(e) => handleProjectHighlightChange(projectIndex, highlightIndex, e.target.value)}
                            className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                            rows={2}
                            placeholder="Describe a key achievement or feature..."
                          />
                          <button
                            onClick={() => removeProjectHighlight(projectIndex, highlightIndex)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove highlight"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => addProjectHighlight(projectIndex)}
                    className="mt-3 inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Project Highlight
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p>No projects added yet. Click "Add Project" to add one.</p>
          </div>
        )}
      </div>
      
      {/* Certifications */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Certifications</h3>
          <button
            onClick={addCertification}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Certification
          </button>
        </div>
        
        {editableResume.certifications && editableResume.certifications.length > 0 ? (
          editableResume.certifications.map((cert, certIndex) => (
            <div key={certIndex} className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 last:pb-0 last:mb-0">
              <div className="flex justify-between items-start">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mr-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Certification Name
                    </label>
                    <input
                      type="text"
                      value={cert.name}
                      onChange={(e) => {
                        const updated = [...(editableResume.certifications || [])];
                        updated[certIndex].name = e.target.value;
                        setEditableResume({...editableResume, certifications: updated});
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="AWS Certified Solutions Architect"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Issuer
                    </label>
                    <input
                      type="text"
                      value={cert.issuer}
                      onChange={(e) => {
                        const updated = [...(editableResume.certifications || [])];
                        updated[certIndex].issuer = e.target.value;
                        setEditableResume({...editableResume, certifications: updated});
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="Amazon Web Services"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="text"
                      value={cert.date}
                      onChange={(e) => {
                        const updated = [...(editableResume.certifications || [])];
                        updated[certIndex].date = e.target.value;
                        setEditableResume({...editableResume, certifications: updated});
                      }}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                      placeholder="March 2023"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removeCertification(certIndex)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Remove certification"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p>No certifications added yet. Click "Add Certification" to add one.</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-center pt-6">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={`
            ${isLoading 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
            }
            text-white px-8 py-4 border border-transparent rounded-xl
            text-base font-semibold transition-all duration-200 transform hover:scale-105
            focus:outline-none focus:ring-4 focus:ring-blue-500/50
            flex items-center space-x-2
          `}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ResumeEditor; 