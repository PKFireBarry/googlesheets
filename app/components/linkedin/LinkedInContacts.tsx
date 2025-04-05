import React from 'react';
import { 
  Search, Linkedin, Key, ExternalLink, X, Copy, Check, 
  MessageSquare, RefreshCw, MapPin, ArrowRight, Loader2 
} from 'lucide-react';
import { LinkedInContactData } from '../../utils/webhook';

interface LinkedInContactsProps {
  geminiApiKey: string;
  selectedCompany: string;
  isSearching: boolean;
  taskStatus: string;
  taskProgress: number;
  taskElapsedTime: number;
  statusMessage: string;
  searchResults: LinkedInContactData[];
  selectedJob: Record<string, unknown> | null;
  error: string | null;
  editableMessages: Record<string, string>;
  isEditingMessage: Record<string, boolean>;
  copiedMessageIds: Record<string, boolean>;
  formatUrl: (url: string) => string;
  onEditMessage: (contactId: string) => void;
  onSaveMessage: (contactId: string) => void;
  onMessageChange: (contactId: string, newMessage: string) => void;
  onRegenerateMessage: (contactId: string, contact: LinkedInContactData) => void;
  onCopyMessage: (message: string, contactId: string) => void;
  generateOutreachMessage: (contact: LinkedInContactData, job: Record<string, unknown> | null) => string;
  onSearch: () => void;
}

/**
 * LinkedIn Contacts Component
 * Displays search results of LinkedIn HR contacts and allows message generation
 */
const LinkedInContacts: React.FC<LinkedInContactsProps> = ({
  geminiApiKey,
  selectedCompany,
  isSearching,
  taskStatus,
  taskProgress,
  taskElapsedTime,
  statusMessage,
  searchResults,
  selectedJob,
  error,
  editableMessages,
  isEditingMessage,
  copiedMessageIds,
  formatUrl,
  onEditMessage,
  onSaveMessage,
  onMessageChange,
  onRegenerateMessage,
  onCopyMessage,
  generateOutreachMessage,
  onSearch
}) => {
  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
          <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">LinkedIn HR Contacts</h2>
      </div>
      
      {/* Display based on search state */}
      {!geminiApiKey && !process.env.NEXT_PUBLIC_GEMINI_API_KEY ? (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 text-yellow-700 dark:text-yellow-300 px-6 py-4 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-yellow-200 dark:bg-yellow-800 p-3 rounded-full">
              <Key className="h-6 w-6 text-yellow-700 dark:text-yellow-300" />
            </div>
            <div>
              <p className="font-semibold text-lg">Gemini API Key not configured</p>
              <p className="mt-2">Please enter and save your Google Gemini API key to enable LinkedIn lookups.</p>
              <div className="mt-3">
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-yellow-800 dark:text-yellow-200 hover:underline"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Get a free API key from Google AI Studio
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : isSearching ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
            Searching for HR contacts at {selectedCompany}
          </h3>
          
          {/* Status indicator */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3 mt-4 w-full max-w-md">
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2 text-center">
              {statusMessage || 'Initializing search...'}
            </p>
              
            {/* Progress bar with animation */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-700 ease-in-out"
                style={{ width: `${Math.min(taskProgress, 100)}%` }}
              ></div>
            </div>
            
            {/* Time indicator */}
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {taskStatus === 'processing' ? 'Processing data' : 
                 taskStatus === 'polling' ? 'Searching LinkedIn' : 
                 'Starting search'}
              </span>
              <span>
                {taskElapsedTime > 0 ? `${taskElapsedTime}s elapsed` : ''}
              </span>
            </div>
          </div>
          
          {/* Status explanation */}
          <div className="mt-6 text-center max-w-md">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {taskStatus === 'polling' && (
                <p>Our automated browser is searching LinkedIn for HR contacts at {selectedCompany}...</p>
              )}
              
              {taskStatus === 'processing' && (
                <p>Browser automation complete! Now using AI to analyze and structure the data...</p>
              )}
              
              {taskStatus === 'preparing' && (
                <p>Setting up the search process. This typically takes 2-3 minutes to complete.</p>
              )}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 px-6 py-4 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="bg-red-200 dark:bg-red-800 p-3 rounded-full">
              <X className="h-6 w-6 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <p className="font-semibold text-lg">Lookup unsuccessful</p>
              <p className="mt-2">{error}</p>
              {error.includes('timeout') && (
                <div className="mt-4 bg-white dark:bg-gray-700 p-4 rounded-lg">
                  <p className="font-medium">What happened?</p>
                  <p className="text-sm mt-1">
                    The search is still running, but our server timed out waiting for a response.
                    This happens because free Vercel hosting has a 10-second timeout limit.
                  </p>
                  <p className="text-sm mt-1">
                    Your search might complete in the background. You can try again in a few minutes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {searchResults.map((contact, index) => {
            // Create a safely typed contact object for rendering
            const safeContact = {
              name: typeof contact.name === 'string' ? contact.name : String(contact.name || 'Unknown'),
              title: typeof contact.title === 'string' ? contact.title : String(contact.title || ''),
              location: typeof contact.location === 'string' ? contact.location : String(contact.location || ''),
              email: typeof contact.email === 'string' ? contact.email : String(contact.email || ''),
              linkedinUrl: typeof contact.linkedinUrl === 'string' ? contact.linkedinUrl : String(contact.linkedinUrl || ''),
              phone: typeof contact.phone === 'string' ? contact.phone : String(contact.phone || ''),
              website: typeof contact.website === 'string' ? contact.website : String(contact.website || ''),
              profileImage: typeof contact.profileImage === 'string' ? contact.profileImage : '',
              birthday: typeof contact.birthday === 'string' ? contact.birthday : 
                       (contact.birthday ? String(contact.birthday) : '')
            };
            
            return (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-all duration-200">
                <div className="flex justify-between items-start">
                  <div className="flex items-start">
                    {safeContact.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={safeContact.profileImage} 
                        alt={`${safeContact.name} profile`}
                        className="w-16 h-16 rounded-full mr-4 object-cover border-2 border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          // Handle image load errors by hiding the image
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full mr-4 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <Linkedin className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{safeContact.name}</h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{safeContact.title}</p>
                      {safeContact.location && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1 inline" />
                          {safeContact.location}
                        </p>
                      )}
                    </div>
                  </div>
                  {safeContact.linkedinUrl && (
                    <a 
                      href={formatUrl(safeContact.linkedinUrl)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline bg-blue-50 dark:bg-blue-900/20 py-1.5 px-3 rounded-lg"
                    >
                      <Linkedin className="w-4 h-4 mr-1.5" />
                      View Profile
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </a>
                  )}
                </div>
                
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                  {safeContact.email && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Email: </span>
                      <a href={`mailto:${safeContact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {safeContact.email}
                      </a>
                    </div>
                  )}
                  
                  {safeContact.linkedinUrl && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">LinkedIn: </span>
                      <a 
                        href={formatUrl(safeContact.linkedinUrl)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-[200px]"
                      >
                        {safeContact.linkedinUrl}
                      </a>
                    </div>
                  )}
                  
                  {safeContact.phone && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Phone: </span>
                      <a href={`tel:${safeContact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {safeContact.phone}
                      </a>
                    </div>
                  )}
                  
                  {safeContact.website && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Website: </span>
                      <a href={formatUrl(safeContact.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-[200px]">
                        {safeContact.website}
                      </a>
                    </div>
                  )}
                  
                  {safeContact.birthday && (
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Birthday: </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {safeContact.birthday}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* LinkedIn Outreach Message Generator */}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-5 pt-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                      Job Referral Message
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      {/* Edit/Save Button */}
                      <button
                        onClick={() => onEditMessage(safeContact.linkedinUrl || safeContact.name)}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 ${
                            isEditingMessage[safeContact.linkedinUrl || safeContact.name] 
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                        }`}
                      >
                        {isEditingMessage[safeContact.linkedinUrl || safeContact.name] ? (
                          <>Save Changes</>
                        ) : (
                          <>Edit Message</>
                        )}
                      </button>
                      
                      {/* Copy Button */}
                      <button
                        onClick={() => onCopyMessage(
                          editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                            contact, 
                            selectedJob
                          ),
                          safeContact.linkedinUrl || safeContact.name
                        )}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 ${
                            copiedMessageIds[safeContact.linkedinUrl || safeContact.name]
                              ? 'bg-green-600 text-white'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                      >
                        {copiedMessageIds[safeContact.linkedinUrl || safeContact.name] ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Copy Message
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {isEditingMessage[safeContact.linkedinUrl || safeContact.name] ? (
                    <div className="mt-3">
                      <div className="relative">
                        <textarea
                          value={editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                            contact, 
                            selectedJob
                          )}
                          onChange={(e) => onMessageChange(safeContact.linkedinUrl || safeContact.name, e.target.value)}
                          className="w-full p-4 text-sm bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-700 font-mono shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={10}
                          style={{resize: "vertical"}}
                        />
                        <div className="absolute top-2 right-2 bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
                          Editing
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end space-x-3">
                        <button
                          onClick={() => onRegenerateMessage(safeContact.linkedinUrl || safeContact.name, contact)}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center transition-colors duration-200"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Regenerate
                        </button>
                        <button
                          onClick={() => onSaveMessage(safeContact.linkedinUrl || safeContact.name)}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="p-4 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap relative overflow-hidden shadow-inner">
                        {editableMessages[safeContact.linkedinUrl || safeContact.name] || generateOutreachMessage(
                          contact, 
                          selectedJob
                        )}
                      </div>
                      <div className="mt-3 flex justify-end space-x-3">
                        <button
                          onClick={() => onRegenerateMessage(safeContact.linkedinUrl || safeContact.name, contact)}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center transition-colors duration-200"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Regenerate
                        </button>
                        <button
                          onClick={() => onEditMessage(safeContact.linkedinUrl || safeContact.name)}
                          className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200"
                        >
                          Edit Message
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 flex justify-end">
                    {safeContact.linkedinUrl && safeContact.linkedinUrl !== 'n/a' && (
                      <a 
                        href={`${formatUrl(safeContact.linkedinUrl)}/message`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                        Message on LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedCompany ? (
        <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-400 text-blue-700 dark:text-blue-300 p-6 rounded-lg flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="bg-blue-200 dark:bg-blue-800 p-3 rounded-full">
            <Search className="h-6 w-6 text-blue-700 dark:text-blue-300" />
          </div>
          <div className="text-center sm:text-left flex-1">
            <p className="font-medium text-lg">Ready to search</p>
            <p className="mt-1">Click "Find HR Contacts" to search for HR personnel at {selectedCompany}</p>
            <button
              onClick={onSearch}
              disabled={isSearching}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 inline-flex items-center"
            >
              <Search className="w-4 h-4 mr-2" />
              Find HR Contacts
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-full mb-6">
            <Search className="w-12 h-12 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">No search results yet</p>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            Select a company and click "Find HR Contacts" to search for HR personnel on LinkedIn
          </p>
        </div>
      )}
    </div>
  );
};

export default LinkedInContacts; 