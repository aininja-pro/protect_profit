import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Division {
  divisionCode: string;
  divisionName: string;
  divisionTotal: number;
  quotes: Quote[];
}

interface Quote {
  vendor_name: string;
  total_price: number;
  status: 'received' | 'pending';
  timeline?: string;
  variance_percent: number;
}

interface SimpleQuotesOverviewProps {
  divisions: any[];
  projectId: string;
}

export default function SimpleQuotesOverview({ 
  divisions, 
  projectId 
}: SimpleQuotesOverviewProps) {
  const navigate = useNavigate();
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());

  // Get division quotes - matches DivisionQuoteSection data
  const getDivisionQuotes = (divisionCode: string, divisionTotal: number): Quote[] => {
    if (divisionCode === '04') {
      return [
        {
          vendor_name: "East Manatee 3-21",
          total_price: 85300,
          status: 'received',
          timeline: "4 weeks",
          variance_percent: ((85300 - divisionTotal) / divisionTotal) * 100
        },
        {
          vendor_name: "East Manatee 8-26", 
          total_price: 93800,
          status: 'received',
          timeline: "4 weeks",
          variance_percent: ((93800 - divisionTotal) / divisionTotal) * 100
        }
      ];
    }
    
    // Add mock quotes for other divisions to show the concept
    if (divisionCode === '05') {
      return [
        {
          vendor_name: "Elite Carpentry",
          total_price: 32000,
          status: 'received',
          timeline: "6 weeks", 
          variance_percent: ((32000 - divisionTotal) / divisionTotal) * 100
        }
      ];
    }
    
    return [];
  };

  const toggleDivision = (divisionCode: string) => {
    const newExpanded = new Set(expandedDivisions);
    if (newExpanded.has(divisionCode)) {
      newExpanded.delete(divisionCode);
    } else {
      newExpanded.add(divisionCode);
    }
    setExpandedDivisions(newExpanded);
  };

  const getAIRecommendation = (quotes: Quote[]) => {
    if (quotes.length === 0) return "Upload quotes to get AI recommendations";
    
    const bestQuote = quotes.reduce((best, current) => 
      current.total_price < best.total_price ? current : best
    );
    
    if (bestQuote.variance_percent <= 0) {
      return `✅ ${bestQuote.vendor_name} recommended - on budget with ${bestQuote.timeline}`;
    } else if (bestQuote.variance_percent <= 10) {
      return `⚠️ ${bestQuote.vendor_name} is lowest but ${bestQuote.variance_percent}% over budget`;
    } else {
      return `🚨 All quotes over budget - consider re-scoping or negotiation`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Project Quotes Overview</h1>
        <p className="text-gray-600">Simple, effective quote management</p>
      </div>

      <div className="space-y-4">
        {divisions.map((division) => {
          const quotes = getDivisionQuotes(division.divisionCode, division.divisionTotal || 0);
          const isExpanded = expandedDivisions.has(division.divisionCode);
          const quoteCount = quotes.length;
          const hasQuotes = quoteCount > 0;

          return (
            <div key={division.divisionCode} className="bg-white rounded-lg border shadow-sm">
              {/* Division Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleDivision(division.divisionCode)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900">
                      {isExpanded ? '▼' : '▶'} Division {division.divisionCode} - {division.divisionName}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Quote Count */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      hasQuotes 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {hasQuotes ? `${quoteCount} quotes` : 'No quotes'}
                    </span>

                    {/* Budget */}
                    <span className="text-sm text-gray-600">
                      ${division.divisionTotal?.toLocaleString() || '0'} budget
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!hasQuotes && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${projectId}/divisions/${division.divisionCode}-${projectId}/quotes/upload`);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                    >
                      📤 Upload Quotes
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4">
                  {hasQuotes ? (
                    <>
                      {/* Quotes List */}
                      <div className="space-y-3 mb-4">
                        {quotes.map((quote, index) => {
                          const quoteId = `${division.divisionCode}-${index}`;
                          const isQuoteExpanded = expandedDivisions.has(quoteId);
                          
                          return (
                            <div key={index} className="border rounded-lg overflow-hidden">
                              {/* Quote Header */}
                              <div 
                                className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 cursor-pointer"
                                onClick={() => toggleDivision(quoteId)}
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-sm text-gray-500">
                                    {isQuoteExpanded ? '▼' : '▶'}
                                  </span>
                                  <div className="font-medium text-gray-900">{quote.vendor_name}</div>
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    Full division
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-lg">
                                    ${quote.total_price.toLocaleString()}
                                  </div>
                                  <div className={`text-sm ${
                                    Math.abs(quote.variance_percent) < 1 ? 'text-green-600' :
                                    quote.variance_percent > 0 ? 'text-red-600' : 'text-blue-600'
                                  }`}>
                                    {Math.abs(quote.variance_percent) < 1 ? 'On budget' :
                                    quote.variance_percent > 0 ? `+${Math.round(quote.variance_percent)}% over` :
                                    `${Math.round(Math.abs(quote.variance_percent))}% under`}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Quote Details */}
                              {isQuoteExpanded && (
                                <div className="border-t bg-gray-50 p-3">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600">Coverage:</span>
                                      <span className="ml-2 text-gray-900">Complete division (all subcategories)</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Timeline:</span>
                                      <span className="ml-2 text-gray-900">{quote.timeline || 'TBD'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Status:</span>
                                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                        quote.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {quote.status}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Source:</span>
                                      <span className="ml-2 text-gray-900">AI Parsed from uploaded file</span>
                                    </div>
                                  </div>
                                  
                                  {/* Action Buttons */}
                                  <div className="mt-3 flex space-x-2">
                                    <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                                      Award Division
                                    </button>
                                    <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                                      Clarify
                                    </button>
                                    <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* AI Recommendation */}
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start space-x-2">
                          <span className="text-blue-600">🤖</span>
                          <div>
                            <div className="font-medium text-blue-900">AI Recommendation:</div>
                            <div className="text-sm text-blue-800">{getAIRecommendation(quotes)}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📋</div>
                      <div className="font-medium">No quotes uploaded yet</div>
                      <div className="text-sm">Upload quotes to see analysis and recommendations</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}