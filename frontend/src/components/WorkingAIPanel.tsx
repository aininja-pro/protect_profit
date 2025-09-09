import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface WorkingAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  divisions: any[];
  totalQuotes: number;
  projectTotals: any;
}

export default function WorkingAIPanel({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName, 
  divisions, 
  totalQuotes, 
  projectTotals 
}: WorkingAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [loadedQuoteData, setLoadedQuoteData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && !contextLoaded) {
      loadQuoteContext();
    }
  }, [isOpen, contextLoaded]);

  const loadQuoteContext = async () => {
    console.log('🔍 Loading quote context for project:', projectId);
    
    let totalDivisionQuotes = 0;
    let totalSubcategoryQuotes = 0;
    const divisionSummary: string[] = [];
    const divisionComparisons: any[] = [];

    // Load quotes for each division
    for (const division of divisions) {
      const divisionId = `${division.divisionCode}-${projectId}`;
      
      let divisionQuotes: any[] = [];
      let subcategoryQuotes: any[] = [];
      
      try {
        // Load division quotes
        const divResponse = await fetch(`${API_BASE}/quotes/divisions/${divisionId}/compare`);
        const divData = await divResponse.json();
        divisionQuotes = divData.vendor_quotes || [];
        totalDivisionQuotes += divisionQuotes.length;

        // Load subcategory quotes  
        const subResponse = await fetch(`${API_BASE}/quotes/subcategories/${division.divisionCode}/${projectId}`);
        const subData = await subResponse.json();
        subcategoryQuotes = subData.subcategory_quotes || [];
        totalSubcategoryQuotes += subcategoryQuotes.length;

        const totalForDivision = divisionQuotes.length + subcategoryQuotes.length;
        if (totalForDivision > 0) {
          divisionSummary.push(`Division ${division.divisionCode} - ${division.divisionName}: ${totalForDivision} quotes (${divisionQuotes.length} division, ${subcategoryQuotes.length} subcategory)`);
        }

        // Store the actual quote data for AI context
        divisionComparisons.push({
          divisionCode: division.divisionCode,
          divisionName: division.divisionName,
          budget: division.divisionTotal,
          quotes: [...divisionQuotes, ...subcategoryQuotes],
          divisionQuotes: divisionQuotes,
          subcategoryQuotes: subcategoryQuotes
        });

        console.log(`✅ Division ${division.divisionCode}: ${divisionQuotes.length} division quotes, ${subcategoryQuotes.length} subcategory quotes`);
      } catch (error) {
        console.log(`❌ Error loading quotes for division ${division.divisionCode}:`, error);
        
        // Still add empty entry
        divisionComparisons.push({
          divisionCode: division.divisionCode,
          divisionName: division.divisionName,
          budget: division.divisionTotal,
          quotes: [],
          divisionQuotes: [],
          subcategoryQuotes: []
        });
      }
    }

    // Store the loaded data for use in AI calls
    const completeContext = {
      projectId,
      projectName,
      divisions,
      totalQuotes,
      projectTotals,
      divisionComparisons
    };
    
    setLoadedQuoteData(completeContext);
    console.log('💾 Stored complete context with', divisionComparisons.length, 'divisions and', totalDivisionQuotes + totalSubcategoryQuotes, 'total quotes');

    const totalQuotesFound = totalDivisionQuotes + totalSubcategoryQuotes;
    
    let welcomeMessage = `👋 Hello! I'm your AI procurement assistant for **${projectName}**.\n\n`;
    welcomeMessage += `**Project Overview:**\n`;
    welcomeMessage += `• Total Budget: $${projectTotals?.jobTotal?.toLocaleString() || '0'}\n`;
    welcomeMessage += `• Divisions: ${divisions.length}\n`;
    welcomeMessage += `• Total Quotes Found: ${totalQuotesFound} (${totalDivisionQuotes} division-level, ${totalSubcategoryQuotes} subcategory-level)\n\n`;

    if (divisionSummary.length > 0) {
      welcomeMessage += `**Divisions with Quotes:**\n`;
      divisionSummary.forEach(summary => {
        welcomeMessage += `• ${summary}\n`;
      });
      welcomeMessage += `\nI have access to all your quote data including vendors, pricing, and line items. Ask me anything!`;
    } else {
      welcomeMessage += `No quotes found yet. I can help with procurement strategy and vendor recommendations.`;
    }

    setMessages([{
      id: 'welcome',
      role: 'ai',
      content: welcomeMessage,
      timestamp: new Date()
    }]);

    setContextLoaded(true);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      console.log('🚀 Sending message to AI with loaded quote data:', loadedQuoteData ? 'YES' : 'NO');
      
      const response = await fetch(`${API_BASE}/ai/project-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentInput,
          context: {
            type: 'project_analysis',
            projectId,
            projectName,
            divisions,
            totalQuotes,
            projectTotals,
            detailedContext: loadedQuoteData || {}
          }
        })
      });
      
      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.ai_response || 'I understand your question. Let me analyze your project data.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI error:', error);
      
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `I understand your question about "${currentInput}". The AI service is temporarily unavailable, but I have access to your project data. Please try again shortly.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      
      <div className="fixed top-0 right-0 h-full w-1/2 min-w-[500px] bg-white shadow-2xl z-50 flex flex-col">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">🤖 AI Project Analysis</h2>
            <p className="text-blue-100 text-sm">{projectName}</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-blue-700 rounded p-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                <div className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  AI is analyzing your project...
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white">
          <div className="mb-2">
            <div className="text-sm font-medium text-gray-700">💬 Ask me about your project:</div>
          </div>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Compare all Division 04 quotes, Which vendor offers best value?"
              className="flex-1 border-2 border-blue-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            Press Enter to send • AI has access to all division and subcategory quotes
          </div>
        </div>
      </div>
    </>
  );
}