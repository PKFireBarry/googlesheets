import React, { useEffect, useState } from 'react';
import { ResumeData } from '../../types/resume';
import { jsPDF } from 'jspdf';

interface ResumePreviewProps {
  resumeData: ResumeData | null;
  isLoading: boolean;
}

/**
 * Resume Preview Component
 * Shows a visual preview of the actual resume file
 */
const ResumePreview: React.FC<ResumePreviewProps> = ({
  resumeData,
  isLoading
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (resumeData && !isLoading) {
      generatePreview(resumeData);
    }
    
    return () => {
      // Clean up the URL when component unmounts
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [resumeData, isLoading]);

  const generatePreview = async (data: ResumeData) => {
    try {
      setIsGenerating(true);
      
      // Create a new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set document properties
      doc.setProperties({
        title: `${data.name} - Resume`,
        subject: 'Resume',
        author: data.name,
        creator: 'Job Application Tracker'
      });
      
      // Set fonts
      doc.setFont('helvetica', 'normal');
      
      // Starting y position
      let y = 15;
      const margin = 15;
      const width = doc.internal.pageSize.width - 2 * margin;
      const pageHeight = doc.internal.pageSize.height;
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
        // Check if we need a page break
        checkPageBreak(10);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(text, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      };
      
      const addParagraph = (text: string): void => {
        const lines = doc.splitTextToSize(text, width);
        
        // Check if the paragraph will fit
        checkPageBreak(lines.length * 5 + 2);
        
        doc.text(lines, margin, y);
        y += lines.length * 5 + 2;
      };
      
      const addBulletPoints = (points: string[]): void => {
        points.forEach(point => {
          const lines = doc.splitTextToSize(`• ${point}`, width - 2);
          
          // Check if this bullet point will fit
          checkPageBreak(lines.length * 5 + 2);
          
          doc.text(lines, margin, y);
          y += lines.length * 5 + 2;
        });
      };
      
      // Add header with name and contact info
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(data.name, margin, y);
      y += 8;
      
      // Contact information
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contact = data.contact;
      const contactText = [
        `${contact.email} | ${contact.phone}`,
        `${contact.location}${contact.linkedin ? ` | ${contact.linkedin}` : ''}${contact.website ? ` | ${contact.website}` : ''}`
      ];
      doc.text(contactText, margin, y);
      y += 10;
      
      // Summary
      addSectionTitle('SUMMARY');
      addParagraph(data.summary);
      
      // Skills
      addSectionTitle('SKILLS');
      const skillsText = Array.isArray(data.skills) ? data.skills.join(', ') : '';
      addParagraph(skillsText);
      
      // Experience
      addSectionTitle('EXPERIENCE');
      data.experience.forEach((exp) => {
        checkPageBreak(20); // Minimum space for a job entry
        
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
      if (data.education && data.education.length > 0) {
        addSectionTitle('EDUCATION');
        
        data.education.forEach((edu) => {
          checkPageBreak(15); // Minimum space for an education entry
          
          // Degree
          doc.setFont('helvetica', 'bold');
          doc.text(edu.degree || '', margin, y);
          y += 5;
          
          // Institution
          doc.setFont('helvetica', 'italic');
          doc.text(edu.institution || '', margin, y);
          y += 6;
          
          // Add some space after the education entry
          y += 3;
        });
      }

      // Projects (if available)
      if (data.projects && data.projects.length > 0) {
        addSectionTitle('PROJECTS');
        
        data.projects.forEach((project) => {
          checkPageBreak(15); // Minimum space for a project entry
          
          // Project name
          doc.setFont('helvetica', 'bold');
          doc.text(project.name, margin, y);
          y += 5;
          
          // Technologies
          if (project.technologies && project.technologies.length > 0) {
            doc.setFont('helvetica', 'italic');
            const techText = `Technologies: ${project.technologies.join(', ')}`;
            const techLines = doc.splitTextToSize(techText, width);
            
            checkPageBreak(techLines.length * 5);
            doc.text(techLines, margin, y);
            y += techLines.length * 5;
          }
          

          
          // Highlights (if any)
          if (project.highlights && project.highlights.length > 0) {
            doc.setFont('helvetica', 'normal');
            addBulletPoints(project.highlights);
          }
          
          // Add some space after the project
          y += 5;
        });
      }

      // Certifications (if available)
      if (data.certifications && data.certifications.length > 0) {
        addSectionTitle('CERTIFICATIONS');
        
        data.certifications.forEach((cert) => {
          checkPageBreak(8); // Minimum space for a certification entry
          
          // Certification name and date
          doc.setFont('helvetica', 'bold');
          doc.text(cert.name, margin, y);
          
          // Date right-aligned
          const dateWidth = doc.getTextWidth(cert.date);
          doc.setFont('helvetica', 'normal');
          doc.text(cert.date, margin + width - dateWidth, y);
          y += 5;
          
          // Issuer
          doc.setFont('helvetica', 'italic');
          doc.text(cert.issuer, margin, y);
          y += 6;
        });
      }
      
      // Generate the PDF as a data URL
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPreviewUrl(pdfUrl);
      
    } catch (error) {
      console.error('Error generating PDF preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!resumeData) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="font-semibold text-xl mb-4">Resume Preview</h3>
      
      {isGenerating ? (
        <div className="flex justify-center items-center h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Generating preview...</p>
          </div>
        </div>
      ) : previewUrl ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <iframe
            src={previewUrl}
            title="Resume Preview"
            className="w-full h-[600px]"
          />
        </div>
      ) : (
        <div className="flex justify-center items-center h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-gray-500">Preview not available</p>
        </div>
      )}
    </div>
  );
};

export default ResumePreview; 