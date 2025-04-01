"use client"

import { useState, useRef } from 'react'
import { FileUp, FileText, Check, Trash2, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { loadResume, deleteResume, resumeExists, saveResume } from '../../utils/resumeStorage'
import { prepareResumeTextForAPI } from '../../utils/resumeAdapter'
import { ResumeState, Message } from '../../types/interview'

interface ResumeHandlerProps {
  resumeState: ResumeState;
  setResumeState: (state: ResumeState) => void;
  onResumeAction: (message: Message) => void;
}

export default function ResumeHandler({ 
  resumeState, 
  setResumeState, 
  onResumeAction 
}: ResumeHandlerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const useSharedResume = () => {
    if (resumeExists()) {
      const { resumeData, resumePdfData } = loadResume();
      
      if (resumePdfData) {
        setResumeState({
          ...resumeState,
          resumeBase64: resumePdfData,
          resumeText: 'Using shared PDF resume',
          hasResume: true
        });
      } else if (resumeData) {
        const resumeText = prepareResumeTextForAPI(resumeData, null);
        if (resumeText) {
          const base64Encoded = btoa(unescape(encodeURIComponent(resumeText)));
          setResumeState({
            ...resumeState,
            resumeBase64: base64Encoded,
            resumeText: 'Using shared resume',
            hasResume: true
          });
        }
      }
      
      onResumeAction({
        id: Math.random().toString(36).substring(2, 9),
        role: 'system',
        content: 'Using your shared resume for this interview.',
        timestamp: new Date(),
      });
      
      toast.success('Using your shared resume for this interview');
    }
  };
  
  const removeSharedResume = () => {
    setResumeState({
      resumeFile: null,
      resumeBase64: null,
      resumeText: null,
      hasResume: false
    });
    
    onResumeAction({
      id: Math.random().toString(36).substring(2, 9),
      role: 'system',
      content: 'Resume removed. The interview will not use resume information.',
      timestamp: new Date(),
    });
    
    toast.success('Resume removed from this interview');
  };

  return (
    <div className="flex flex-col space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">Resume</span>
        </div>
        <div className="flex items-center space-x-2">
          {resumeState.hasResume ? (
            <>
              <button
                onClick={removeSharedResume}
                className="inline-flex items-center px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </button>
              <span className="text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3 inline" /> Resume loaded
              </span>
            </>
          ) : (
            <>
              <button
                onClick={useSharedResume}
                className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <FileUp className="w-3 h-3 mr-1" />
                Use shared resume
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                <Info className="w-3 h-3 inline" /> No resume loaded
              </span>
            </>
          )}
        </div>
      </div>
      {resumeState.resumeText && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {resumeState.resumeText}
        </div>
      )}
    </div>
  )
} 