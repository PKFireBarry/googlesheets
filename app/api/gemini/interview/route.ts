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
  resumeData?: string;
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
  resumeHighlights?: string[];
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
      resumeData,
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
    const hasResumeData = !!resumeData;
    
    // Call the API based on whether we have resume data
    if (hasResumeData && resumeFile) {
      console.log(`Processing with resume: ${resumeFile.name} (${resumeFile.size} bytes)`);
      
      // If we have resume data, we need to call the Gemini API with the PDF data
      switch (action) {
        case 'start':
          return await handleWithResumeData(apiUrl, geminiApiKey, action, buildStartPrompt(jobTitle, companyName, jobDescription, skills, resume, resumeFile), resumeData);
        case 'question':
          return await handleWithResumeData(apiUrl, geminiApiKey, action, buildQuestionPrompt(jobTitle, companyName, jobDescription, skills, currentQuestion, resumeFile), resumeData);
        case 'feedback':
          return await handleWithResumeData(apiUrl, geminiApiKey, action, buildFeedbackPrompt(jobTitle, companyName, jobDescription, skills, currentQuestion, userResponse, resumeFile), resumeData);
        case 'summary':
          return await handleWithResumeData(apiUrl, geminiApiKey, action, buildSummaryPrompt(jobTitle, companyName, conversation, resumeFile), resumeData);
        case 'questions':
          prompt = buildQuestionsToAskPrompt(jobTitle, companyName, jobDescription, skills);
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid action specified' },
            { status: 400 }
          );
      }
    } else {
      // Regular text-based prompt if no PDF data
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
          prompt = buildSummaryPrompt(jobTitle, companyName, conversation, resumeFile);
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
    }
    
    // If we reach here, we're handling a text-based prompt (no PDF)
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
 * Handle API requests with resume data (similar to cover letter generator)
 */
async function handleWithResumeData(apiUrl: string, apiKey: string, action: string, prompt: string, resumeData?: string) {
  try {
    // Create the request with multipart structure for the PDF data
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }, // Text prompt first
              resumeData ? { // Then PDF data if available
                inlineData: {
                  mimeType: 'application/pdf',
                  data: resumeData
                }
              } : undefined
            ].filter(Boolean) // Remove undefined parts
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
      console.error('Gemini API error with resume data:', errorData);
      
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
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error processing with Gemini and resume data:', error);
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
  let prompt = `You are an AI interviewer conducting a mock job interview for a candidate. 
The job details are:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}
${resume ? `Candidate's Resume: ${resume}` : ''}`;

  if (resumeFile) {
    prompt += `\n\nThe candidate has uploaded their resume (${resumeFile.name}). 
Please analyze the resume to personalize this interview to their background and skills.`;
  }

  prompt += `\n\nYour task is to:
1. Introduce yourself as an AI interviewer for ${companyName}
2. Welcome the candidate in a friendly, professional tone
3. Briefly explain how the mock interview will work (3-5 questions, with feedback)
4. Encourage them to take their time to respond thoughtfully
5. Ask if they're ready to begin the interview

Respond as if you are directly addressing the candidate in a conversational tone.`;

  return prompt;
}

/**
 * Build a prompt for generating interview questions
 */
function buildQuestionPrompt(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  skills?: string,
  questionNumber?: number,
  resumeFile?: { name: string; type: string; size: number; }
): string {
  let prompt = `You are an AI interviewer conducting a mock job interview. 
The job details are:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}`;

  if (resumeFile) {
    prompt += `\n\nThe candidate has uploaded their resume (${resumeFile.name}). 
Please analyze the resume to:
1. Tailor this question to their background and experience
2. Generate sample response suggestions that incorporate specific details from their resume
3. Reference their actual work history, skills, and achievements in the suggestions`;
  }

  prompt += `\n\nYou are now on question ${questionNumber !== undefined ? questionNumber + 1 : 1} of the mock interview.

Analyze the job description and required skills, then generate a relevant interview question that:
1. Is appropriate for the current stage of the interview (${getQuestionStageInfo(questionNumber)})
2. Helps assess the candidate's fit for this specific role
3. Focuses on relevant skills, experience, or behavior for this position
4. Is clear, concise, and specific (avoid vague or overly broad questions)
5. Is phrased in a conversational, natural way

Also generate 3-4 short suggestion prompts (1-2 sentences each) that could help the candidate formulate a good response to this question. ${resumeFile ? 'These suggestions should directly reference specific experiences, skills, or achievements from their resume that match the job requirements.' : 'These should be general but helpful starting points for their answer.'}

Format your response as a JSON object with the following structure:
{
  "question": "Your interview question here",
  "suggestions": [
    "${resumeFile ? 'Suggestion that references a specific experience from their resume' : 'Suggestion 1 to help the candidate'}",
    "${resumeFile ? 'Suggestion that mentions relevant skills from their resume' : 'Suggestion 2 to help the candidate'}",
    "${resumeFile ? 'Suggestion that highlights an achievement from their resume' : 'Suggestion 3 to help the candidate'}",
    "${resumeFile ? 'Suggestion that connects their background to the job requirements' : 'Suggestion 4 to help the candidate (optional)'}"
  ]
}`;

  return prompt;
}

/**
 * Build a prompt for giving feedback on the candidate's response
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
  let prompt = `You are an AI interviewer conducting a mock job interview. 
The job details are:

Job Title: ${jobTitle}
Company: ${companyName}
Job Description: ${jobDescription}
${skills ? `Required Skills: ${skills}` : ''}`;

  if (resumeFile) {
    prompt += `\n\nThe candidate has uploaded their resume (${resumeFile.name}). 
Please analyze the resume when evaluating their response to:
1. Assess how well they incorporated relevant details from their own background
2. Identify specific experiences or skills from their resume they could have mentioned but didn't
3. Provide feedback on how well they connected their actual background to the job requirements
4. Suggest better ways to leverage their specific resume details in future answers`;
  }

  prompt += `\n\nYou asked the candidate question ${questionNumber !== undefined ? questionNumber + 1 : 1}: "${getQuestionForNumber(questionNumber)}"

The candidate's response was:
"${userResponse || ""}"

Please evaluate the candidate's response and provide constructive feedback. Focus on:

1. The strengths of their answer (what they did well)
2. Areas for improvement (what could be enhanced)
3. A score out of 100 for this specific response
${resumeFile ? '4. How well they highlighted relevant experience from their resume' : ''}

Format your response as a JSON object with the following structure:
{
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    ${resumeFile ? '"Well-utilized experience/skill from their resume",' : ''}
    "Specific strength 3"
  ],
  "improvements": [
    "Specific improvement suggestion 1",
    "Specific improvement suggestion 2",
    ${resumeFile ? '"Suggestion on how to better incorporate their resume details",' : ''}
    "Specific improvement suggestion 3"
  ],
  "score": 85 (a number between 0-100)
}

Make your feedback specific, actionable, and tailored to both the question and the job requirements.`;

  return prompt;
}

/**
 * Build a prompt for generating a summary of the interview
 */
function buildSummaryPrompt(
  jobTitle: string, 
  companyName: string, 
  conversation?: ConversationMessage[],
  resumeFile?: { name: string; type: string; size: number; }
): string {
  // Extract just the questions and answers for brevity
  const interviewHighlights = conversation 
    ? conversation
        .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && msg.content.includes('?')))
        .map(msg => `${msg.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`)
        .join('\n\n')
    : 'No conversation provided.';

  let prompt = `You are an AI interviewer that just conducted a mock job interview for the position of ${jobTitle} at ${companyName}.

Here are highlights from the interview:

${interviewHighlights}`;

  if (resumeFile) {
    prompt += `\n\nThe candidate uploaded their resume (${resumeFile.name}) for this interview. 
When analyzing their overall performance, please also consider:
1. How effectively they incorporated details from their resume into their answers
2. Whether they highlighted the most relevant aspects of their background for this specific job
3. How well they connected their work history to the requirements of the ${jobTitle} role
4. What specific experiences or skills from their resume they should emphasize more in future interviews`;
  }

  prompt += `\n\nPlease provide a summary of the interview and overall feedback for the candidate. Format your response as JSON:

{
  "summary": "Your overall assessment of the candidate's interview performance",
  "overallScore": 82, // A score from 50-100 representing the candidate's overall performance
  "keyStrengths": [
    "Key strength 1 demonstrated during the interview",
    "Key strength 2 demonstrated during the interview"${resumeFile ? ',\n    "How well they leveraged their background"' : ''}
  ],
  "areasForImprovement": [
    "Area for improvement 1",
    "Area for improvement 2"${resumeFile ? ',\n    "How to better connect their resume to interview responses"' : ''}
  ],
  "suggestedQuestions": [
    "A good question the candidate could ask in a real interview",
    "Another good question the candidate could ask",
    "A third good question the candidate could ask",
    "A fourth good question the candidate could ask"
  ]${resumeFile ? ',\n  "resumeHighlights": [\n    "Key aspect of their resume that was well-utilized",\n    "Important resume detail they should emphasize more"\n  ]' : ''}
}

Provide thoughtful, specific feedback that will help the candidate in their real job interview. For suggested questions, provide 4 questions that would be impressive to ask in a real interview for this specific role and company.${resumeFile ? ' Include personalized suggestions based on their resume that would make them stand out.' : ''}`;

  return prompt;
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
      suggestedQuestions: [],
      resumeHighlights: []
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

/**
 * Helper function to get question stage information based on question number
 */
function getQuestionStageInfo(questionNumber?: number): string {
  const index = questionNumber || 0;
  
  switch (index) {
    case 0:
      return "introduction and interest in the role";
    case 1:
      return "relevant experience and skills";
    case 2:
      return "problem-solving and handling challenges";
    case 3:
      return "career goals and professional development";
    case 4:
      return "candidate's questions about the role or company";
    default:
      return "general fit for the role";
  }
}

/**
 * Helper function to get a default question based on question number
 */
function getQuestionForNumber(questionNumber?: number): string {
  const index = questionNumber || 0;
  
  switch (index) {
    case 0:
      return "Tell me about yourself and why you're interested in this role.";
    case 1:
      return "What relevant experience and skills do you have for this position?";
    case 2:
      return "How do you handle challenges or difficult situations at work? Please provide a specific example.";
    case 3:
      return "What are your career goals and how does this position fit into your professional development?";
    case 4:
      return "Do you have any questions about the role or company?";
    default:
      return "How do you see yourself contributing to this role?";
  }
} 