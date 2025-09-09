import React, { useState, useEffect, useRef } from 'react';
import { quotesApi } from '../services/quotesApi';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ProjectAnalysisContext {
  projectId: string;
  projectName: string;
  divisions: any[];
  divisionStatuses: Record<string, any>;
  projectTotals: any;
  totalQuotes: number;
}

interface AIAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: ProjectAnalysisContext;
}

export default function AIAnalysisPanel({ isOpen, onClose, context }: AIAnalysisPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detailedContext, setDetailedContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load comprehensive project data when panel opens
  useEffect(() => {
    if (isOpen && !detailedContext) {
      loadComprehensiveContext();
    }
  }, [isOpen]);

  // Set initial greeting when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = generateContextualGreeting();
      setMessages([{
        id: 'initial-greeting',
        role: 'ai',
        content: greeting,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, context]);

  const loadComprehensiveContext = async () => {
    try {
      // Load detailed quote comparisons for each division
      const divisionComparisons = [];
      
      for (const division of context.divisions) {
        const divisionId = `${division.divisionCode}-${context.projectId}`;
        try {
          const compareData = await quotesApi.getCompare(divisionId);
          divisionComparisons.push({
            divisionCode: division.divisionCode,
            divisionName: division.divisionName,
            budget: division.divisionTotal,
            quotes: compareData.vendor_quotes || []
          });
        } catch (error) {
          // If no quotes for this division, still include it
          divisionComparisons.push({
            divisionCode: division.divisionCode,
            divisionName: division.divisionName,
            budget: division.divisionTotal,
            quotes: []
          });
        }
      }

      setDetailedContext({
        ...context,
        divisionComparisons
      });
    } catch (error) {
      console.error('Failed to load comprehensive context:', error);
    }
  };

  const generateContextualGreeting = () => {
    const { projectName, divisions, totalQuotes, projectTotals } = context;
    
    const budgetTotal = projectTotals?.jobTotal || 0;
    const divisionsWithQuotes = Object.values(context.divisionStatuses).filter(status => status.quote_count > 0).length;
    
    let greeting = `👋 Hello! I'm your AI procurement assistant for **${projectName}**.

**Project Overview:**
• Total Budget: $${budgetTotal.toLocaleString()}
• Divisions: ${divisions.length} (${divisionsWithQuotes} with quotes)
• Total Quotes Received: ${totalQuotes}

I can help you with:
🏆 **Vendor Analysis** - Compare pricing, performance, and recommendations
📊 **Budget Variance** - Identify over/under budget areas and risks
⚡ **Quick Insights** - "Which vendor offers the best value?" or "What are the biggest risks?"
🎯 **Award Strategy** - Optimize vendor selection across divisions

What would you like to analyze first?`;

    return greeting;
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
    setInputMessage('');
    setIsLoading(true);

    try {
      // Enhanced AI call with comprehensive context
      const response = await fetch(`${API_BASE}/ai/project-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          context: {
            type: 'project_analysis',
            projectId: context.projectId,
            projectName: context.projectName,
            divisions: context.divisions,
            divisionStatuses: context.divisionStatuses,
            projectTotals: context.projectTotals,
            totalQuotes: context.totalQuotes,
            detailedContext: detailedContext
          }
        })
      });
      
      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.ai_response || `I understand your question about "${inputMessage}". Let me analyze your project data and provide insights.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI analysis error:', error);
      
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: generateFallbackResponse(inputMessage),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackResponse = (question: string) => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('vendor') || lowerQuestion.includes('price') || lowerQuestion.includes('cost')) {
      return `Based on your project data, I can see ${context.totalQuotes} quotes across ${context.divisions.length} divisions. For specific vendor analysis, I'd need to examine the detailed quote comparisons. The AI service is temporarily unavailable, but I can help you analyze the data when it returns.`;
    }
    
    if (lowerQuestion.includes('budget') || lowerQuestion.includes('variance')) {
      return `Your project budget is $${context.projectTotals?.jobTotal?.toLocaleString() || 'not calculated'} across ${context.divisions.length} divisions. I can help analyze budget variances once the AI service is restored.`;
    }
    
    if (lowerQuestion.includes('risk') || lowerQuestion.includes('recommend')) {
      return `I can provide procurement recommendations based on your project's ${context.totalQuotes} quotes and division analysis. Please try again in a moment as the AI service reconnects.`;
    }
    
    return `I understand you're asking about "${question}". The AI analysis service is temporarily unavailable, but I have access to all your project data including divisions, quotes, and budget information. Please try again shortly.`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    "Which vendor offers the best value?",
    "What are the biggest budget risks?",
    "Show me pricing variances by division",
    "What vendors should I avoid?",
    "Recommend an award strategy"
  ];

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className={`fixed top-0 right-0 h-full w-1/2 min-w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                🤖 AI Project Analysis
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Intelligent insights for {context.projectName}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-2">
              <div className="text-2xl font-bold">${context.projectTotals?.jobTotal?.toLocaleString() || '0'}</div>
              <div className="text-xs text-blue-200">Total Budget</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-2">
              <div className="text-2xl font-bold">{context.divisions.length}</div>
              <div className="text-xs text-blue-200">Divisions</div>
            </div>
            <div className="bg-blue-800 bg-opacity-50 rounded-lg p-2">
              <div className="text-2xl font-bold">{context.totalQuotes}</div>
              <div className="text-xs text-blue-200">Total Quotes</div>
            </div>
          </div>
        </div>

        {/* Quick Questions */}
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Questions:</h3>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleQuickQuestion(question)}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" style={{ height: 'calc(100vh - 320px)' }}>
          {messages.map(message => (
            <div key={message.id} className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="text-left mb-4">
              <div className="inline-block bg-gray-100 text-gray-800 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  AI is analyzing your project data...
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white shadow-lg">
          <div className="mb-2">
            <div className="text-sm font-medium text-gray-700 mb-1">💬 Ask me anything about your project:</div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your question here... e.g., 'Which vendor should I choose for Division 04?'"
              className="flex-1 border-2 border-blue-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
            <span>💡 Press Enter to send</span>
            <span>•</span>
            <span>🧠 AI has access to all project data including budgets, quotes, and vendor comparisons</span>
          </div>
        </div>
        
      </div>
    </>
  );
}