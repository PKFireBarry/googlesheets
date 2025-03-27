import { NextRequest, NextResponse } from 'next/server';

// Gemini API Configuration
const GEMINI_MODEL = 'gemini-2.0-flash';

interface InterviewRequest {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  skills?: string;
  resume?: string;
  resumeFile?: {
    name: string;
    type: string;
    size: number;
  };
  currentQuestion?: number;
  userResponse?: string;
  conversation?: ConversationMessage[];
  action: 'start' | 'question' | 'feedback' | 'summary' | 'questions';
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Define types for the parsed responses
 */
interface QuestionResponse {
  question: string;
  suggestions: string[];
}

interface FeedbackResponse {
  feedback: string;
  strengths: string[];
  improvements: string[];
  score: number;
}

interface SummaryResponse {
  summary: string;
  overallScore: number;
  keyStrengths: string[];
  areasForImprovement: string[];
  suggestedQuestions: string[];
}

// Add a new interface for the questions response
interface QuestionsToAskResponse {
  questions: string[];
}

/**
 * POST handler for Gemini Interview API
 * This processes mock interview data using Google's Gemini Flash 2.0 model
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json() as InterviewRequest;
    
    // Extract data from the request
    const { 
      jobTitle, 
      companyName, 
      jobDescription, 
      skills, 
      resume, 
      resumeFile,
      currentQuestion, 
      userResponse, 
      conversation, 
      action 
    } = body;
    
    // Use provided API key or environment variable
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is required. Please provide it in your environment variables.' },
        { status: 400 }
      );
    }
    
    // Log API request (securely)
    console.log(`Interview API request: action=${action}, company=${companyName}, job=${jobTitle}`);
    
    // Create the API URL with the API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;
    
    // Build appropriate prompt based on the action
    let prompt = '';
    
    switch (action) {
      case 'start':
        prompt = buildStartPrompt(jobTitle, companyName, jobDescription, skills, resume, resumeFile);
        break;
      case 'question':
        prompt = buildQuestionPrompt(jobTitle, companyName, jobDescription, skills, currentQuestion, resumeFile);
        break;
      case 'feedback':
        prompt = buildFeedbackPrompt(jobTitle, companyName, jobDescription, skills, currentQuestion, userResponse, resumeFile);
        break;
      case 'summary':
        prompt = buildSummaryPrompt(jobTitle, companyName, conversation);
        break;
      case 'questions':
        prompt = buildQuestionsToAskPrompt(jobTitle, companyName, jobDescription, skills);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
    
    // Make the API call to Gemini
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5,
          topP: 0.8,
          topK: 40
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      
      return NextResponse.json(
        { error: `Gemini API error: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Extract the text from the Gemini response
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Process the response based on the action
    let result;
    
    switch (action) {
      case 'start':
        result = {
          welcomeMessage: generatedText
        };
        break;
      case 'question':
        try {
          const parsedResponse = parseQuestionResponse(generatedText);
          result = parsedResponse;
        } catch (error) {
          console.error('Error parsing question response:', error);
          result = {
            question: generatedText,
            suggestions: []
          };
        }
        break;
      case 'feedback':
        try {
          const parsedFeedback = parseFeedbackResponse(generatedText);
          result = parsedFeedback;
        } catch (error) {
          console.error('Error parsing feedback response:', error);
          result = {
            feedback: generatedText,
            strengths: [],
            improvements: [],
            score: 75
          };
        }
        break;
      case 'summary':
        try {
          const parsedSummary = parseSummaryResponse(generatedText);
          result = parsedSummary;
        } catch (error) {
          console.error('Error parsing summary response:', error);
          result = {
            summary: generatedText,
            overallScore: 75,
            suggestions: []
          };
        }
        break;
      case 'questions':
        try {
          const parsedQuestions = parseQuestionsToAskResponse(generatedText);
          result = parsedQuestions;
        } catch (error) {
          console.error('Error parsing questions response:', error);
          result = {
            questions: generatedText.split('\n').filter((line: string) => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map((line: string) => line.trim().replace(/^[•\-\d.]+\s*/, '').trim())
          };
        }
        break;
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Build a prompt for starting the interview
 */
function buildStartPrompt(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  skills?: string,
  resume?: string,
  resumeFile?: { name: string; type: string; size: number; }
): string {
  return `You are an AI interviewer conducting a mock job interview for a candidate. 
The job details are:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${resume ? `Candidate's Resume: ${resume}` : ''}
${resumeFile ? `Resume file information: ${resumeFile.name} (${resumeFile.type}, ${Math.round(resumeFile.size/1024)} KB)` : ''}

Create a personalized welcome message to start the mock interview. Introduce yourself as an AI interviewer and explain that you'll be asking questions related to the ${jobTitle} position at ${companyName}. Tell the candidate you'll be asking 3-5 questions and will provide feedback on their responses. The goal is to help them prepare for a real interview.

${resumeFile ? 'Please mention that you can see they\'ve uploaded their resume and you\'ll tailor the interview questions based on their experience.' : ''}

Keep your response conversational, encouraging, and within 150 words.`;
}

/**
 * Build a prompt for generating an interview question
 */
function buildQuestionPrompt(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  skills?: string,
  questionNumber?: number,
  resumeFile?: { name: string; type: string; size: number; }
): string {
  const questionIndex = questionNumber || 0;

  let questionFocus = '';
  
  // Determine question focus based on the question number
  if (questionIndex === 0) {
    questionFocus = 'Ask them to introduce themselves and why they are interested in this role.';
  } else if (questionIndex === 1) {
    questionFocus = `Ask about their relevant experience and skills for this role. Specifically reference the skills: ${skills || 'required for this position'}.`;
  } else if (questionIndex === 2) {
    questionFocus = 'Ask about how they handle challenges or difficult situations at work. Request a specific example.';
  } else if (questionIndex === 3) {
    questionFocus = 'Ask about their career goals and how this position fits into their professional development.';
  } else {
    questionFocus = 'Ask if they have any questions about the role or company (this is the final question).';
  }

  return `You are an AI interviewer conducting a mock job interview for the position of ${jobTitle} at ${companyName}.

Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${resumeFile ? `The candidate has uploaded their resume: ${resumeFile.name} (${resumeFile.type}, ${Math.round(resumeFile.size/1024)} KB).` : ''}

This is question #${questionIndex + 1} in the interview.

${questionFocus}

${resumeFile ? 'Since the candidate has uploaded their resume, tailor this question to be relevant to their background. Mention that you know they have experience related to this role.' : ''}

Please format your response as JSON with the following structure:
{
  "question": "Your detailed interview question",
  "suggestions": [
    "Suggestion 1 for how the candidate might start their answer",
    "Suggestion 2 for how the candidate might start their answer",
    "Suggestion 3 for how the candidate might start their answer"
  ]
}`;
}

/**
 * Build a prompt for generating feedback on an interview response
 */
function buildFeedbackPrompt(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  skills?: string,
  questionNumber?: number,
  userResponse?: string,
  resumeFile?: { name: string; type: string; size: number; }
): string {
  const questionIndex = questionNumber || 0;
  
  // Generate different questions based on the question number
  let question = '';
  
  if (questionIndex === 0) {
    question = `Tell me about yourself and why you're interested in the ${jobTitle} role at ${companyName}.`;
  } else if (questionIndex === 1) {
    question = `What relevant experience and skills do you have for this ${jobTitle} role?`;
  } else if (questionIndex === 2) {
    question = `How do you handle challenges or difficult situations at work? Please provide a specific example.`;
  } else if (questionIndex === 3) {
    question = `What are your career goals and how does this position fit into your professional development?`;
  } else {
    question = `Do you have any questions about the role or company?`;
  }

  return `You are an AI interviewer conducting a mock job interview for the position of ${jobTitle} at ${companyName}.

Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${resumeFile ? `The candidate has uploaded their resume: ${resumeFile.name} (${resumeFile.type}, ${Math.round(resumeFile.size/1024)} KB).` : ''}

The current question (#${questionIndex + 1}) is: "${question}"

The candidate's response is:
"${userResponse || ''}"

${resumeFile ? "Since the candidate has uploaded their resume, reference their background and experience in your feedback if it is relevant to their answer." : ""}

Analyze the response and provide constructive feedback. Include:
1. 2-3 specific strengths of their answer
2. 2-3 specific suggestions for improvement
3. A score from 0-100 based on clarity, relevance, and completeness

Please format your response as JSON with the following structure:
{
  "feedback": "Your overall feedback (2-3 sentences)",
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "Specific strength 3"
  ],
  "improvements": [
    "Specific improvement suggestion 1",
    "Specific improvement suggestion 2",
    "Specific improvement suggestion 3"
  ],
  "score": 85
}`;
}

/**
 * Build a prompt for generating a summary of the interview
 */
function buildSummaryPrompt(
  jobTitle: string, 
  companyName: string, 
  conversation?: ConversationMessage[]
): string {
  // Extract just the questions and answers for brevity
  const interviewHighlights = conversation 
    ? conversation
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.content.includes('?')))
        .map(msg => `${msg.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
        .join('\n\n')
    : 'No conversation provided.';

  return `You are an AI interviewer that just conducted a mock job interview for the position of ${jobTitle} at ${companyName}.

Here are highlights from the interview:

${interviewHighlights}

Please provide a summary of the interview and overall feedback for the candidate. Format your response as JSON:

{
  "summary": "Your overall assessment of the candidate's interview performance",
  "overallScore": 82, // A score from 50-100 representing the candidate's overall performance
  "keyStrengths": [
    "Key strength 1 demonstrated during the interview",
    "Key strength 2 demonstrated during the interview"
  ],
  "areasForImprovement": [
    "Area for improvement 1",
    "Area for improvement 2"
  ],
  "suggestedQuestions": [
    "A good question the candidate could ask in a real interview",
    "Another good question the candidate could ask",
    "A third good question the candidate could ask",
    "A fourth good question the candidate could ask"
  ]
}

Provide thoughtful, specific feedback that will help the candidate in their real job interview. For suggested questions, provide 4 questions that would be impressive to ask in a real interview for this specific role and company.`;
}

/**
 * Build a prompt for generating suggested questions to ask the interviewer
 */
function buildQuestionsToAskPrompt(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  skills?: string
): string {
  return `You are an AI assistant helping a job candidate prepare for an interview for the position of ${jobTitle} at ${companyName}.

Job Details:
- Job Title: ${jobTitle}
- Company: ${companyName}
- Job Description: ${jobDescription}
${skills ? `- Required Skills: ${skills}` : ''}

Generate a list of 7 thoughtful, specific questions that the candidate should consider asking during their interview. These questions should demonstrate the candidate's interest in the role, understanding of the company, and curiosity about growth opportunities.

Include questions about:
1. The team and work environment
2. Expected responsibilities and success metrics
3. Growth opportunities and career progression
4. Company culture and values
5. Technical challenges the team is facing
6. Onboarding process
7. Next steps in the hiring process

Format your response as JSON with the following structure:
{
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?",
    "Question 4?",
    "Question 5?",
    "Question 6?",
    "Question 7?"
  ]
}`;
}

/**
 * Parse the question response from Gemini
 */
function parseQuestionResponse(response: string): QuestionResponse {
  try {
    // Find JSON content
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonContent = jsonMatch[0];
      return JSON.parse(jsonContent);
    }
    
    // Fallback if no JSON found
    return {
      question: response,
      suggestions: []
    };
  } catch (error) {
    console.error('Error parsing question JSON:', error);
    throw error;
  }
}

/**
 * Parse the feedback response from Gemini
 */
function parseFeedbackResponse(response: string): FeedbackResponse {
  try {
    // Find JSON content
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonContent = jsonMatch[0];
      return JSON.parse(jsonContent);
    }
    
    // Fallback if no JSON found
    return {
      feedback: response,
      strengths: [],
      improvements: [],
      score: 75
    };
  } catch (error) {
    console.error('Error parsing feedback JSON:', error);
    throw error;
  }
}

/**
 * Parse the summary response from Gemini
 */
function parseSummaryResponse(response: string): SummaryResponse {
  try {
    // Find JSON content
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonContent = jsonMatch[0];
      return JSON.parse(jsonContent);
    }
    
    // Fallback if no JSON found
    return {
      summary: response,
      overallScore: 75,
      keyStrengths: [],
      areasForImprovement: [],
      suggestedQuestions: []
    };
  } catch (error) {
    console.error('Error parsing summary JSON:', error);
    throw error;
  }
}

/**
 * Parse the questions to ask response from Gemini
 */
function parseQuestionsToAskResponse(response: string): QuestionsToAskResponse {
  try {
    // Find JSON content
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonContent = jsonMatch[0];
      return JSON.parse(jsonContent);
    }
    
    // Fallback if no JSON found - extract questions from bullet points
    const questions = response.split('\n')
      .filter((line: string) => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map((line: string) => line.trim().replace(/^[•\-\d.]+\s*/, '').trim());
    
    return {
      questions: questions.length > 0 ? questions : [
        "What does success look like for this role in the first 90 days?",
        "How would you describe the team culture and working environment?",
        "What are the biggest challenges the team is currently facing?",
        "How is performance measured and reviewed for this role?",
        "What opportunities are there for professional development?",
        "Could you tell me about the typical career progression for someone in this role?",
        "What are the next steps in the hiring process?"
      ]
    };
  } catch (error) {
    console.error('Error parsing questions JSON:', error);
    throw error;
  }
} 