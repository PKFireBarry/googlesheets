"use client"

import { ThumbsUp, MessageSquare, Bot, User } from 'lucide-react'
import { Message } from '../../types/interview'

interface FeedbackDisplayProps {
  messages: Message[];
  feedbackVisible: {[key: string]: boolean};
  onToggleFeedback: (messageId: string) => void;
}

export default function FeedbackDisplay({
  messages,
  feedbackVisible,
  onToggleFeedback
}: FeedbackDisplayProps) {
  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'assistant':
        return <Bot className="w-5 h-5 text-blue-500" />
      case 'user':
        return <User className="w-5 h-5 text-gray-500" />
      case 'feedback':
        return <ThumbsUp className="w-5 h-5 text-green-500" />
      default:
        return <MessageSquare className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`p-4 rounded-lg ${
            message.role === 'user'
              ? 'bg-blue-50 dark:bg-blue-900/30'
              : message.role === 'feedback'
              ? 'bg-green-50 dark:bg-green-900/30'
              : 'bg-white dark:bg-gray-800'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-1">
              {getMessageIcon(message.role)}
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {message.content}
              </div>
              
              {message.suggestions && message.suggestions.length > 0 && (
                <div className={`mt-2 ${feedbackVisible[message.id] ? '' : 'hidden'}`}>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Suggested improvements:
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {message.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {message.suggestions && message.suggestions.length > 0 && (
                <button
                  onClick={() => onToggleFeedback(message.id)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {feedbackVisible[message.id] ? 'Hide feedback' : 'Show feedback'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 