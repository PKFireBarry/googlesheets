"use client"

import { useState } from 'react'
import { Send, Loader } from 'lucide-react'
import { Message, InterviewState, InterviewSettings, Job } from '../../types/interview'

interface QuestionGeneratorProps {
  jobData: Job;
  interviewState: InterviewState;
  settings: InterviewSettings;
  onMessageSubmit: (message: string) => Promise<void>;
  onUpdateMessage: (message: string) => void;
}

export default function QuestionGenerator({
  jobData,
  interviewState,
  settings,
  onMessageSubmit,
  onUpdateMessage
}: QuestionGeneratorProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!interviewState.currentMessage.trim() || interviewState.isLoading) return
    
    await onMessageSubmit(interviewState.currentMessage)
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1">
          <textarea
            value={interviewState.currentMessage}
            onChange={(e) => onUpdateMessage(e.target.value)}
            placeholder="Type your response here..."
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            rows={3}
            disabled={interviewState.isLoading || interviewState.isFinished}
          />
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {interviewState.currentQuestionIndex + 1} of {settings.questionCount} questions
          </div>
        </div>
        <button
          type="submit"
          disabled={!interviewState.currentMessage.trim() || interviewState.isLoading || interviewState.isFinished}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {interviewState.isLoading ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>

      {interviewState.suggestedQuestionsToAsk.length > 0 && !interviewState.isFinished && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Suggested follow-up questions:
          </h3>
          <ul className="space-y-1">
            {interviewState.suggestedQuestionsToAsk.map((question, index) => (
              <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                • {question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 