"use client"

import { useEffect } from 'react'
import { MessageSquare, User } from 'lucide-react'
import { Job, Message, InterviewSettings } from '../../types/interview'

interface InterviewHeaderProps {
  jobData: Job;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  interviewStarted: boolean;
  settings: InterviewSettings;
  onFetchWelcomeMessage: () => Promise<void>;
}

export default function InterviewHeader({
  jobData,
  messages,
  setMessages,
  interviewStarted,
  settings,
  onFetchWelcomeMessage
}: InterviewHeaderProps) {
  // Start the interview with a welcome message
  useEffect(() => {
    if (jobData && !interviewStarted) {
      // For immediate user experience, show a default welcome message right away
      const initialWelcomeMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: `Hello! I'll be your AI interviewer today for the ${jobData.title} position at ${jobData.company_name}. This mock interview will help you prepare for your real interview.\n\nWe'll go through ${settings.questionCount} questions, and I'll provide feedback on your responses. You can upload your resume to make the questions more relevant to your experience.\n\nAre you ready to begin?`,
        timestamp: new Date(),
      }
      setMessages([initialWelcomeMessage])
      
      // Then fetch a personalized welcome message from the API
      onFetchWelcomeMessage()
    }
  }, [jobData, interviewStarted, settings.questionCount, setMessages, onFetchWelcomeMessage])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <MessageSquare className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mock Interview
          </h2>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            <p>Position: {jobData.title}</p>
            <p>Company: {jobData.company_name}</p>
            {jobData.location && <p>Location: {jobData.location}</p>}
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {settings.interviewerType === 'technical' ? 'Technical Interviewer' : 'HR Interviewer'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
} 