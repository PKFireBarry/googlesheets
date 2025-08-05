import { LinkedInContactData } from './webhook';

export interface JinaSearchResult {
  name: string;
  title: string;
  linkedinUrl: string;
  description: string;
  company?: string;
}

export interface JinaSearchResponse {
  success: boolean;
  results: JinaSearchResult[];
  totalResults: number;
  company: string;
}

/**
 * Search for LinkedIn profiles using Jina.ai (Legacy function - now uses main LinkedIn API)
 * @param company The company name to search for
 * @param apiKey The Jina.ai API key
 * @returns Promise with search results
 * @deprecated Use lookupLinkedInHRWithJina instead
 */
export const searchLinkedInProfiles = async (
  company: string,
  apiKey: string
): Promise<JinaSearchResult[]> => {
  try {
    console.log('🔍 JinaSearch: Making API call to /api/linkedin (updated)')
    console.log('🔍 JinaSearch: Company:', company)
    console.log('🔍 JinaSearch: API Key available:', apiKey ? 'YES' : 'NO')
    
    const response = await fetch('/api/linkedin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company,
        jinaApiKey: apiKey,
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY // Use env Gemini key if available
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log('🔍 JinaSearch: API Error:', errorData)
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const linkedInContacts = await response.json();
    console.log('🔍 JinaSearch: API Response:', linkedInContacts)
    
    // Convert LinkedInContactData back to JinaSearchResult format for compatibility
    return linkedInContacts.map((contact: any) => ({
      name: contact.name,
      title: contact.title,
      linkedinUrl: contact.linkedinUrl,
      description: contact.description || '',
      company: contact.company
    }));
  } catch (error) {
    console.error('Error searching LinkedIn profiles:', error);
    throw error;
  }
};

/**
 * Convert Jina search results to LinkedIn contact data format
 * @param jinaResults The results from Jina.ai search
 * @returns Array of LinkedIn contact data
 */
export const convertJinaResultsToLinkedInData = (
  jinaResults: JinaSearchResult[]
): LinkedInContactData[] => {
  return jinaResults.map(result => ({
    name: result.name,
    title: result.title,
    email: '', // Not available from Jina search
    linkedinUrl: result.linkedinUrl,
    website: '', // Not available from Jina search
    profileImage: '', // Not available from Jina search
    company: result.company || '',
    phone: '', // Not available from Jina search
    location: '', // Not available from Jina search
    description: result.description // Additional field for description
  }));
};

/**
 * Filter results to focus on HR-related roles
 * @param results The search results to filter
 * @returns Filtered results focusing on HR roles
 */
export const filterHRRoles = (results: JinaSearchResult[]): JinaSearchResult[] => {
  const hrKeywords = [
    'hr', 'human resources', 'recruiting', 'recruiter', 'talent acquisition',
    'talent', 'hiring', 'recruitment', 'people', 'personnel', 'staffing',
    'sourcer', 'sourcing', 'talent manager', 'hr manager', 'hr director',
    'chief people officer', 'vp of talent', 'head of talent'
  ];

  return results.filter(result => {
    const searchText = `${result.title} ${result.description}`.toLowerCase();
    return hrKeywords.some(keyword => searchText.includes(keyword));
  });
}; 