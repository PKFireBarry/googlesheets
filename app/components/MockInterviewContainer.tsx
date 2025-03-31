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
  RefreshCw,
  FileUp,
  FileText,
  Check,
  Trash2,
  MessageSquare,
  Info,
  Loader
} from 'lucide-react'
import { loadResume, deleteResume, resumeExists, saveResume } from '../utils/resumeStorage'
import { prepareResumeTextForAPI } from '../utils/resumeAdapter'
import { toast } from 'react-hot-toast'
import ResumeStorageUI from './ResumeStorageUI'
import Cookies from 'js-cookie'

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
  resumeHighlights?: string[];
}

interface MockInterviewContainerProps {
  jobData: Job;
}

export default function MockInterviewContainer({ jobData }: MockInterviewContainerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState<string | null>(null)
  const [resumeBase64, setResumeBase64] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [interviewScore, setInterviewScore] = useState<number | null>(null)
  const [feedbackVisible, setFeedbackVisible] = useState<{[key: string]: boolean}>({})
  const [apiErrorCount, setApiErrorCount] = useState(0)
  const [suggestedQuestionsToAsk, setSuggestedQuestionsToAsk] = useState<string[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [hasResume, setHasResume] = useState(false)
  const [interviewerType, setInterviewerType] = useState('technical')
  const [questionCount, setQuestionCount] = useState(5)
  const [apiKey, setApiKey] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Start the interview with a welcome message
  useEffect(() => {
    if (jobData && !interviewStarted) {
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
  }, [jobData, interviewStarted])

  useEffect(() => {
    // Fetch suggested questions when the component loads
    fetchSuggestedQuestions()
  }, [jobData]) // Re-fetch if job data changes

  // Check for a shared resume and API key
  useEffect(() => {
    // Check if a resume exists
    if (resumeExists()) {
      const { resumeData, resumePdfData } = loadResume();
      if (resumeData || resumePdfData) {
        setHasResume(true);
        toast.success("Your resume is available for this interview", {
          icon: "📄",
          position: "bottom-right",
          duration: 3000,
        });
      }
    }
    
    // Load API key from cookies
    const savedApiKey = Cookies.get("geminiApiKey");
    if (savedApiKey) {
      setApiKey(savedApiKey);
      console.log("API key loaded from cookies");
    } else {
      // Try to load from localStorage as fallback
      const localStorageApiKey = localStorage.getItem("geminiApiKey");
      if (localStorageApiKey) {
        setApiKey(localStorageApiKey);
        console.log("API key loaded from localStorage");
      }
    }
  }, []);
  
  // Handle using the shared resume
  const useSharedResume = () => {
    if (resumeExists()) {
      const { resumeData, resumePdfData } = loadResume();
      
      if (resumePdfData) {
        setResumeBase64(resumePdfData);
        setResumeText('Using shared PDF resume');
      } else if (resumeData) {
        const resumeText = prepareResumeTextForAPI(resumeData, null);
        if (resumeText) {
          const base64Encoded = btoa(unescape(encodeURIComponent(resumeText)));
          setResumeBase64(base64Encoded);
          setResumeText('Using shared resume');
        }
      }
      
      // Add a confirmation message
      const message: Message = {
        id: generateId(),
        role: 'system',
        content: 'Using your shared resume for this interview.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, message]);
      toast.success('Using your shared resume for this interview');
    }
  };
  
  // Handle removing the shared resume
  const removeSharedResume = () => {
    setResumeFile(null);
    setResumeBase64(null);
    setResumeText(null);
    
    const message: Message = {
      id: generateId(),
      role: 'system',
      content: 'Resume removed. The interview will not use resume information.',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
    toast.success('Resume removed from this interview');
  };

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
          resumeData: resumeBase64,
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
      // Convert the file to base64 format
      const base64Data = await readFileAsBase64(file)
      setResumeBase64(base64Data)
      
      const sizeInKb = (file.size / 1024).toFixed(2);
      const fileInfoText = `Resume "${file.name}" (${sizeInKb} KB) uploaded successfully`;
      setResumeText(fileInfoText);
      
      // Save to shared storage
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        // For PDF files, we store the base64 data
        saveResume(null, base64Data);
        toast.success('Resume saved to shared storage');
      } else {
        // For text-based files, we might attempt to parse it in the future
        // For now, we just store it as PDF data
        saveResume(null, base64Data);
        toast.success('Resume saved to shared storage');
      }
      
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
      toast.error('Failed to process resume file');
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to convert a file to base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Extract the base64 content from the data URL
          const base64Content = reader.result.split(',')[1]
          resolve(base64Content)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const startInterview = async () => {
    setInterviewStarted(true)
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
          resumeData: resumeBase64,
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
          resumeData: resumeBase64,
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
          resumeData: resumeBase64,
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
      
      // Add resume highlights section if available and resume was uploaded
      if (resumeFile && data.resumeHighlights && data.resumeHighlights.length > 0) {
        summaryContent += `**Resume Highlights:**\n${data.resumeHighlights.map(r => `• ${r}`).join('\n')}\n\n`
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
    setInterviewStarted(false)
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
    <div className="flex flex-col md:flex-row gap-4 overflow-hidden">
      {/* Main interview panel */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
        {/* Header with job information */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-3 sm:p-4 text-white rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">
                {jobData.title}
              </h2>
              <p className="text-xs sm:text-sm text-blue-100">
                {jobData.company_name} • {jobData.location || 'Remote'}
              </p>
            </div>
            
            <div className="flex gap-2">
              {interviewStarted && !isFinished ? (
                <div className="flex items-center bg-white/20 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  Interview in progress
                </div>
              ) : isFinished ? (
                <div className="flex items-center bg-green-500/20 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">
                  <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  Complete
                </div>
              ) : (
                <div className="flex items-center bg-white/20 px-2 py-1 rounded-full text-xs sm:text-sm font-medium">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  Ready to start
                </div>
              )}
              
              {isFinished && (
                <button
                  onClick={resetInterview}
                  className="flex items-center bg-white/10 hover:bg-white/20 px-2 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                  Restart
                </button>
              )}
            </div>
          </div>
          
          {/* Progress bar for interview questions */}
          {interviewStarted && !isFinished && (
            <div className="mt-3">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="bg-white h-1.5 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${((currentQuestionIndex + 1) / questionCount) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-blue-100">Question {currentQuestionIndex + 1}/{questionCount}</span>
                <span className="text-xs text-blue-100">{Math.round(((currentQuestionIndex + 1) / questionCount) * 100)}% complete</span>
              </div>
            </div>
          )}
        </div>

        {/* Interview chat area */}
        <div className="flex flex-col h-[calc(100vh-450px)] sm:h-[55vh]">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3" id="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                {/* Message bubble */}
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white ml-auto' 
                        : message.role === 'system' 
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
                          : message.role === 'feedback'
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {/* Message icon */}
                    <div className="flex items-center gap-2 mb-1">
                      {message.role === 'user' ? (
                        <div className="flex items-center">
                          <User className="w-3 h-3 sm:w-4 sm:h-4 text-white/80" />
                          <span className="text-xs sm:text-sm font-medium ml-1">You</span>
                        </div>
                      ) : message.role === 'feedback' ? (
                        <div className="flex items-center">
                          <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs sm:text-sm font-medium ml-1">Feedback</span>
                        </div>
                      ) : message.role === 'system' ? (
                        <div className="flex items-center">
                          <span className="text-xs sm:text-sm font-medium">System</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                          <span className="text-xs sm:text-sm font-medium ml-1">AI Interviewer</span>
                        </div>
                      )}
                      
                      <span className="text-[10px] sm:text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    {/* Message content */}
                    <div className="whitespace-pre-line text-xs sm:text-sm">
                      {message.content.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                    
                    {/* If this is a question, show suggested responses */}
                    {message.isQuestion && message.suggestions && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <p className="w-full text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Suggestions (click to add to your response):
                        </p>
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-[10px] sm:text-xs bg-white/20 dark:bg-black/20 hover:bg-white/30 dark:hover:bg-black/30 px-1.5 py-0.5 rounded text-left transition-colors"
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
                      className="text-[10px] sm:text-xs flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      {feedbackVisible[message.id] ? (
                        <>
                          <X className="w-3 h-3 mr-1" />
                          Hide feedback
                        </>
                      ) : (
                        <>
                          <Lightbulb className="w-3 h-3 mr-1" />
                          View feedback
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Feedback message if toggled */}
                {message.role === 'user' && message.showFeedback && feedbackVisible[message.id] && (
                  <div className="ml-4 mt-2 mb-2">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="flex items-center mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mr-1.5" />
                        <h3 className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300">
                          Interview Feedback
                        </h3>
                      </div>
                      
                      {/* Find the feedback message that corresponds to this question */}
                      {messages.find(m => 
                        m.role === 'feedback' && 
                        m.questionIndex === message.questionIndex
                      )?.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message input */}
          {interviewStarted && !isFinished && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleMessageSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type your response..."
                  className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm dark:bg-gray-700 dark:text-white"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !currentMessage.trim()}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Interview start UI */}
          {!interviewStarted && (
            <div className="p-3 sm:p-5">
              <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 sm:p-5 border border-blue-100 dark:border-blue-800 max-w-2xl mx-auto">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Practice Interview for {jobData.title}
                </h3>
                
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This AI interviewer will ask you {questionCount} questions based on the job description. 
                  Upload your resume to get personalized questions and feedback.
                </p>
                
                <div className="mb-4">
                  <div className="mb-4">
                    {resumeText ? (
                      <div className="flex items-center justify-between bg-blue-100 dark:bg-blue-800/30 p-2 rounded-md">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
                          <span className="text-sm text-blue-700 dark:text-blue-300 truncate max-w-[200px]">
                            {resumeText}
                          </span>
                        </div>
                        <button
                          onClick={removeSharedResume}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      hasResume ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                            <div className="flex items-center">
                              <Info className="w-4 h-4 text-gray-600 dark:text-gray-400 mr-2" />
                              <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                                You have a resume available
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={useSharedResume}
                            className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                          >
                            <FileText className="w-4 h-4 mr-1.5" />
                            Use Your Saved Resume
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center justify-center px-3 py-1.5 w-full sm:w-auto border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Upload className="w-4 h-4 mr-1.5" />
                            Upload Resume (Optional)
                          </button>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF format only, max 5MB
                          </p>
                        </div>
                      )
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Interviewer Style
                      </label>
                      <select
                        value={interviewerType}
                        onChange={(e) => setInterviewerType(e.target.value)}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                      >
                        <option value="technical">Technical Interviewer</option>
                        <option value="hr">HR / Recruiter</option>
                        <option value="manager">Hiring Manager</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Interview Length
                      </label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                      >
                        <option value="3">Short (3 questions)</option>
                        <option value="5">Standard (5 questions)</option>
                        <option value="7">Extended (7 questions)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key <span className="text-gray-500 dark:text-gray-400 font-normal">(required)</span>
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm dark:bg-gray-700 dark:text-white"
                      placeholder="Enter your Gemini API key"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Need an API key? Get one from{" "}
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Google AI Studio
                      </a>
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-center pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={startInterview}
                    disabled={isLoading || !apiKey}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Start Interview
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Show score at the end */}
          {isFinished && interviewScore !== null && (
            <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">Interview Score</h3>
                <div className="flex justify-center items-center">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28">
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
                
                <div className="mt-3">
                  <button
                    onClick={resetInterview}
                    className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Restart Interview
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Questions to Ask sidebar */}
      <div className="md:w-80 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 md:flex-shrink-0 h-fit">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 p-3 rounded-t-xl">
          <h2 className="text-sm sm:text-base font-semibold text-white flex items-center">
            <Lightbulb className="w-4 h-4 mr-1.5 text-white/80" />
            Questions to Ask the Interviewer
          </h2>
          <p className="text-xs text-blue-100 mt-0.5">
            For the {jobData.title} role at {jobData.company_name}
          </p>
        </div>
        
        <div className="p-3">
          {isLoadingSuggestions ? (
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Generating questions...</span>
            </div>
          ) : (
            <ul className="space-y-2">
              {suggestedQuestionsToAsk.map((question, index) => (
                <li key={index} className="flex text-xs sm:text-sm">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-xs font-medium text-blue-800 dark:text-blue-300">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{question}</p>
                </li>
              ))}
            </ul>
          )}
          
          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={fetchSuggestedQuestions}
              className="text-xs flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh questions
            </button>
            
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              Powered by Google Gemini
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}