import { NextRequest, NextResponse } from 'next/server';
import { ResumeData } from '../../../types/resume';
import { jsPDF } from 'jspdf';

/**
 * POST handler for PDF generation
 * Generates a PDF file from resume data and returns a data URL
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    
    // Extract resume data from the request
    const { resumeData } = body;
    
    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data is required' },
        { status: 400 }
      );
    }
    
    // Generate PDF
    const pdfDataUrl = await generatePDF(resumeData);
    
    // Ensure the PDF data URL has the correct format with consistent encoding
    let formattedPdfUrl = pdfDataUrl;
    
    // If it's already a data URL, make sure it has the correct format
    if (pdfDataUrl.startsWith('data:')) {
      // Extract just the base64 data
      const base64Data = pdfDataUrl.split(',')[1];
      // Reformat with consistent structure
      formattedPdfUrl = `data:application/pdf;filename=generated.pdf;base64,${base64Data}`;
    } else {
      // If it's just base64 data without the data URL prefix
      formattedPdfUrl = `data:application/pdf;filename=generated.pdf;base64,${pdfDataUrl}`;
    }
    
    console.log('Generated PDF URL format:', formattedPdfUrl.substring(0, 50) + '...');
    
    // Return the PDF data URL
    return NextResponse.json({ pdfUrl: formattedPdfUrl });
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

/**
 * Sanitize text to prevent null or undefined values that might cause PDF generation errors
 */
function sanitizeText(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }
  return String(text);
}

/**
 * Generate a PDF from resume data
 */
async function generatePDF(resumeData: ResumeData): Promise<string> {
  // Create a new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Set document properties
  doc.setProperties({
    title: `${sanitizeText(resumeData.name)} - Resume`,
    subject: 'Resume',
    author: sanitizeText(resumeData.name),
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
    company = sanitizeText(company);
    location = sanitizeText(location);
    
    if (!location || location.trim() === '') return company;
    return !location.includes('City') && 
           !location.includes('State') &&
           location !== 'Remote' ? `${company}, ${location}` : company;
  };
  
  const addSectionTitle = (text: string): void => {
    text = sanitizeText(text);
    
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
    text = sanitizeText(text);
    
    // Split text into lines that fit within the page width
    const lines = doc.splitTextToSize(text, width);
    
    // Check if the entire paragraph will fit on the current page
    checkPageBreak(lines.length * 5 + 2);
    
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };
  
  const addBulletPoints = (points: string[]): void => {
    if (!points || !Array.isArray(points)) {
      return;
    }
    
    points.forEach(point => {
      point = sanitizeText(point);
      
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
  doc.text(sanitizeText(resumeData.name), margin, y);
  y += 8;
  
  // Contact information
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contact = resumeData.contact;
  const contactText = [
    `${sanitizeText(contact.email)} | ${sanitizeText(contact.phone)}`,
    `${sanitizeText(contact.location)}${contact.linkedin ? ` | ${sanitizeText(contact.linkedin)}` : ''}${contact.website ? ` | ${sanitizeText(contact.website)}` : ''}`
  ];
  doc.text(contactText, margin, y);
  y += 10;
  
  // Summary
  addSectionTitle('SUMMARY');
  addParagraph(sanitizeText(resumeData.summary));
  
  // Skills
  addSectionTitle('SKILLS');
  const skillsArray = Array.isArray(resumeData.skills) ? resumeData.skills : [];
  const sanitizedSkills = skillsArray.map(skill => sanitizeText(skill));
  const skillsText = sanitizedSkills.join(', ');
  addParagraph(skillsText);
  
  // Experience
  addSectionTitle('EXPERIENCE');
  resumeData.experience.forEach(exp => {
    // Calculate minimum space needed for this experience entry
    // Title + company + at least one bullet point
    const highlights = Array.isArray(exp.highlights) ? exp.highlights : [];
    const firstHighlight = highlights.length > 0 ? sanitizeText(highlights[0]) : '';
    const estimatedHeight = 15 + (firstHighlight ? 
                                 doc.splitTextToSize(`• ${firstHighlight}`, width - 2).length * 5 : 0);
    
    // Check if we need a new page - don't split a job entry heading from its first content
    checkPageBreak(Math.max(MIN_ENTRY_SPACE, estimatedHeight));
    
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeText(exp.title), margin, y);
    
    // Company and dates right-aligned
    const dateWidth = doc.getTextWidth(sanitizeText(exp.dates));
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(exp.dates), margin + width - dateWidth, y);
    y += 5;
    
    // Company and location
    doc.text(formatCompanyLocation(exp.company, exp.location), margin, y);
    y += 5;
    
    // Bullet points
    addBulletPoints(exp.highlights);
    
    // Add some space after each entry
    y += 2;
  });
  
  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    addSectionTitle('EDUCATION');
    resumeData.education.forEach(edu => {
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(edu.degree), margin, y);
      
      // Institution and dates right-aligned
      const dateWidth = doc.getTextWidth(sanitizeText(edu.dates));
      doc.setFont('helvetica', 'normal');
      doc.text(sanitizeText(edu.dates), margin + width - dateWidth, y);
      y += 5;
      
      // Institution and location
      doc.text(formatCompanyLocation(edu.institution, edu.location), margin, y);
      y += 5;
      
      // Details as bullet points if available
      if (edu.details && Array.isArray(edu.details)) {
        addBulletPoints(edu.details);
      }
      
      // Add some space after each entry
      y += 2;
    });
  }
  
  // Projects
  if (resumeData.projects && resumeData.projects.length > 0) {
    addSectionTitle('PROJECTS');
    resumeData.projects.forEach(project => {
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(project.name), margin, y);
      y += 5;
      
      // Description
      if (project.description) {
        doc.setFont('helvetica', 'normal');
        addParagraph(sanitizeText(project.description));
      }
      
      // Technologies
      if (project.technologies && Array.isArray(project.technologies)) {
        doc.setFont('helvetica', 'italic');
        const techText = project.technologies.map(tech => sanitizeText(tech)).join(', ');
        addParagraph(`Technologies: ${techText}`);
        doc.setFont('helvetica', 'normal');
      }
      
      // Highlights as bullet points
      if (project.highlights && Array.isArray(project.highlights)) {
        addBulletPoints(project.highlights);
      }
      
      // Add some space after each entry
      y += 2;
    });
  }
  
  // Certifications
  if (resumeData.certifications && resumeData.certifications.length > 0) {
    addSectionTitle('CERTIFICATIONS');
    resumeData.certifications.forEach(cert => {
      doc.setFont('helvetica', 'bold');
      doc.text(sanitizeText(cert.name), margin, y);
      
      // Issuer and date right-aligned
      const dateWidth = doc.getTextWidth(sanitizeText(cert.date));
      doc.setFont('helvetica', 'normal');
      doc.text(sanitizeText(cert.date), margin + width - dateWidth, y);
      y += 5;
      
      // Issuer
      doc.text(sanitizeText(cert.issuer), margin, y);
      y += 7;
    });
  }
  
  // Return the PDF as a data URL
  try {
    // Use output format 'datauristring' to get a proper data URI
    const pdfOutput = doc.output('datauristring');
    console.log('Generated PDF data URI:', pdfOutput.substring(0, 50) + '...');
    return pdfOutput;
  } catch (error) {
    console.error('Error generating PDF output:', error);
    throw new Error('Failed to generate PDF output');
  }
} 