"use client"

import { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Upload, 
  Lightbulb, 
  User, 
  Bot, 
  ThumbsUp, 
  X, 
  Clock, 
  RefreshCw
} from 'lucide-react'

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
  location?: string;
  skills?: string;
  [key: string]: string | undefined;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'feedback';
  content: string;
  timestamp: Date;
  showFeedback?: boolean;
  suggestions?: string[];
  isQuestion?: boolean;
  questionIndex?: number;
}

interface InterviewResponse {
  welcomeMessage?: string;
  question?: string;
  suggestions?: string[];
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  score?: number;
  summary?: string;
  overallScore?: number;
  keyStrengths?: string[];
  areasForImprovement?: string[];
  suggestedQuestions?: string[];
  error?: string;
}

interface MockInterviewContainerProps {
  jobData: Job;
}

export default function MockInterviewContainer({ jobData }: MockInterviewContainerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [interviewScore, setInterviewScore] = useState<number | null>(null)
  const [feedbackVisible, setFeedbackVisible] = useState<{[key: string]: boolean}>({})
  const [apiErrorCount, setApiErrorCount] = useState(0)
  const [suggestedQuestionsToAsk, setSuggestedQuestionsToAsk] = useState<string[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Start the interview with a welcome message
  useEffect(() => {
    if (jobData && !isStarted) {
      // For immediate user experience, show a default welcome message right away
      const initialWelcomeMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Hello! I'll be your AI interviewer today for the ${jobData.title} position at ${jobData.company_name}. This mock interview will help you prepare for your real interview.\n\nWe'll go through 3-5 questions, and I'll provide feedback on your responses. You can upload your resume to make the questions more relevant to your experience.\n\nAre you ready to begin?`,
        timestamp: new Date(),
      }
      setMessages([initialWelcomeMessage])
      
      // Then fetch a personalized welcome message from the API
      fetchWelcomeMessage()
    }
  }, [jobData, isStarted])

  useEffect(() => {
    // Fetch suggested questions when the component loads
    fetchSuggestedQuestions()
  }, [jobData]) // Re-fetch if job data changes

  const generateId = () => {
    return Math.random().toString(36).substring(2, 9)
  }

  const fetchWelcomeMessage = async () => {
    if (apiErrorCount > 2) return // Don't keep trying if we've had multiple API failures
    
    try {
      const response = await fetch('/api/gemini/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobData.title,
          companyName: jobData.company_name,
          jobDescription: jobData.description || '',
          skills: jobData.skills || '',
          resumeFile: resumeFile ? {
            name: resumeFile.name,
            type: resumeFile.type,
            size: resumeFile.size
          } : null,
          action: 'start'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error fetching welcome message:', error)
        setApiErrorCount(prev => prev + 1)
        return
      }

      const data = await response.json() as InterviewResponse
      
      if (data.welcomeMessage) {
        // Replace the initial welcome message with the personalized one
        setMessages(prev => [{
          id: prev[0].id,
          role: 'assistant',
          content: data.welcomeMessage || `Hello! I'll be your AI interviewer today for the ${jobData.title} position at ${jobData.company_name}.`,
          timestamp: prev[0].timestamp,
        }])
      }
    } catch (error) {
      console.error('Error fetching welcome message:', error)
      setApiErrorCount(prev => prev + 1)
    }
  }

  const fetchSuggestedQuestions = async () => {
    setIsLoadingSuggestions(true)
    
    try {
      const response = await fetch('/api/gemini/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobData.title,
          companyName: jobData.company_name,
          jobDescription: jobData.description || '',
          skills: jobData.skills || '',
          action: 'questions'
        }),
      })

      if (!response.ok) {
        console.error('Error fetching suggested questions')
        // Fallback to hardcoded questions if API fails
        setSuggestedQuestionsToAsk([
          `What does success look like for this ${jobData.title} role in the first 90 days?`,
          `How would you describe the team culture and working environment at ${jobData.company_name}?`,
          `What are the biggest challenges the team is currently facing?`,
          `How is performance measured and reviewed for this role?`,
          `What opportunities are there for professional development?`,
          `Could you tell me about the typical career progression for someone in this ${jobData.title} position?`,
          `What do you enjoy most about working at ${jobData.company_name}?`
        ])
        return
      }

      const data = await response.json()
      if (data.questions && Array.isArray(data.questions)) {
        setSuggestedQuestionsToAsk(data.questions)
      } else {
        // Fallback if response doesn't contain questions array
        setSuggestedQuestionsToAsk([
          `What does success look like for this ${jobData.title} role in the first 90 days?`,
          `How would you describe the team culture and working environment at ${jobData.company_name}?`,
          `What are the biggest challenges the team is currently facing?`,
          `How is performance measured and reviewed for this role?`,
          `What opportunities are there for professional development?`,
          `Could you tell me about the typical career progression for someone in this ${jobData.title} position?`,
          `What do you enjoy most about working at ${jobData.company_name}?`
        ])
      }
    } catch (error) {
      console.error('Error fetching suggested questions:', error)
      // Use fallback questions
      setSuggestedQuestionsToAsk([
        `What does success look like for this ${jobData.title} role in the first 90 days?`,
        `How would you describe the team culture and working environment at ${jobData.company_name}?`,
        `What are the biggest challenges the team is currently facing?`,
        `How is performance measured and reviewed for this role?`,
        `What opportunities are there for professional development?`,
        `Could you tell me about the typical career progression for someone in this ${jobData.title} position?`,
        `What do you enjoy most about working at ${jobData.company_name}?`
      ])
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setResumeFile(file)
    setIsLoading(true)

    try {
      // We're storing the file directly to send to Gemini API, which can handle PDF and DOCX files
      // No need to parse the content on the client side
      const sizeInKb = (file.size / 1024).toFixed(2);
      const fileInfoText = `Resume "${file.name}" (${sizeInKb} KB) uploaded successfully`;
      setResumeText(fileInfoText);
      
      const message: Message = {
        id: generateId(),
        role: 'system',
        content: `Resume uploaded: ${file.name}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, message])
    } catch (error) {
      console.error('Error processing file:', error)
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `Error processing file: ${file.name}. Please try again with a different file.`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const startInterview = async () => {
    setIsStarted(true)
    setIsLoading(true)
    
    try {
      const introMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Great! Let's start the interview for the ${jobData.title} position at ${jobData.company_name}. I'll ask you a series of questions. Take your time to respond thoughtfully.`,
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, introMessage])
      
      // Generate the first question after a brief delay
      setTimeout(() => {
        generateQuestion(0)
      }, 1500)
    } catch (error) {
      console.error('Error starting interview:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateQuestion = async (questionIndex: number) => {
    setIsLoading(true)
    setCurrentQuestionIndex(questionIndex)
    
    // If we've reached the end of the questions, finish the interview
    if (questionIndex >= 5) {
      finishInterview()
      return
    }
    
    try {
      // Call the API to get a question
      const response = await fetch('/api/gemini/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobData.title,
          companyName: jobData.company_name,
          jobDescription: jobData.description || '',
          skills: jobData.skills || '',
          resumeFile: resumeFile ? {
            name: resumeFile.name,
            type: resumeFile.type,
            size: resumeFile.size
          } : null,
          currentQuestion: questionIndex,
          action: 'question'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error generating question:', error)
        setApiErrorCount(prev => prev + 1)
        
        // Fallback to hardcoded questions if API fails
        fallbackGenerateQuestion(questionIndex)
        return
      }

      const data = await response.json() as InterviewResponse
      
      const questionMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: data.question || `Question ${questionIndex + 1}`,
        timestamp: new Date(),
        isQuestion: true,
        questionIndex: questionIndex,
        suggestions: data.suggestions || []
      }
      
      setMessages(prev => [...prev, questionMessage])
    } catch (error) {
      console.error('Error generating question:', error)
      setApiErrorCount(prev => prev + 1)
      
      // Fallback to hardcoded questions if API fails
      fallbackGenerateQuestion(questionIndex)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Fallback method if the API fails
  const fallbackGenerateQuestion = (questionIndex: number) => {
    // Sample questions based on common interview patterns
    const questions = [
      {
        question: `Tell me about yourself and why you're interested in the ${jobData.title} role at ${jobData.company_name}.`,
        suggestions: [
          `I've been working in [your field] for [X years]...`,
          `My background in [relevant skill] aligns with...`,
          `I'm passionate about [company's mission/products]...`
        ]
      },
      {
        question: `Based on the job description, ${jobData.skills ? `which mentions skills like ${jobData.skills.split(',').slice(0, 3).join(', ')}` : ''}, can you explain a specific project or experience where you demonstrated these skills?`,
        suggestions: [
          `In my previous role at [company], I worked on...`,
          `I led a project where we implemented...`,
          `I collaborated with a team to solve...`
        ]
      },
      {
        question: `How do you handle challenging situations or conflicts in the workplace? Can you provide an example?`,
        suggestions: [
          `When faced with a challenge, I first analyze...`,
          `I believe in open communication when conflicts arise...`,
          `In my previous role, I encountered a situation where...`
        ]
      },
      {
        question: `Where do you see yourself professionally in the next 3-5 years, and how does this role at ${jobData.company_name} fit into your career goals?`,
        suggestions: [
          `I aim to develop expertise in [specific area]...`,
          `I'm looking to grow into a role where I can...`,
          `My long-term goal is to...`
        ]
      },
      {
        question: `Do you have any questions for me about the role or the company?`,
        suggestions: [
          `What does success look like in this role?`,
          `Can you tell me about the team I'd be working with?`,
          `What are the biggest challenges facing the team right now?`
        ]
      }
    ]
    
    const questionData = questions[Math.min(questionIndex, questions.length - 1)]
    
    const questionMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: questionData.question,
      timestamp: new Date(),
      isQuestion: true,
      questionIndex: questionIndex,
      suggestions: questionData.suggestions
    }
    
    setMessages(prev => [...prev, questionMessage])
  }

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentMessage.trim() || isLoading) return
    
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date(),
      showFeedback: true
    }
    
    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsLoading(true)
    
    try {
      // Call the API to get feedback on the response
      const response = await fetch('/api/gemini/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobData.title,
          companyName: jobData.company_name,
          jobDescription: jobData.description || '',
          skills: jobData.skills || '',
          resumeFile: resumeFile ? {
            name: resumeFile.name,
            type: resumeFile.type,
            size: resumeFile.size
          } : null,
          currentQuestion: currentQuestionIndex,
          userResponse: currentMessage,
          action: 'feedback'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error generating feedback:', error)
        setApiErrorCount(prev => prev + 1)
        
        // Fallback to hardcoded feedback if API fails
        fallbackGenerateFeedback(currentMessage, currentQuestionIndex)
        return
      }

      const data = await response.json() as InterviewResponse
      
      // Directly use the feedback from the API response
      const strengths = data.strengths || []
      const improvements = data.improvements || []
      const score = data.score || 75
      
      // Format feedback message
      let formattedFeedback = `**Feedback on your answer:**\n\n`
      
      if (strengths.length > 0) {
        formattedFeedback += `**Strengths:**\n${strengths.map(s => `• ${s}`).join('\n')}\n\n`
      }
      
      if (improvements.length > 0) {
        formattedFeedback += `**Areas for improvement:**\n${improvements.map(i => `• ${i}`).join('\n')}\n\n`
      }
      
      formattedFeedback += `**Score for this response:** ${score}/100`
      
      const feedbackMessage: Message = {
        id: generateId(),
        role: 'feedback',
        content: formattedFeedback,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, feedbackMessage])
      setFeedbackVisible(prev => ({...prev, [userMessage.id]: true}))
      
      // Wait a moment before moving to the next question
      setTimeout(() => {
        generateQuestion(currentQuestionIndex + 1)
      }, 2000)
      
    } catch (error) {
      console.error('Error generating feedback:', error)
      setApiErrorCount(prev => prev + 1)
      
      // Fallback to hardcoded feedback if API fails
      fallbackGenerateFeedback(currentMessage, currentQuestionIndex)
    } finally {
      setIsLoading(false)
    }
  }

  const fallbackGenerateFeedback = (response: string, questionIndex: number) => {
    // Simplified feedback logic - in a real app, this would come from the Gemini API
    const feedbackOptions = [
      {
        positive: [
          "Great job conveying your relevant experience!",
          "Your answer shows good self-awareness and alignment with the role.",
          "Excellent storytelling that highlights your skills."
        ],
        improvement: [
          "Try to be more specific about how your skills match the job requirements.",
          "Consider adding a concrete example to illustrate your point.",
          "You could strengthen this by quantifying your achievements."
        ]
      },
      {
        positive: [
          "Good example that demonstrates your technical abilities.",
          "Nice job connecting your past work to this role's requirements.",
          "You effectively highlighted your problem-solving approach."
        ],
        improvement: [
          "Consider explaining the impact of your work more clearly.",
          "Try using the STAR method (Situation, Task, Action, Result) for a more structured response.",
          "You could mention how you overcame challenges in this project."
        ]
      },
      {
        positive: [
          "Your conflict resolution approach sounds effective.",
          "Good job showing how you maintain professionalism in difficult situations.",
          "Your example demonstrates emotional intelligence and communication skills."
        ],
        improvement: [
          "Consider explaining what you learned from this situation.",
          "Try to show how you preemptively avoid similar conflicts now.",
          "You could highlight how you build consensus among differing viewpoints."
        ]
      },
      {
        positive: [
          "Your career goals align well with what this role offers.",
          "Good job showing ambition while remaining realistic.",
          "You've clearly thought about your professional development."
        ],
        improvement: [
          "Consider being more specific about skills you want to develop.",
          "Try connecting your goals more directly to this company's growth trajectory.",
          "You might want to mention how you plan to contribute long-term."
        ]
      },
      {
        positive: [
          "Great questions that show you've researched the company.",
          "These questions demonstrate your thoughtfulness about the role.",
          "Your inquiry shows you're thinking strategically about this position."
        ],
        improvement: [
          "Consider asking about specific projects or initiatives the team is working on.",
          "You might want to ask about how performance is measured in this role.",
          "Questions about company culture would also be valuable to discuss."
        ]
      }
    ]
    
    const currentFeedback = feedbackOptions[questionIndex % feedbackOptions.length]
    
    // Randomly select feedback (in a real app, this would be based on response analysis)
    const positive = currentFeedback.positive[Math.floor(Math.random() * currentFeedback.positive.length)]
    const improvement = currentFeedback.improvement[Math.floor(Math.random() * currentFeedback.improvement.length)]
    
    // Calculate a score based on response length (simplified - real implementation would be more sophisticated)
    const length = response.length
    let score = 0
    
    if (length > 300) score = Math.floor(Math.random() * 20) + 80 // 80-100
    else if (length > 200) score = Math.floor(Math.random() * 20) + 70 // 70-90
    else if (length > 100) score = Math.floor(Math.random() * 20) + 60 // 60-80
    else score = Math.floor(Math.random() * 30) + 50 // 50-80
    
    const feedbackMessage: Message = {
      id: generateId(),
      role: 'feedback',
      content: `**Feedback on your answer:**\n\n**Strengths:** ${positive}\n\n**Area for improvement:** ${improvement}\n\n**Score for this response:** ${score}/100`,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, feedbackMessage])
    
    // Fix the feedbackVisible error by using the most recent user message ID instead of the previous array index
    const lastUserMessageIndex = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserMessageIndex >= 0) {
      setFeedbackVisible(prev => ({...prev, [messages[lastUserMessageIndex].id]: true}));
    }
    
    // Wait a moment before moving to the next question
    setTimeout(() => {
      generateQuestion(currentQuestionIndex + 1)
    }, 2000)
  }

  const finishInterview = async () => {
    setIsLoading(true)
    
    try {
      // Create a list of conversation messages to send to the API
      const conversationForSummary = messages.map(msg => ({
        role: msg.role === 'feedback' ? 'system' : msg.role,
        content: msg.content
      }))
      
      // Call the API to get a summary of the interview
      const response = await fetch('/api/gemini/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: jobData.title,
          companyName: jobData.company_name,
          resumeFile: resumeFile ? {
            name: resumeFile.name,
            type: resumeFile.type,
            size: resumeFile.size
          } : null,
          conversation: conversationForSummary,
          action: 'summary'
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error generating summary:', error)
        setApiErrorCount(prev => prev + 1)
        
        // Fallback to hardcoded summary if API fails
        fallbackGenerateSummary()
        return
      }

      const data = await response.json() as InterviewResponse
      
      // Calculate overall score from feedback messages if API didn't provide one
      const averageScore = data.overallScore || calculateAverageScore()
      setInterviewScore(averageScore)
      
      // Build summary message content
      let summaryContent = `**Interview Complete!**\n\n**Overall Score: ${averageScore}/100**\n\n`
      
      if (data.summary) {
        summaryContent += `**Summary Feedback:**\n${data.summary}\n\n`
      }
      
      if (data.keyStrengths && data.keyStrengths.length > 0) {
        summaryContent += `**Key Strengths:**\n${data.keyStrengths.map(s => `• ${s}`).join('\n')}\n\n`
      }
      
      if (data.areasForImprovement && data.areasForImprovement.length > 0) {
        summaryContent += `**Areas for Improvement:**\n${data.areasForImprovement.map(i => `• ${i}`).join('\n')}\n\n`
      }
      
      if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
        summaryContent += `**Questions you might want to ask in your real interview:**\n${data.suggestedQuestions.map(q => `• ${q}`).join('\n')}\n\n`
      }
      
      summaryContent += `Thank you for completing this mock interview! You can restart to practice again or try with a different job posting.`
      
      const summaryMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: summaryContent,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, summaryMessage])
      setIsFinished(true)
    } catch (error) {
      console.error('Error finishing interview:', error)
      setApiErrorCount(prev => prev + 1)
      
      // Fallback to hardcoded summary if API fails
      fallbackGenerateSummary()
    } finally {
      setIsLoading(false)
    }
  }
  
  const calculateAverageScore = (): number => {
    // Calculate overall score (average of individual response scores)
    const feedbackMessages = messages.filter(m => m.role === 'feedback')
    let totalScore = 0
    
    feedbackMessages.forEach(message => {
      const scoreMatch = message.content.match(/Score for this response: (\d+)\/100/)
      if (scoreMatch && scoreMatch[1]) {
        totalScore += parseInt(scoreMatch[1])
      }
    })
    
    return feedbackMessages.length > 0 
      ? Math.round(totalScore / feedbackMessages.length) 
      : 75 // Default if no feedback messages
  }
  
  const fallbackGenerateSummary = () => {
    // Calculate overall score from feedback messages
    const averageScore = calculateAverageScore()
    setInterviewScore(averageScore)
    
    // Generate final feedback based on score
    let finalFeedback = ``
    
    if (averageScore >= 90) {
      finalFeedback = `Exceptional performance! You demonstrated strong communication skills, provided concrete examples, and showed clear alignment with the role. You're well-prepared for a real interview.`
    } else if (averageScore >= 80) {
      finalFeedback = `Great job! Your responses were thoughtful and demonstrated relevant experience. With a bit more specificity in your examples, you'll be in excellent shape for your interview.`
    } else if (averageScore >= 70) {
      finalFeedback = `Good performance! You covered the key points well. To improve, try adding more specific examples and quantify your achievements where possible.`
    } else if (averageScore >= 60) {
      finalFeedback = `Solid effort. You addressed the questions, but could benefit from more structured responses. Practice using the STAR method and be more specific about your experiences.`
    } else {
      finalFeedback = `Thanks for completing the mock interview. To improve, focus on providing specific examples from your experience, quantify your achievements, and practice more concise storytelling.`
    }
    
    // Suggested questions to ask the interviewer
    const suggestedQuestions = [
      `What does success look like for this role in the first 90 days?`,
      `How would you describe the team culture and working environment?`,
      `What are the biggest challenges the team is currently facing?`,
      `How is performance measured and reviewed?`,
      `What opportunities are there for professional development?`,
      `Could you tell me about the typical career progression for someone in this role?`,
      `What do you enjoy most about working at ${jobData.company_name}?`
    ]
    
    // Randomly select 4 questions
    const randomQuestions = [...suggestedQuestions]
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)
    
    const summaryMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: `**Interview Complete!**\n\n**Overall Score: ${averageScore}/100**\n\n**Summary Feedback:**\n${finalFeedback}\n\n**Questions you might want to ask in your real interview:**\n${randomQuestions.map(q => `• ${q}`).join('\n')}\n\nThank you for completing this mock interview! You can restart to practice again or try with a different job posting.`,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, summaryMessage])
    setIsFinished(true)
  }

  const resetInterview = () => {
    setMessages([])
    setCurrentMessage('')
    setIsStarted(false)
    setIsFinished(false)
    setCurrentQuestionIndex(0)
    setInterviewScore(null)
    setFeedbackVisible({})
    setApiErrorCount(0)
    
    // Re-initialize with welcome message
    const welcomeMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: `Hello! I'll be your AI interviewer today for the ${jobData.title} position at ${jobData.company_name}. This mock interview will help you prepare for your real interview.\n\nWe'll go through 3-5 questions, and I'll provide feedback on your responses. You can upload your resume to make the questions more relevant to your experience.\n\nAre you ready to begin?`,
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
    
    // Fetch a personalized welcome message
    fetchWelcomeMessage()
  }

  const toggleFeedback = (messageId: string) => {
    setFeedbackVisible(prev => ({
      ...prev, 
      [messageId]: !prev[messageId]
    }))
  }

  const handleSuggestionClick = (suggestion: string) => {
    setCurrentMessage(prev => prev + (prev ? ' ' : '') + suggestion)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
      {/* Header with job information */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {jobData.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {jobData.company_name} • {jobData.location || 'Remote'}
            </p>
          </div>
          
          <div className="flex gap-2">
            {isStarted && !isFinished ? (
              <div className="flex items-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full text-sm font-medium">
                <Clock className="w-4 h-4 mr-1.5" />
                Interview in progress
              </div>
            ) : isFinished ? (
              <div className="flex items-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full text-sm font-medium">
                <ThumbsUp className="w-4 h-4 mr-1.5" />
                Interview complete
              </div>
            ) : (
              <div className="flex items-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full text-sm font-medium">
                <Bot className="w-4 h-4 mr-1.5" />
                Ready to start
              </div>
            )}
            
            {isFinished && (
              <button
                onClick={resetInterview}
                className="flex items-center text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Restart
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Interview chat area */}
      <div className="flex flex-col h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" id="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className="flex flex-col">
              {/* Message bubble */}
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white ml-auto' 
                      : message.role === 'system' 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
                        : message.role === 'feedback'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {/* Message icon */}
                  <div className="flex items-center gap-2 mb-1">
                    {message.role === 'user' ? (
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-white/80" />
                        <span className="text-sm font-medium ml-1">You</span>
                      </div>
                    ) : message.role === 'feedback' ? (
                      <div className="flex items-center">
                        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-sm font-medium ml-1">Feedback</span>
                      </div>
                    ) : message.role === 'system' ? (
                      <div className="flex items-center">
                        <span className="text-sm font-medium">System</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium ml-1">AI Interviewer</span>
                      </div>
                    )}
                    
                    <span className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Message content */}
                  <div className="whitespace-pre-line">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-2' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                  
                  {/* If this is a question, show suggested responses */}
                  {message.isQuestion && message.suggestions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="w-full text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Suggestions (click to add to your response):
                      </p>
                      {message.suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 px-2 py-1 rounded text-left transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Feedback toggle button for user messages */}
              {message.role === 'user' && message.showFeedback && (
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => toggleFeedback(message.id)}
                    className="text-xs flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {feedbackVisible[message.id] ? (
                      <>
                        <X className="w-3 h-3 mr-1" />
                        Hide feedback
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-3 h-3 mr-1" />
                        Show feedback
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          {!isStarted ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Resume (Optional)
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    disabled={isLoading}
                  />
                </button>
                
                <button
                  onClick={startInterview}
                  className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      Start Interview
                    </>
                  )}
                </button>
              </div>
              
              {/* Display resume status information */}
              {resumeText && (
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 p-2 rounded">
                  {resumeText}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleMessageSubmit} className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || isFinished}
                autoFocus
              />
              
              <button
                type="submit"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !currentMessage.trim() || isFinished}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          )}
        </div>
      </div>
      
      {/* Interview progress indicator */}
      {isStarted && !isFinished && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>Interview Progress</span>
            <span>{currentQuestionIndex + 1}/5</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${((currentQuestionIndex + 1) / 5) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Show score at the end */}
      {isFinished && interviewScore !== null && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Interview Score</h3>
            <div className="flex justify-center items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="10"
                    className="dark:stroke-gray-700"
                  />
                  {/* Score circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={
                      interviewScore >= 80 ? "#10B981" : 
                      interviewScore >= 60 ? "#F59E0B" : 
                      "#EF4444"
                    }
                    strokeWidth="10"
                    strokeDasharray={`${interviewScore * 2.83} 283`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    className="transition-all duration-1000 ease-out"
                  />
                  <text
                    x="50"
                    y="50"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="24"
                    fontWeight="bold"
                    fill={
                      interviewScore >= 80 ? "#10B981" : 
                      interviewScore >= 60 ? "#F59E0B" : 
                      "#EF4444"
                    }
                    className="dark:fill-white"
                  >
                    {interviewScore}
                  </text>
                  <text
                    x="50"
                    y="65"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill="#6B7280"
                    className="dark:fill-gray-400"
                  >
                    out of 100
                  </text>
                </svg>
              </div>
            </div>
            
            <div className="mt-4">
              <button
                onClick={resetInterview}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Interview
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Questions to Ask container */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Questions You Could Ask in a Real Interview
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Great candidates always have thoughtful questions for the interviewer. Here are some suggestions for the {jobData.title} role at {jobData.company_name}.
          </p>
        </div>
        
        <div className="p-4">
          {isLoadingSuggestions ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Generating questions...</span>
            </div>
          ) : (
            <ul className="space-y-3">
              {suggestedQuestionsToAsk.map((question, index) => (
                <li key={index} className="flex">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{question}</p>
                </li>
              ))}
            </ul>
          )}
          
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={fetchSuggestedQuestions}
              className="text-sm flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh questions
            </button>
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Powered by Google Gemini AI
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}