import React, { useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  context: {
    type: 'project' | 'division' | 'subcategory';
    projectId: string;
    divisionId?: string;
    subcategoryName?: string;
  };
}

export default function AIAssistant({ context }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: `Hi! I'm your procurement assistant. I have access to all your ${context.divisionId ? 'division' : 'project'} data. Ask me about quotes, vendors, timelines, or any decisions you need to make.`,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getContextDisplay = () => {
    if (context.subcategoryName) return context.subcategoryName;
    if (context.divisionId) return `Division ${context.divisionId}`;
    return 'Project Overview';
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
      // TODO: Replace with actual API call
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `I understand you're asking about "${inputMessage}". Based on the current ${context.type} context, I can help analyze that. [This will connect to the actual AI API]`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      setIsLoading(false);
      console.error('AI chat error:', error);
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
          <div className="bg-primary text-white p-3 rounded-t-lg flex justify-between items-center">
            <div>
              <div className="font-semibold">🤖 AI Assistant</div>
              <div className="text-xs opacity-90">{getContextDisplay()}</div>
            </div>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-white hover:bg-primary-dark rounded p-1"
            >
              ✕
            </button>
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