import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FileUp, FileText, Trash2, Save } from 'lucide-react';
import { resumeExists, loadResume, saveResume, deleteResume } from '../utils/resumeStorage';
import { prepareResumeTextForAPI } from '../utils/resumeAdapter';
import { ResumeData } from '../types/resume';
import Cookies from 'js-cookie';
import ActionButton from './ActionButton';

interface ResumeStorageUIProps {
  onResumeLoaded?: (resumeText: string, isPdf: boolean) => void;
  onResumeDeleted?: () => void;
  showInfoText?: boolean;
  className?: string;
  onApiKeyLoad?: (apiKey: string) => void;
}

/**
 * A shared component for consistent resume storage UI across the application
 * Handles uploading, viewing, saving, and deleting resumes
 */
export default function ResumeStorageUI({
  onResumeLoaded,
  onResumeDeleted,

  className = '',
  onApiKeyLoad,
}: ResumeStorageUIProps) {
  const [resumeContent, setResumeContent] = useState<string>('');
  const [resumePdfData, setResumePdfData] = useState<string | null>(null);
  const [hasStoredResume, setHasStoredResume] = useState<boolean>(resumeExists());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for API key on mount
  useEffect(() => {
    // Attempt to load API key from cookies
    const apiKey = Cookies.get('geminiApiKey');
    if (apiKey && onApiKeyLoad) {
      onApiKeyLoad(apiKey);
      console.log('API key loaded from cookies in ResumeStorageUI');
    } else {
      // Try localStorage as fallback
      const localStorageApiKey = localStorage.getItem('geminiApiKey');
      if (localStorageApiKey && onApiKeyLoad) {
        onApiKeyLoad(localStorageApiKey);
        // Also save to cookie for cross-component consistency
        Cookies.set('geminiApiKey', localStorageApiKey, { expires: 30 });
        console.log('API key loaded from localStorage in ResumeStorageUI');
      }
    }
  }, []);

  // Load existing resume from storage
  const loadExistingResume = () => {
    try {
      if (resumeExists()) {
        const { resumeData, resumePdfData } = loadResume();
        
        if (resumeData) {
          // Convert structured data to text for display
          const formattedContent = prepareResumeTextForAPI(resumeData, null) || '';
          setResumeContent(formattedContent);
          setResumePdfData(null);
          
          // Notify parent component if needed
          if (onResumeLoaded) {
            onResumeLoaded(formattedContent, false);
          }
          
          toast.success("Your resume has been loaded from shared storage");
        } else if (resumePdfData) {
          setResumePdfData(resumePdfData);
          const placeholderText = "[PDF resume loaded from storage]";
          setResumeContent(placeholderText);
          
          // Notify parent component if needed
          if (onResumeLoaded) {
            onResumeLoaded(resumePdfData, true);
          }
          
          toast.success("Your PDF resume has been loaded from shared storage");
        }
      } else {
        toast.error("No saved resume found");
      }
    } catch (error) {
      console.error("Error loading resume:", error);
      toast.error("Failed to load resume from storage");
    }
  };

  // Delete saved resume from storage
  const deleteSavedResume = () => {
    if (window.confirm('Are you sure you want to delete your shared resume? This will remove it from all parts of the application.')) {
      try {
        if (deleteResume()) {
          setResumeContent('');
          setResumePdfData(null);
          setHasStoredResume(false);
          
          // Notify parent component if needed
          if (onResumeDeleted) {
            onResumeDeleted();
          }
          
          toast.success('Your shared resume has been deleted');
        } else {
          toast.error('Failed to delete your resume');
        }
      } catch (error) {
        console.error("Error deleting resume:", error);
        toast.error("Failed to delete resume from storage");
      }
    }
  };

  // Handle resume upload from file
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      if (file.type === 'application/pdf') {
        // For PDF files, convert to base64
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
          try {
            const base64Data = e.target?.result?.toString().split(',')[1]; // Extract base64 content
            
            if (base64Data) {
              setResumePdfData(base64Data);
              
              // Save to shared storage
              saveResume(null, base64Data);
              setHasStoredResume(true);
              
              // Show placeholder text in UI
              const placeholderText = `[PDF uploaded: ${file.name}] - PDF will be processed directly by AI`;
              setResumeContent(placeholderText);
              
              // Notify parent component if needed
              if (onResumeLoaded) {
                onResumeLoaded(placeholderText, true);
              }
              
              toast.success(`PDF "${file.name}" uploaded successfully!`);
            } else {
              toast.error("Failed to extract PDF data");
            }
          } catch (error) {
            console.error("Error processing PDF:", error);
            toast.error("Failed to process PDF file");
          }
        };
        
        fileReader.onerror = () => {
          toast.error("Failed to read PDF file");
        };
        
        fileReader.readAsDataURL(file);
      } else {
        // For text-based files, extract the text content
        const text = await file.text();
        setResumeContent(text);
        setResumePdfData(null);
        
        // Simple object to save as a resume
        const basicResume: ResumeData = {
          name: 'Resume Owner',
          contact: {
            email: '',
            phone: '',
            location: '',
          },
          summary: text.slice(0, 200),
          skills: [],
          experience: [],
          education: []
        };
        
        // Save to shared storage
        saveResume(basicResume, null);
        setHasStoredResume(true);
        
        // Notify parent component if needed
        if (onResumeLoaded) {
          onResumeLoaded(text, false);
        }
        
        toast.success(`Resume "${file.name}" uploaded successfully!`);
      }
    } catch (error) {
      console.error("Error handling file upload:", error);
      toast.error("Failed to process file");
    }
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`resume-storage-ui ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleResumeUpload}
          className="hidden"
          accept=".txt,.pdf,.docx,.doc"
        />
        <ActionButton
          type="button"
          onClick={() => fileInputRef.current?.click()}
          color="default"
          className="flex items-center"
          icon={FileUp}
        >
          Upload Resume
        </ActionButton>
        
        {hasStoredResume && (
          <>
            <ActionButton
              type="button"
              onClick={loadExistingResume}
              color="blue"
              className="flex items-center"
              icon={FileText}
            >
              Load Saved Resume
            </ActionButton>
            
            <ActionButton
              type="button"
              onClick={deleteSavedResume}
              color="red"
              className="flex items-center"
              icon={Trash2}
            >
              Delete Saved Resume
            </ActionButton>
          </>
        )}
        
        {resumeContent && !resumePdfData && !hasStoredResume && (
          <ActionButton
            type="button"
            onClick={() => {
              try {
                // For now, just create a simple structured resume
                const basicResume: ResumeData = {
                  name: 'Resume Owner',
                  contact: {
                    email: '',
                    phone: '',
                    location: '',
                  },
                  summary: resumeContent.slice(0, 200),
                  skills: [],
                  experience: [],
                  education: []
                };
                
                saveResume(basicResume, null);
                setHasStoredResume(true);
                toast.success('Resume saved to shared storage');
              } catch (error) {
                console.error('Error saving to shared storage:', error);
                toast.error('Failed to save resume to shared storage');
              }
            }}
            color="green"
            className="flex items-center"
            icon={Save}
          >
            Save to Shared Storage
          </ActionButton>
        )}
      </div>
      
      {resumePdfData && (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400 mt-1 mb-2">
          <FileText className="w-4 h-4 mr-1" /> 
          PDF uploaded and ready for processing with AI
        </div>
      )}
    </div>
  );
} 