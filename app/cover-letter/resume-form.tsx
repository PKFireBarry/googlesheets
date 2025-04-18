import React, { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { toast } from 'react-hot-toast';
import type { ResumeData, ExperienceEntry, EducationEntry, CertificationEntry, ProjectEntry } from '../types/resume';

interface ResumeFormProps {
  resumeData: ResumeData;
  onChangeResumeData: (data: ResumeData) => void;
  onSave: () => void;
}

// --- Helper functions to convert between flat form and canonical ResumeData ---
function resumeDataToForm(resumeData: ResumeData) {
  return {
    fullName: resumeData.name || '',
    email: resumeData.contact?.email || '',
    phone: resumeData.contact?.phone || '',
    location: resumeData.contact?.location || '',
    website: resumeData.contact?.website || '',
    summary: resumeData.summary || '',
    skills: resumeData.skills?.join(', ') || '',
    experience: (resumeData.experience || [])
      .map(e => `${e.title} at ${e.company} | ${e.location} | ${e.dates}\n${e.highlights?.map(h => '- ' + h).join('\n')}`)
      .join('\n\n'),
    education: (resumeData.education || [])
      .map(e => `${e.degree} - ${e.institution} | ${e.location} | ${e.dates}\n${e.details?.map(d => '- ' + d).join('\n')}`)
      .join('\n\n'),
    certifications: (resumeData.certifications || [])
      .map(c => `${c.name} - ${c.issuer} (${c.date})`).join('\n'),
    projects: (resumeData.projects || [])
      .map(p => `${p.name}${p.description ? ': ' + p.description : ''}${p.technologies && p.technologies.length ? '\nTech: ' + p.technologies.join(', ') : ''}${p.highlights && p.highlights.length ? '\n' + p.highlights.map(h => '- ' + h).join('\n') : ''}`)
      .join('\n\n'),
  };
}

function formToResumeData(form: any): ResumeData {
  // Parse skills
  const skills = form.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
  // Parse experience
  const experience: ExperienceEntry[] = form.experience
    .split(/\n\n+/)
    .map((block: string) => {
      const [header, ...rest] = block.split('\n');
      const [titleCompany, location, dates] = header.split('|').map(s => s.trim());
      const [title, company] = (titleCompany || '').split(' at ').map(s => s.trim());
      const highlights = rest.filter(Boolean).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      return title && company ? { title, company, location: location || '', dates: dates || '', highlights } : null;
    })
    .filter(Boolean) as ExperienceEntry[];
  // Parse education
  const education: EducationEntry[] = form.education
    .split(/\n\n+/)
    .map((block: string) => {
      const [header, ...rest] = block.split('\n');
      const [degreeInst, location, dates] = header.split('|').map(s => s.trim());
      const [degree, institution] = (degreeInst || '').split(' - ').map(s => s.trim());
      const details = rest.filter(Boolean).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      return degree && institution ? { degree, institution, location: location || '', dates: dates || '', details } : null;
    })
    .filter(Boolean) as EducationEntry[];
  // Parse certifications
  const certifications: CertificationEntry[] = (form.certifications || '').split('\n').map((line: string) => {
    const match = line.match(/^(.*?)\s*-\s*(.*?)\s*\((.*?)\)$/);
    if (match) {
      return { name: match[1].trim(), issuer: match[2].trim(), date: match[3].trim() };
    }
    return null;
  }).filter(Boolean) as CertificationEntry[];
  // Parse projects
  const projects: ProjectEntry[] = (form.projects || '').split(/\n\n+/).map((block: string) => {
    const [firstLine, ...rest] = block.split('\n');
    const [name, description] = firstLine.split(':').map(s => s.trim());
    let technologies: string[] = [];
    const highlights: string[] = [];
    rest.forEach(line => {
      if (line.startsWith('Tech:')) {
        technologies = line.replace('Tech:', '').split(',').map(s => s.trim()).filter(Boolean);
      } else if (line.startsWith('-') || line.startsWith('•')) {
        highlights.push(line.replace(/^[-•]\s*/, '').trim());
      }
    });
    return name ? { name, description: description || '', technologies, highlights } : null;
  }).filter(Boolean) as ProjectEntry[];
  return {
    name: form.fullName,
    contact: {
      email: form.email,
      phone: form.phone,
      location: form.location,
      website: form.website,
    },
    summary: form.summary,
    skills,
    experience,
    education,
    certifications,
    projects,
  };
}

const ResumeForm: React.FC<ResumeFormProps> = ({ resumeData, onChangeResumeData, onSave }) => {
  // Local state for flat form fields
  const [form, setForm] = useState(() => resumeDataToForm(resumeData));

  // Keep form in sync if resumeData changes from outside
  useEffect(() => {
    setForm(resumeDataToForm(resumeData));
  }, [resumeData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Live update parent ResumeData for instant preview
    onChangeResumeData(formToResumeData({ ...form, [name]: value }));
  };

  const handleSave = () => {
    onChangeResumeData(formToResumeData(form));
    onSave();
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
            value={form.fullName}
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
            value={form.email}
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
            value={form.phone}
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
            value={form.location}
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
            value={form.website}
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
            value={form.summary}
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
            value={form.experience}
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
            value={form.education}
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
            value={form.skills}
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
            value={form.certifications}
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
            value={form.projects}
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
          onClick={handleSave}
          className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Resume Data
        </button>
      </div>
    </div>
  );
};

// Helper to get initial ResumeData in canonical format
export const getInitialResumeData = (): ResumeData => {
  try {
    const savedData = Cookies.get("resumeData");
    if (savedData) return JSON.parse(savedData);
    return {
      name: "",
      contact: { email: "", phone: "", location: "", website: "" },
      summary: "",
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      projects: [],
    };
  } catch (e) {
    console.error("Error loading resume data from cookies:", e);
    return {
      name: "",
      contact: { email: "", phone: "", location: "", website: "" },
      summary: "",
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      projects: [],
    };
  }
};

export const generateResumeText = (resumeData: ResumeData): string => {
  try {
    let resumeText = `${resumeData.name || "Applicant Name"}\n`;
    resumeText += `${resumeData.contact.email || "email@example.com"}${resumeData.contact.phone ? ` | ${resumeData.contact.phone}` : ""}\n`;
    resumeText += `${resumeData.contact.location || "Location"}${resumeData.contact.website ? ` | ${resumeData.contact.website}` : ""}\n\n`;
    if (resumeData.summary) {
      resumeText += `PROFESSIONAL SUMMARY\n${resumeData.summary}\n\n`;
    }
    if (resumeData.experience && resumeData.experience.length > 0) {
      resumeText += `PROFESSIONAL EXPERIENCE\n`;
      resumeData.experience.forEach(exp => {
        resumeText += `${exp.title} at ${exp.company} (${exp.dates})\n${exp.location}\n`;
        exp.highlights.forEach(h => {
          resumeText += `- ${h}\n`;
        });
        resumeText += `\n`;
      });
    }
    if (resumeData.education && resumeData.education.length > 0) {
      resumeText += `EDUCATION\n`;
      resumeData.education.forEach(edu => {
        resumeText += `${edu.degree} - ${edu.institution} (${edu.dates})\n${edu.location}\n`;
        if (edu.details && edu.details.length > 0) {
          edu.details.forEach(d => {
            resumeText += `- ${d}\n`;
          });
        }
        resumeText += `\n`;
      });
    }
    if (resumeData.skills && resumeData.skills.length > 0) {
      resumeText += `SKILLS\n${resumeData.skills.join(", ")}\n\n`;
    }
    if (resumeData.certifications && resumeData.certifications.length > 0) {
      resumeText += `CERTIFICATIONS\n`;
      resumeData.certifications.forEach(cert => {
        resumeText += `${cert.name} - ${cert.issuer} (${cert.date})\n`;
      });
      resumeText += `\n`;
    }
    if (resumeData.projects && resumeData.projects.length > 0) {
      resumeText += `PROJECTS\n`;
      resumeData.projects.forEach(proj => {
        resumeText += `${proj.name}\n`;
        if (proj.description) resumeText += `${proj.description}\n`;
        if (proj.technologies && proj.technologies.length > 0) resumeText += `Technologies: ${proj.technologies.join(", ")}\n`;
        if (proj.highlights && proj.highlights.length > 0) {
          proj.highlights.forEach(h => {
            resumeText += `- ${h}\n`;
          });
        }
        resumeText += `\n`;
      });
    }
    return resumeText;
  } catch (error) {
    console.error("Error generating resume text:", error);
    return "";
  }
};

export const saveResumeData = (resumeData: ResumeData, callback?: (text: string) => void) => {
  try {
    const formattedText = generateResumeText(resumeData);
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