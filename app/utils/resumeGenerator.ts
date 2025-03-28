/**
 * Utility for generating downloadable resume files in PDF and DOCX formats
 */

import { jsPDF } from 'jspdf';
import { ResumeData, ExperienceEntry, EducationEntry, ProjectEntry, CertificationEntry } from '../types/resume';

/**
 * Interface for resume data structure
 * In a real app, this would be in a separate types file
 */
export interface ResumeGeneratorOptions {
  format: 'pdf' | 'docx';
  filename?: string;
}

/**
 * Generate a downloadable resume file in PDF or DOCX format
 * 
 * @param resumeData The structured resume data
 * @param options Options for the file generation
 * @returns A Promise that resolves when the download starts
 */
export async function generateResumeFile(
  resumeData: ResumeData, 
  options: ResumeGeneratorOptions
): Promise<void> {
  const { format, filename = 'tailored-resume' } = options;
  
  if (format === 'pdf') {
    await generatePDF(resumeData, filename);
  } else if (format === 'docx') {
    await generateDOCX(resumeData, filename);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Generate and download a PDF resume
 * 
 * @param resumeData The structured resume data
 * @param filename The filename for the download
 */
async function generatePDF(resumeData: ResumeData, filename: string): Promise<void> {
  // Create a new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Set document properties
  doc.setProperties({
    title: `${resumeData.name} - Resume`,
    subject: 'Resume',
    author: resumeData.name,
    creator: 'Job Application Tracker'
  });
  
  // Set fonts
  doc.setFont('helvetica', 'normal');
  
  // Starting y position
  let y = 15;
  const margin = 15;
  const width = doc.internal.pageSize.width - 2 * margin;
  const pageHeight = doc.internal.pageSize.height;
  
  // Define space thresholds
  const MIN_SECTION_SPACE = 25; // Minimum space needed for a section header plus at least one line
  const MIN_ENTRY_SPACE = 40; // Minimum space needed for a job entry heading + location + at least one bullet
  const SAFE_ZONE = pageHeight - margin; // Bottom margin before we need a new page
  
  // Helper functions
  const checkPageBreak = (requiredSpace: number): void => {
    if (y + requiredSpace > SAFE_ZONE) {
      doc.addPage();
      y = margin;
    }
  };
  
  const formatCompanyLocation = (company: string, location: string): string => {
    if (!location || location.trim() === '') return company;
    return !location.includes('City') && 
           !location.includes('State') &&
           location !== 'Remote' ? `${company}, ${location}` : company;
  };
  
  const addSectionTitle = (text: string): void => {
    // Check if we need a page break - don't put section title at very bottom of page
    checkPageBreak(MIN_SECTION_SPACE);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(text, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };
  
  const addParagraph = (text: string): void => {
    // Split text into lines that fit within the page width
    const lines = doc.splitTextToSize(text, width);
    
    // Check if the entire paragraph will fit on the current page
    checkPageBreak(lines.length * 5 + 2);
    
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };
  
  const addBulletPoints = (points: string[]): void => {
    points.forEach(point => {
      // Calculate space needed for this bullet point
      const lines = doc.splitTextToSize(`• ${point}`, width - 2);
      
      // Check if we need a new page
      checkPageBreak(lines.length * 5 + 2);
      
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    });
  };
  
  // Add header with name and contact info
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(resumeData.name, margin, y);
  y += 8;
  
  // Contact information
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contact = resumeData.contact;
  const contactText = [
    `${contact.email} | ${contact.phone}`,
    `${contact.location}${contact.linkedin ? ` | ${contact.linkedin}` : ''}${contact.website ? ` | ${contact.website}` : ''}`
  ];
  doc.text(contactText, margin, y);
  y += 10;
  
  // Summary
  addSectionTitle('SUMMARY');
  addParagraph(resumeData.summary);
  
  // Skills
  addSectionTitle('SKILLS');
  const skillsText = resumeData.skills.join(', ');
  addParagraph(skillsText);
  
  // Experience
  addSectionTitle('EXPERIENCE');
  resumeData.experience.forEach((exp: ExperienceEntry) => {
    // Calculate minimum space needed for this experience entry
    // Title + company + at least one bullet point
    const estimatedHeight = 15 + (exp.highlights[0] ? 
                                 doc.splitTextToSize(`• ${exp.highlights[0]}`, width - 2).length * 5 : 0);
    
    // Check if we need a new page - don't split a job entry heading from its first content
    checkPageBreak(Math.max(MIN_ENTRY_SPACE, estimatedHeight));
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${exp.title}`, margin, y);
    
    // Company and dates right-aligned
    const dateWidth = doc.getTextWidth(exp.dates);
    doc.setFont('helvetica', 'normal');
    doc.text(exp.dates, margin + width - dateWidth, y);
    y += 5;
    
    // Company and location
    doc.setFont('helvetica', 'italic');
    doc.text(formatCompanyLocation(exp.company, exp.location), margin, y);
    y += 6;
    
    // Bullet points
    doc.setFont('helvetica', 'normal');
    addBulletPoints(exp.highlights);
  });
  
  // Education
  addSectionTitle('EDUCATION');
  resumeData.education.forEach((edu: EducationEntry) => {
    // Calculate minimum space needed for this education entry
    const estimatedHeight = 15 + ((edu.details && edu.details[0]) ? 
                                 doc.splitTextToSize(`• ${edu.details[0]}`, width - 2).length * 5 : 0);
    
    // Check if we need a new page - don't split education entry header from its content
    checkPageBreak(Math.max(25, estimatedHeight));
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${edu.degree}`, margin, y);
    
    // Dates right-aligned
    const dateWidth = doc.getTextWidth(edu.dates);
    doc.setFont('helvetica', 'normal');
    doc.text(edu.dates, margin + width - dateWidth, y);
    y += 5;
    
    // Institution and location
    doc.setFont('helvetica', 'italic');
    doc.text(`${edu.institution}, ${edu.location}`, margin, y);
    y += 6;
    
    // Details
    if (edu.details && edu.details.length > 0) {
      doc.setFont('helvetica', 'normal');
      addBulletPoints(edu.details);
    }
  });
  
  // Projects (if they exist)
  if (resumeData.projects && resumeData.projects.length > 0) {
    addSectionTitle('PROJECTS');
    resumeData.projects.forEach((project: ProjectEntry) => {
      // Calculate minimum space needed for this project entry
      const descLines = project.description ? doc.splitTextToSize(project.description, width).length * 5 : 0;
      const highlightLines = (project.highlights && project.highlights[0]) ? 
                             doc.splitTextToSize(`• ${project.highlights[0]}`, width - 2).length * 5 : 0;
      const estimatedHeight = 10 + (project.technologies ? 5 : 0) + descLines + highlightLines;
      
      // Check if we need a new page
      checkPageBreak(Math.max(20, estimatedHeight));
      
      doc.setFont('helvetica', 'bold');
      doc.text(project.name, margin, y);
      y += 5;
      
      // Technologies
      if (project.technologies && project.technologies.length > 0) {
        doc.setFont('helvetica', 'italic');
        const techText = `Technologies: ${project.technologies.join(', ')}`;
        const techLines = doc.splitTextToSize(techText, width);
        
        // Check if tech list will fit on this page
        checkPageBreak(techLines.length * 5);
        
        doc.text(techLines, margin, y);
        y += techLines.length * 5;
      }
      
      // Description
      if (project.description) {
        doc.setFont('helvetica', 'normal');
        addParagraph(project.description);
      }
      
      // Highlights
      if (project.highlights && project.highlights.length > 0) {
        doc.setFont('helvetica', 'normal');
        addBulletPoints(project.highlights);
      }
    });
  }
  
  // Certifications (if they exist)
  if (resumeData.certifications && resumeData.certifications.length > 0) {
    addSectionTitle('CERTIFICATIONS');
    resumeData.certifications.forEach((cert: CertificationEntry) => {
      // Check if we need a new page
      checkPageBreak(10);
      
      doc.setFont('helvetica', 'bold');
      doc.text(cert.name, margin, y);
      
      // Date right-aligned
      const dateWidth = doc.getTextWidth(cert.date);
      doc.setFont('helvetica', 'normal');
      doc.text(cert.date, margin + width - dateWidth, y);
      y += 6;
      
      // Issuer if available
      if (cert.issuer) {
      doc.setFont('helvetica', 'italic');
        doc.text(cert.issuer, margin, y);
        y += 5;
      }
    });
  }
  
  // Save the PDF and trigger download
  doc.save(`${filename}.pdf`);
}

/**
 * Generate and download a DOCX resume
 * 
 * @param resumeData The structured resume data
 * @param filename The filename for the download
 */
async function generateDOCX(resumeData: ResumeData, filename: string): Promise<void> {
  // Helper function for formatting company location
  const formatCompanyLocation = (company: string, location: string): string => {
    if (!location || location.trim() === '') return company;
    return !location.includes('City') && 
           !location.includes('State') &&
           location !== 'Remote' ? `${company}, ${location}` : company;
  };

  // Create HTML representation of the resume
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${resumeData.name} - Resume</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 1in;
          line-height: 1.4;
          color: #333;
        }
        h1 {
          margin-bottom: 0.1in;
          font-size: 24pt;
        }
        h2 {
          font-size: 14pt;
          margin-top: 0.2in;
          margin-bottom: 0.1in;
          border-bottom: 1pt solid #333;
          page-break-after: avoid; /* Prevent page break right after a heading */
        }
        .contact {
          margin-bottom: 0.2in;
        }
        p {
          margin: 0.1in 0;
        }
        ul {
          margin-top: 0.05in;
          margin-bottom: 0.1in;
        }
        li {
          margin-bottom: 0.05in;
        }
        .job, .education, .project, .certification {
          margin-bottom: 0.15in;
          page-break-inside: avoid; /* Try to avoid breaking inside a job entry */
        }
        .job-header, .edu-header, .project-header, .cert-header {
          display: flex;
          justify-content: space-between;
          page-break-after: avoid; /* Keep the header with at least some content */
        }
        .job-title, .edu-degree, .project-name, .cert-name {
          font-weight: bold;
        }
        .job-date, .edu-date, .cert-date {
          font-weight: normal;
        }
        .company, .institution, .tech {
          font-style: italic;
          page-break-after: avoid; /* Keep company/institution with some content */
        }
        .section {
          margin-bottom: 0.2in;
        }
        /* Ensure the last item in a section doesn't cause a page break */
        .section:last-child {
          page-break-after: avoid;
        }
        /* Avoid orphaned bullet points */
        li:first-child {
          page-break-after: avoid;
        }
        li:last-child {
          page-break-before: avoid;
        }
      </style>
    </head>
    <body>
      <h1>${resumeData.name}</h1>
      <div class="contact">
        ${resumeData.contact.email} | ${resumeData.contact.phone} | ${resumeData.contact.location}
        ${resumeData.contact.linkedin ? ` | ${resumeData.contact.linkedin}` : ''}
        ${resumeData.contact.website ? ` | ${resumeData.contact.website}` : ''}
      </div>
      
      <div class="section">
        <h2>SUMMARY</h2>
        <p>${resumeData.summary}</p>
      </div>
      
      <div class="section">
        <h2>SKILLS</h2>
        <p>${resumeData.skills.join(', ')}</p>
      </div>
      
      <div class="section">
        <h2>EXPERIENCE</h2>
        ${resumeData.experience.map(exp => `
          <div class="job">
            <div class="job-header">
              <span class="job-title">${exp.title}</span>
              <span class="job-date">${exp.dates}</span>
            </div>
            <div class="company">${formatCompanyLocation(exp.company, exp.location)}</div>
            <ul>
              ${exp.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
      
      <div class="section">
        <h2>EDUCATION</h2>
        ${resumeData.education.map(edu => `
          <div class="education">
            <div class="edu-header">
              <span class="edu-degree">${edu.degree}</span>
              <span class="edu-date">${edu.dates}</span>
            </div>
            <div class="institution">${edu.institution}, ${edu.location}</div>
            ${edu.details && edu.details.length > 0 ? `
              <ul>
                ${edu.details.map(detail => `<li>${detail}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      ${resumeData.projects && resumeData.projects.length > 0 ? `
        <div class="section">
          <h2>PROJECTS</h2>
          ${resumeData.projects.map(project => `
            <div class="project">
              <div class="project-header">
                <span class="project-name">${project.name}</span>
              </div>
              ${project.technologies && project.technologies.length > 0 ? `
                <div class="tech">Technologies: ${project.technologies.join(', ')}</div>
              ` : ''}
              ${project.description ? `<p>${project.description}</p>` : ''}
              ${project.highlights && project.highlights.length > 0 ? `
                <ul>
                  ${project.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${resumeData.certifications && resumeData.certifications.length > 0 ? `
        <div class="section">
          <h2>CERTIFICATIONS</h2>
          ${resumeData.certifications.map(cert => `
            <div class="certification">
              <div class="cert-header">
                <span class="cert-name">${cert.name}</span>
                <span class="cert-date">${cert.date}</span>
              </div>
              ${cert.issuer ? `<div class="institution">${cert.issuer}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </body>
    </html>
  `;
  
  // Create a Blob with the HTML content
  const blob = new Blob([html], { type: 'application/vnd.ms-word' });
  
  // Create a download link and trigger the download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
} 