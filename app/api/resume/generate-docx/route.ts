import { NextRequest, NextResponse } from 'next/server';
import { ResumeData } from '../../../types/resume';

/**
 * POST handler for DOCX generation
 * Generates a DOCX file from resume data and returns a data URL
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
    
    // Generate DOCX as a data URL
    const docxDataUrl = await generateDOCX(resumeData);
    
    // Return the DOCX data URL
    return NextResponse.json({ docxUrl: docxDataUrl });
  } catch (error: any) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate DOCX' },
      { status: 500 }
    );
  }
}

/**
 * Generate a DOCX from resume data
 * This is a simple implementation that creates a data URL with HTML content
 * In a production environment, you would use a library like docx.js
 */
async function generateDOCX(resumeData: ResumeData): Promise<string> {
  // Create HTML content for the resume
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${resumeData.name} - Resume</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 1in; }
        h1 { margin-bottom: 0.2em; }
        h2 { margin-top: 1em; margin-bottom: 0.5em; border-bottom: 1px solid #ccc; }
        .contact { color: #555; margin-bottom: 1em; }
        .section { margin-bottom: 1em; }
        .job { margin-bottom: 0.8em; }
        .job-header { display: flex; justify-content: space-between; }
        .job-title { font-weight: bold; }
        .job-company { font-style: italic; }
        .job-dates { color: #555; }
        ul { margin-top: 0.3em; }
      </style>
    </head>
    <body>
      <h1>${resumeData.name}</h1>
      <div class="contact">
        ${resumeData.contact.email} | ${resumeData.contact.phone} | ${resumeData.contact.location || ''}
        ${resumeData.contact.linkedin ? ` | ${resumeData.contact.linkedin}` : ''}
        ${resumeData.contact.website ? ` | ${resumeData.contact.website}` : ''}
      </div>
      
      <div class="section">
        <h2>Summary</h2>
        <p>${resumeData.summary}</p>
      </div>
      
      <div class="section">
        <h2>Skills</h2>
        <p>${Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : resumeData.skills}</p>
      </div>
      
      <div class="section">
        <h2>Experience</h2>
        ${resumeData.experience.map(exp => `
          <div class="job">
            <div class="job-header">
              <span class="job-title">${exp.title}</span>
              <span class="job-dates">${exp.dates}</span>
            </div>
            <div class="job-company">${exp.company}${exp.location ? `, ${exp.location}` : ''}</div>
            <ul>
              ${exp.highlights.map(highlight => `<li>${highlight}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
      
      ${resumeData.education && resumeData.education.length > 0 ? `
        <div class="section">
          <h2>Education</h2>
          ${resumeData.education.map(edu => `
            <div class="job">
              <div class="job-title">${edu.degree || ''}</div>
              <div class="job-company">${edu.institution || ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${resumeData.projects && resumeData.projects.length > 0 ? `
        <div class="section">
          <h2>Projects</h2>
          ${resumeData.projects.map(project => `
            <div class="job">
              <div class="job-title">${project.name}</div>
              ${project.technologies && project.technologies.length > 0 ? `
                <p><em>Technologies: ${project.technologies.join(', ')}</em></p>
              ` : ''}
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
          <h2>Certifications</h2>
          ${resumeData.certifications.map(cert => `
            <div class="job">
              <div class="job-header">
                <span class="job-title">${cert.name}</span>
                <span class="job-dates">${cert.date}</span>
              </div>
              ${cert.issuer ? `<div class="job-company">${cert.issuer}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </body>
    </html>
  `;
  
  // Convert HTML to a data URL
  // In a real implementation, you would convert this to a proper DOCX file
  // For now, we're just returning an HTML document as a data URL
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;filename=${resumeData.name.replace(/\s+/g, '_')}_Resume.docx;base64,${Buffer.from(htmlContent).toString('base64')}`;
  
  return dataUrl;
} 