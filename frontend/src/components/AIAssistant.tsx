import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AIContext {
  type: 'project' | 'division' | 'subcategory';
  projectId: string;
  divisionId?: string;
  divisionName?: string;
  subcategoryName?: string;
  quotes?: any[];
  budget?: number;
  description?: string;
}

interface AIAssistantProps {
  context: AIContext;
  onContextUpdate?: (newContext: AIContext) => void;
}

export default function AIAssistant({ context, onContextUpdate }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentContext, setCurrentContext] = useState<AIContext>(context);
  const [availableContexts, setAvailableContexts] = useState<AIContext[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update greeting when context changes
  useEffect(() => {
    const greeting = getContextualGreeting(currentContext);
    setMessages([{
      id: Date.now().toString(),
      role: 'ai',
      content: greeting,
      timestamp: new Date()
    }]);
  }, [currentContext]);

  const getContextualGreeting = (ctx: AIContext) => {
    if (ctx.type === 'division' && ctx.quotes && ctx.quotes.length > 0) {
      return `I can see you're analyzing Division ${ctx.divisionId} quotes. I have access to ${ctx.quotes.length} division quotes totaling ${ctx.budget ? '$' + ctx.budget.toLocaleString() : 'TBD'}. Ask me about award strategies, vendor comparisons, or timeline analysis.`;
    } else if (ctx.type === 'subcategory' && ctx.quotes && ctx.quotes.length > 0) {
      return `I'm focused on ${ctx.subcategoryName} quotes. I can see ${ctx.quotes.length} quotes received. Ask me about vendor recommendations, pricing analysis, or scope clarifications.`;
    } else if (ctx.type === 'division') {
      return `I'm focused on Division ${ctx.divisionId} - ${ctx.divisionName}. I can help with RFQ creation, vendor selection, or procurement strategy for this division.`;
    } else {
      return `Hi! I'm your procurement assistant for this project. I can help with RFQ creation, quote analysis, vendor decisions, and award strategies. What would you like to analyze?`;
    }
  };

  const getContextDisplay = () => {
    if (currentContext.subcategoryName) return currentContext.subcategoryName;
    if (currentContext.divisionId) return `Division ${currentContext.divisionId}`;
    return 'Project Overview';
  };

  const handleContextSwitch = (newContext: AIContext) => {
    setCurrentContext(newContext);
    if (onContextUpdate) {
      onContextUpdate(newContext);
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
    setInputMessage('');
    setIsLoading(true);

    try {
      // Real OpenAI API call with context
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          context: currentContext
        })
      });
      
      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.ai_response || `I understand your question about "${inputMessage}". Based on my ${currentContext.type} context, I can help with that analysis.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      console.error('AI chat error:', error);
      
      // Fallback response
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `I understand your question about "${inputMessage}". AI chat temporarily unavailable - please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ? (
        <div className="bg-white rounded-lg shadow-2xl border w-96 h-[500px] flex flex-col">
          {/* Header */}
          <div className="bg-primary text-white p-3 rounded-t-lg">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-semibold">🤖 AI Assistant</div>
                <div className="text-xs opacity-90 mt-1">
                  Context: {getContextDisplay()}
                </div>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-white hover:bg-primary-dark rounded p-1 ml-2"
              >
                ✕
              </button>
            </div>
            
            {/* Context Switcher */}
            <div className="mt-2 pt-2 border-t border-primary-dark">
              <select 
                value={`${currentContext.type}-${currentContext.divisionId || 'project'}-${currentContext.subcategoryName || ''}`}
                onChange={(e) => {
                  const [type, divisionId, subcategoryName] = e.target.value.split('-');
                  const newContext: AIContext = {
                    type: type as any,
                    projectId: currentContext.projectId,
                    divisionId: divisionId !== 'project' ? divisionId : undefined,
                    subcategoryName: subcategoryName || undefined
                  };
                  handleContextSwitch(newContext);
                }}
                className="w-full text-xs bg-primary-dark text-white border border-primary-light rounded px-2 py-1 cursor-pointer appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 16 16'%3e%3cpath d='m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z'/%3e%3c/svg%3e\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center", backgroundSize: "12px" }}
              >
                <option value="project-project-">Project Overview</option>
                <option value="division-11-">Division 11 - Finish Carpentry</option>
                <option value="subcategory-11-5300 - Interior Doors">5300 - Interior Doors</option>
                <option value="subcategory-11-5350 - Interior Door Hardware">5350 - Interior Door Hardware</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                  message.role === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-2 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    AI is thinking...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about quotes, vendors, timelines..."
                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-3 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary-dark transition-all hover:scale-105"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div className="text-sm">
              <div className="font-semibold">AI Assistant</div>
              <div className="text-xs opacity-90">{getContextDisplay()}</div>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}