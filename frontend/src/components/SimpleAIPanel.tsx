import React, { useState, useEffect } from 'react';
import { quotesApi } from '../services/quotesApi';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface SimpleAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  divisions: any[];
  totalQuotes: number;
  projectTotals: any;
}

export default function SimpleAIPanel({ 
  isOpen, 
  onClose, 
  projectId, 
  projectName, 
  divisions, 
  totalQuotes, 
  projectTotals 
}: SimpleAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detailedContext, setDetailedContext] = useState<any>(null);

  // Load comprehensive project data when panel opens
  useEffect(() => {
    if (isOpen && !detailedContext) {
      loadComprehensiveContext();
    }
  }, [isOpen]);

  const loadComprehensiveContext = async () => {
    try {
      console.log('🔍 Loading comprehensive context for project:', projectId);
      
      // Load detailed quote comparisons for each division
      const divisionComparisons = [];
      
      for (const division of divisions) {
        const divisionId = `${division.divisionCode}-${projectId}`;
        console.log(`🔍 Loading quotes for division: ${divisionId}`);
        
        let divisionQuotes: any[] = [];
        let subcategoryQuotes: any[] = [];
        
        // Load division-level quotes
        try {
          const compareData = await quotesApi.getCompare(divisionId);
          divisionQuotes = compareData.vendor_quotes || [];
          console.log(`✅ Division ${division.divisionCode} division quotes:`, divisionQuotes.length);
        } catch (error) {
          console.log(`❌ No division quotes for ${division.divisionCode}:`, error);
        }
        
        // Load subcategory-level quotes
        try {
          const subcategoryResponse = await fetch(`${API_BASE}/quotes/subcategories/${division.divisionCode}/${projectId}`);
          const subcategoryData = await subcategoryResponse.json();
          subcategoryQuotes = subcategoryData.subcategory_quotes || [];
          console.log(`✅ Division ${division.divisionCode} subcategory quotes:`, subcategoryQuotes.length);
        } catch (error) {
          console.log(`❌ No subcategory quotes for ${division.divisionCode}:`, error);
        }
        
        // Combine all quotes for this division
        const allQuotes = [...divisionQuotes, ...subcategoryQuotes];
        
        divisionComparisons.push({
          divisionCode: division.divisionCode,
          divisionName: division.divisionName,
          budget: division.divisionTotal,
          quotes: allQuotes,
          divisionQuotes: divisionQuotes,
          subcategoryQuotes: subcategoryQuotes
        });
      }

      const contextData = {
        projectId,
        projectName,
        divisions,
        totalQuotes,
        projectTotals,
        divisionComparisons
      };
      
      setDetailedContext(contextData);
      
      // Generate welcome message with actual quote data
      const actualTotalQuotes = divisionComparisons.reduce((sum, div) => sum + div.quotes.length, 0);
      const divisionsWithQuotes = divisionComparisons.filter(div => div.quotes.length > 0);
      
      let welcomeMessage = `👋 Hello! I'm your AI procurement assistant for **${projectName}**.\n\n**Project Overview:**\n• Total Budget: $${projectTotals?.jobTotal?.toLocaleString() || '0'}\n• Divisions: ${divisions.length}\n• Total Quotes: ${actualTotalQuotes}\n\n`;
      
      if (actualTotalQuotes > 0) {
        welcomeMessage += `**Divisions with Quotes:**\n`;
        divisionsWithQuotes.forEach(div => {
          const divQuotes = div.divisionQuotes?.length || 0;
          const subQuotes = div.subcategoryQuotes?.length || 0;
          const totalQuotes = div.quotes.length;
          
          welcomeMessage += `• Division ${div.divisionCode} - ${div.divisionName}: ${totalQuotes} quotes`;
          if (divQuotes > 0 && subQuotes > 0) {
            welcomeMessage += ` (${divQuotes} division-level, ${subQuotes} subcategory-level)`;
          } else if (divQuotes > 0) {
            welcomeMessage += ` (division-level)`;
          } else if (subQuotes > 0) {
            welcomeMessage += ` (subcategory-level)`;
          }
          welcomeMessage += `\n`;
        });
        welcomeMessage += `\nI have access to all quote details including pricing, vendors, line items, and both division-level and subcategory-level quotes. Ask me anything!`;
      } else {
        welcomeMessage += `No quotes have been uploaded yet. I can help with procurement strategy and vendor recommendations.`;
      }
      
      setMessages([{
        id: 'welcome',
        role: 'ai',
        content: welcomeMessage,
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Failed to load comprehensive context:', error);
      setMessages([{
        id: 'welcome-error',
        role: 'ai',
        content: `👋 Hello! I'm your AI procurement assistant for **${projectName}**.\n\nI'm having trouble loading your quote data, but I can still help with general procurement advice.`,
        timestamp: new Date()
      }]);
    }
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
            detailedContext: detailedContext
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
      
      // Generate intelligent fallback with actual data
      const actualQuotes = detailedContext?.divisionComparisons?.reduce((sum: number, div: any) => sum + div.quotes.length, 0) || 0;
      const quoteDivisions = detailedContext?.divisionComparisons?.filter((div: any) => div.quotes.length > 0) || [];
      
      let fallbackContent = `I understand your question about "${currentInput}". The AI service is temporarily unavailable, but I have access to your project data:\n\n`;
      fallbackContent += `**Your Project Status:**\n• ${divisions.length} divisions\n• ${actualQuotes} quotes received\n\n`;
      
      if (quoteDivisions.length > 0) {
        fallbackContent += `**Divisions with Quotes:**\n`;
        quoteDivisions.forEach((div: any) => {
          fallbackContent += `• Division ${div.divisionCode} - ${div.divisionName}: ${div.quotes.length} quotes\n`;
        });
      }
      
      fallbackContent += `\nPlease try your question again in a moment for detailed AI analysis.`;
      
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: fallbackContent,
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
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-1/2 min-w-[500px] bg-white shadow-2xl z-50 flex flex-col">
        
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">🤖 AI Project Analysis</h2>
            <p className="text-blue-100 text-sm">{projectName}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded p-2"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
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

        {/* Input - Fixed at bottom */}
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
              placeholder="e.g., Which vendor should I choose? What are the risks?"
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
            Press Enter to send • AI has access to all your project data
          </div>
        </div>
        
      </div>
    </>
  );
}