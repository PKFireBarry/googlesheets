import React, { useState } from 'react';
import { 
  Search, Linkedin, Key, ExternalLink, X, Copy, Check, 
  MessageSquare, RefreshCw, MapPin, ArrowRight, Loader2, Building2, ChevronDown, ChevronUp
} from 'lucide-react';
import { LinkedInContactData } from '../../utils/webhook';

interface LinkedInContactsProps {
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
  onRegenerateMessage: (contactId: string, contact: LinkedInContactData) => Promise<void>;
  onCopyMessage: (message: string, contactId: string) => void;
  generateOutreachMessage: (contact: LinkedInContactData, job: Record<string, unknown> | null) => string;
  onSearch: () => void;
}

/**
 * LinkedIn Contacts Component - Compact Collapsible Version
 * Displays search results of LinkedIn HR contacts with expandable cards
 */
const LinkedInContacts: React.FC<LinkedInContactsProps> = ({
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
  // Track which cards are expanded
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // Track which messages are being generated
  const [generatingMessages, setGeneratingMessages] = useState<Record<string, boolean>>({});

  const toggleCard = (contactId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  };
  
  // Handle async message generation with loading state
  const handleGenerateMessage = async (contactId: string, contact: LinkedInContactData) => {
    setGeneratingMessages(prev => ({ ...prev, [contactId]: true }));
    try {
      await onRegenerateMessage(contactId, contact);
    } finally {
      setGeneratingMessages(prev => ({ ...prev, [contactId]: false }));
    }
  };

  // Extract relevant description (headline/summary)
  const getRelevantDescription = (description: string) => {
    if (!description) return '';
    
    // Look for the part before "· Experience:" or similar patterns
    const beforeExperience = description.split('·')[0]?.trim();
    if (beforeExperience && beforeExperience.length > 10) {
      return beforeExperience;
    }
    
    // Fallback to first 150 characters if no clear headline
    return description.length > 150 ? description.substring(0, 150) + '...' : description;
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3">
          <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">LinkedIn HR Contacts</h2>
      </div>
      
      {/* Display based on search state */}
      {isSearching ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Searching LinkedIn...</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
            {statusMessage || 'Looking for HR contacts and recruiting professionals'}
          </p>
          
          {/* Progress bar */}
          <div className="w-64 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${taskProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {taskProgress}% complete
            {taskElapsedTime > 0 && ` • ${Math.round(taskElapsedTime / 1000)}s elapsed`}
          </p>
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
            </div>
          </div>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-3">
          {searchResults.map((contact, index) => {
            // Create a safely typed contact object for rendering
            const safeContact = {
              name: typeof contact.name === 'string' ? contact.name : String(contact.name || 'Unknown'),
              title: typeof contact.title === 'string' ? contact.title : String(contact.title || ''),
              location: typeof contact.location === 'string' ? contact.location : String(contact.location || ''),
              company: typeof contact.company === 'string' ? contact.company : String(contact.company || ''),
              description: typeof contact.description === 'string' ? contact.description : String(contact.description || ''),
              experience: typeof contact.experience === 'string' ? contact.experience : String(contact.experience || ''),
              linkedinUrl: typeof contact.linkedinUrl === 'string' ? contact.linkedinUrl : String(contact.linkedinUrl || ''),
              email: typeof contact.email === 'string' ? contact.email : String(contact.email || ''),
              phone: typeof contact.phone === 'string' ? contact.phone : String(contact.phone || ''),
              website: typeof contact.website === 'string' ? contact.website : String(contact.website || ''),
              profileImage: typeof contact.profileImage === 'string' ? contact.profileImage : ''
            };

            const contactId = safeContact.linkedinUrl || safeContact.name;
            const isExpanded = expandedCards[contactId];

            return (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                {/* Compact Header - Always Visible */}
                <div 
                  className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  onClick={() => toggleCard(contactId)}
                >
                  <div className="flex items-center flex-1">
                    {safeContact.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={safeContact.profileImage} 
                        alt={`${safeContact.name} profile`}
                        className="w-12 h-12 rounded-full mr-3 object-cover border-2 border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full mr-3 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <Linkedin className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">{safeContact.name}</h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate">{safeContact.title}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {/* View Profile Button - Hide text on very small screens */}
                    {safeContact.linkedinUrl && (
                      <a 
                        href={formatUrl(safeContact.linkedinUrl)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()} // Prevent card toggle
                        className="flex items-center text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline bg-blue-50 dark:bg-blue-900/20 py-1.5 px-2 rounded-lg"
                      >
                        <Linkedin className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">View Profile</span>
                      </a>
                    )}
                    
                    {/* Expand/Collapse Button */}
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Content - Only when expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4">
                    {/* Detailed Info */}
                    <div className="mb-4">
                      {/* Company */}
                      {safeContact.company && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                          <Building2 className="w-3.5 h-3.5 mr-1" />
                          {safeContact.company}
                        </p>
                      )}
                      
                      {/* Location and Experience */}
                      <div className="flex items-center gap-4 mb-3">
                        {safeContact.location && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 flex items-center">
                            <MapPin className="w-3.5 h-3.5 mr-1" />
                            {safeContact.location}
                          </p>
                        )}
                        {safeContact.experience && (
                          <p className="text-sm text-gray-500 dark:text-gray-500">
                            {safeContact.experience} experience
                          </p>
                        )}
                      </div>

                      {/* Description/Headline */}
                      {getRelevantDescription(safeContact.description) && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-4">
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                            "{getRelevantDescription(safeContact.description)}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Message Generation Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                          Job Referral Message
                        </h3>
                        
                        <div className="flex items-center gap-2">
                          {/* Generate Message Button - only show if no message exists */}
                          {!editableMessages[contactId] && (
                            <button
                              onClick={() => handleGenerateMessage(contactId, contact)}
                              disabled={generatingMessages[contactId]}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                              {generatingMessages[contactId] ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                                  Generate Message
                                </>
                              )}
                            </button>
                          )}
                          
                        </div>
                      </div>
                      
                      {/* Message Content */}
                      {editableMessages[contactId] ? (
                        <div className="mt-3">
                          {isEditingMessage[contactId] ? (
                            <div className="relative">
                              <textarea
                                value={editableMessages[contactId]}
                                onChange={(e) => onMessageChange(contactId, e.target.value)}
                                className="w-full p-4 text-sm bg-white dark:bg-gray-800 rounded-lg border border-blue-300 dark:border-blue-700 font-mono shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows={8}
                                style={{resize: "vertical"}}
                              />
                              <div className="absolute top-2 right-2 bg-blue-50 dark:bg-blue-900/20 rounded-md px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
                                Editing
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap relative overflow-hidden shadow-inner">
                              {editableMessages[contactId]}
                            </div>
                          )}
                          
                          {/* Action Buttons Row */}
                          <div className="mt-3 flex flex-col sm:flex-row justify-end gap-2 sm:gap-2">
                            <button
                              onClick={() => onCopyMessage(editableMessages[contactId], contactId)}
                              className={`inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-200 w-full sm:w-auto ${
                                  copiedMessageIds[contactId]
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              }`}
                            >
                              {copiedMessageIds[contactId] ? (
                                <>
                                  <Check className="w-3.5 h-3.5 mr-1.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                                  Copy
                                </>
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleGenerateMessage(contactId, contact)}
                              disabled={generatingMessages[contactId]}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200 w-full sm:w-auto"
                            >
                              {generatingMessages[contactId] ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                  Regenerate
                                </>
                              )}
                            </button>
                            
                            <button
                              onClick={() => onEditMessage(contactId)}
                              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-200 w-full sm:w-auto ${
                                  isEditingMessage[contactId] 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                              }`}
                            >
                              {isEditingMessage[contactId] ? 'Save Changes' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-4 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500 dark:text-gray-400">
                          Click "Generate Message" to create a personalized outreach message for this contact.
                        </div>
                      )}
                    </div>
                  </div>
                )}
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