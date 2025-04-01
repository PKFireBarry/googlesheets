export interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
  location?: string;
  skills?: string;
  [key: string]: string | undefined;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'feedback';
  content: string;
  timestamp: Date;
  showFeedback?: boolean;
  suggestions?: string[];
  isQuestion?: boolean;
  questionIndex?: number;
}

export interface InterviewResponse {
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
  questions?: string[];
}

export interface InterviewState {
  messages: Message[];
  currentMessage: string;
  isLoading: boolean;
  interviewStarted: boolean;
  isFinished: boolean;
  currentQuestionIndex: number;
  interviewScore: number | null;
  feedbackVisible: {[key: string]: boolean};
  apiErrorCount: number;
  suggestedQuestionsToAsk: string[];
  isLoadingSuggestions: boolean;
}

export interface ResumeState {
  resumeFile: File | null;
  resumeText: string | null;
  resumeBase64: string | null;
  hasResume: boolean;
}

export interface InterviewSettings {
  interviewerType: string;
  questionCount: number;
  apiKey: string;
}

export interface FileInfo {
  name: string;
  type: string;
  size: number;
} 