/**
 * Utility for adapting between different resume formats in the application
 */

import { ResumeData, ExperienceEntry, EducationEntry, CertificationEntry, ProjectEntry } from '../types/resume';

/**
 * Converts the main resume format to the canonical ResumeData format
 *
 * @param mainResume The resume in the main application format
 * @returns A canonical ResumeData object
 */
export function convertToCoverLetterFormat(mainResume: ResumeData): ResumeData {
  // Just return the canonical object (deep clone if needed)
  return JSON.parse(JSON.stringify(mainResume));
}

/**
 * Converts a text resume into the resume text format expected by the cover letter API
 *
 * @param resumeData The resume data (may be parsed or unparsed)
 * @param pdfData The PDF data as a base64 string (if available)
 * @returns Formatted resume text for the API
 */
export function prepareResumeTextForAPI(
  resumeData: ResumeData | null,
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