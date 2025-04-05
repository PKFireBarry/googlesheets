/**
 * Utility for adapting between different resume formats in the application
 */

import { ResumeData as MainResumeData } from '../types/resume';

// This is the format used in cover-letter/resume-form.tsx
export interface CoverLetterResumeData {
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

/**
 * Converts the main resume format to the cover letter format
 * 
 * @param mainResume The resume in the main application format
 * @returns A resume in the cover letter format
 */
export function convertToCoverLetterFormat(mainResume: MainResumeData): CoverLetterResumeData {
  // Extract experience as formatted text
  const experienceText = mainResume.experience
    .map(exp => 
      `${exp.title} at ${exp.company} (${exp.dates})\n` +
      `${exp.location}\n` +
      exp.highlights.map(h => `- ${h}`).join('\n')
    )
    .join('\n\n');
  
  // Extract education as formatted text
  const educationText = mainResume.education
    .map(edu => 
      `${edu.degree} - ${edu.institution} (${edu.dates})\n` +
      `${edu.location}` +
      (edu.details && edu.details.length > 0 
        ? '\n' + edu.details.map(d => `- ${d}`).join('\n') 
        : '')
    )
    .join('\n\n');
  
  // Extract skills as comma-separated string
  const skillsText = Array.isArray(mainResume.skills) 
    ? mainResume.skills.join(', ')
    : mainResume.skills;
  
  // Extract certifications if they exist
  const certificationsText = mainResume.certifications 
    ? mainResume.certifications
        .map(cert => `${cert.name} - ${cert.issuer} (${cert.date})`)
        .join('\n')
    : '';
  
  // Extract projects if they exist
  const projectsText = mainResume.projects
    ? mainResume.projects
        .map(proj => {
          let text = `${proj.name}`;
          if (proj.description) text += `\n${proj.description}`;
          if (proj.technologies && proj.technologies.length > 0) {
            text += `\nTechnologies: ${proj.technologies.join(', ')}`;
          }
          if (proj.highlights && proj.highlights.length > 0) {
            text += '\n' + proj.highlights.map(h => `- ${h}`).join('\n');
          }
          return text;
        })
        .join('\n\n')
    : '';
  
  return {
    fullName: mainResume.name,
    email: mainResume.contact.email,
    phone: mainResume.contact.phone,
    location: mainResume.contact.location,
    website: mainResume.contact.website,
    summary: mainResume.summary,
    experience: experienceText,
    education: educationText,
    skills: skillsText,
    certifications: certificationsText,
    projects: projectsText
  };
}

/**
 * Converts a text resume into the resume text format expected by the cover letter API
 * 
 * @param resumeData The resume data (may be parsed or unparsed)
 * @param pdfData The PDF data as a base64 string (if available)
 * @returns Formatted resume text for the API
 */
export function prepareResumeTextForAPI(
  resumeData: MainResumeData | null, 
  pdfData: string | null
): string | null {
  if (pdfData) {
    // We have PDF data, so just return a placeholder
    // The actual PDF will be sent separately to the API
    return '[PDF Resume Data Available]';
  }
  
  if (!resumeData) {
    return null;
  }
  
  // Format the resume data as text
  const parts = [];
  
  // Name and contact info
  parts.push(`${resumeData.name}`);
  const contactInfo = [];
  if (resumeData.contact.email) contactInfo.push(resumeData.contact.email);
  if (resumeData.contact.phone) contactInfo.push(resumeData.contact.phone);
  if (resumeData.contact.location) contactInfo.push(resumeData.contact.location);
  if (resumeData.contact.linkedin) contactInfo.push(resumeData.contact.linkedin);
  if (resumeData.contact.website) contactInfo.push(resumeData.contact.website);
  parts.push(contactInfo.join(' | '));
  parts.push('');
  
  // Summary
  if (resumeData.summary) {
    parts.push('SUMMARY');
    parts.push(resumeData.summary);
    parts.push('');
  }
  
  // Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    parts.push('SKILLS');
    parts.push(Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : resumeData.skills);
    parts.push('');
  }
  
  // Experience
  if (resumeData.experience && resumeData.experience.length > 0) {
    parts.push('EXPERIENCE');
    resumeData.experience.forEach(exp => {
      parts.push(`${exp.title} | ${exp.company} | ${exp.dates}`);
      parts.push(exp.location);
      exp.highlights.forEach(highlight => {
        parts.push(`• ${highlight}`);
      });
      parts.push('');
    });
  }
  
  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    parts.push('EDUCATION');
    resumeData.education.forEach(edu => {
      parts.push(`${edu.degree} | ${edu.institution} | ${edu.dates}`);
      parts.push(edu.location);
      if (edu.details && edu.details.length > 0) {
        edu.details.forEach(detail => {
          parts.push(`• ${detail}`);
        });
      }
      parts.push('');
    });
  }
  
  // Projects (if available)
  if (resumeData.projects && resumeData.projects.length > 0) {
    parts.push('PROJECTS');
    resumeData.projects.forEach(proj => {
      parts.push(proj.name);
      if (proj.description) parts.push(proj.description);
      if (proj.technologies && proj.technologies.length > 0) {
        parts.push(`Technologies: ${proj.technologies.join(', ')}`);
      }
      if (proj.highlights && proj.highlights.length > 0) {
        proj.highlights.forEach(highlight => {
          parts.push(`• ${highlight}`);
        });
      }
      parts.push('');
    });
  }
  
  // Certifications (if available)
  if (resumeData.certifications && resumeData.certifications.length > 0) {
    parts.push('CERTIFICATIONS');
    resumeData.certifications.forEach(cert => {
      parts.push(`${cert.name} | ${cert.issuer} | ${cert.date}`);
    });
    parts.push('');
  }
  
  return parts.join('\n');
} 