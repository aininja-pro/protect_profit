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
  level: 'division' | 'subcategory';
  subcategory?: string;
}

interface SubcategoryQuote {
  subcategory_name: string;
  subcategory_code: string;
  budget_amount: number;
  quotes: Quote[];
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
          variance_percent: ((85300 - divisionTotal) / divisionTotal) * 100,
          level: 'division'
        },
        {
          vendor_name: "East Manatee 8-26", 
          total_price: 93800,
          status: 'received',
          timeline: "4 weeks",
          variance_percent: ((93800 - divisionTotal) / divisionTotal) * 100,
          level: 'division'
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
          variance_percent: ((32000 - divisionTotal) / divisionTotal) * 100,
          level: 'division'
        }
      ];
    }
    
    return [];
  };

  // Get subcategory quotes for mixed scenarios
  const getSubcategoryQuotes = (divisionCode: string, division: any): SubcategoryQuote[] => {
    if (divisionCode === '04') {
      return [
        {
          subcategory_name: "2250 - Concrete Flatwork",
          subcategory_code: "2250", 
          budget_amount: 45300,
          quotes: [
            {
              vendor_name: "ABC Concrete Co",
              total_price: 42000,
              status: 'received',
              variance_percent: ((42000 - 45300) / 45300) * 100,
              level: 'subcategory',
              subcategory: "2250 - Concrete Flatwork"
            },
            {
              vendor_name: "ProConcrete Inc",
              total_price: 44500,
              status: 'received',
              variance_percent: ((44500 - 45300) / 45300) * 100,
              level: 'subcategory',
              subcategory: "2250 - Concrete Flatwork"
            }
          ]
        },
        {
          subcategory_name: "2280 - Concrete Block Walls", 
          subcategory_code: "2280",
          budget_amount: 40000,
          quotes: [
            {
              vendor_name: "BlockMaster Pro",
              total_price: 38500,
              status: 'received',
              variance_percent: ((38500 - 40000) / 40000) * 100,
              level: 'subcategory', 
              subcategory: "2280 - Concrete Block Walls"
            }
          ]
        }
      ];
    }
    return [];
  };

  // Detect if division has mixed-level quotes
  const hasMixedQuotes = (divisionCode: string, division: any): boolean => {
    const divisionQuotes = getDivisionQuotes(divisionCode, division.divisionTotal || 0);
    const subcategoryQuotes = getSubcategoryQuotes(divisionCode, division);
    return divisionQuotes.length > 0 && subcategoryQuotes.length > 0;
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
          const divisionQuotes = getDivisionQuotes(division.divisionCode, division.divisionTotal || 0);
          const subcategoryQuotes = getSubcategoryQuotes(division.divisionCode, division);
          const isMixed = hasMixedQuotes(division.divisionCode, division);
          const isExpanded = expandedDivisions.has(division.divisionCode);
          
          const totalQuoteCount = divisionQuotes.length + subcategoryQuotes.reduce((sum, sub) => sum + sub.quotes.length, 0);
          const hasAnyQuotes = totalQuoteCount > 0;

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
                    {/* Quote Count & Status */}
                    {isMixed ? (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        🔀 Mixed Quotes ({totalQuoteCount})
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        hasAnyQuotes 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {hasAnyQuotes ? `${totalQuoteCount} quotes` : 'No quotes'}
                      </span>
                    )}

                    {/* Budget */}
                    <span className="text-sm text-gray-600">
                      ${division.divisionTotal?.toLocaleString() || '0'} budget
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!hasAnyQuotes && (
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
                  {hasAnyQuotes ? (
                    <>
                      {/* Division-Level Quotes Section */}
                      {divisionQuotes.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-medium text-gray-900 mb-3">
                            📋 Division-Level Quotes ({divisionQuotes.length})
                          </h4>
                          <div className="space-y-2">
                            {divisionQuotes.map((quote, index) => {
                              const quoteId = `${division.divisionCode}-div-${index}`;
                              const isQuoteExpanded = expandedDivisions.has(quoteId);
                              
                              return (
                                <div key={index} className="border rounded-lg overflow-hidden">
                                  <div 
                                    className="flex items-center justify-between p-3 bg-white hover:bg-gray-50 cursor-pointer"
                                    onClick={() => toggleDivision(quoteId)}
                                  >
                                    <div className="flex items-center space-x-3">
                                      <span className="text-sm text-gray-500">
                                        {isQuoteExpanded ? '▼' : '▶'}
                                      </span>
                                      <div className="font-medium text-gray-900">{quote.vendor_name}</div>
                                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
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
                                  
                                  {/* Division Quote Details */}
                                  {isQuoteExpanded && (
                                    <div className="border-t bg-gray-50 p-3">
                                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                        <div>
                                          <span className="text-gray-600">Coverage:</span>
                                          <span className="ml-2 text-gray-900">Complete division (all subcategories)</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Status:</span>
                                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                                            quote.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {quote.status}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <div className="flex space-x-2">
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
                        </div>
                      )}

                      {/* Subcategory-Level Quotes Section */}
                      {subcategoryQuotes.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-medium text-gray-900 mb-3">
                            🎯 Subcategory-Level Quotes
                          </h4>
                          <div className="space-y-3">
                            {subcategoryQuotes.map((subcat, subcatIndex) => (
                              <div key={subcatIndex} className="border-l-4 border-blue-400 bg-blue-50 rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="font-medium text-blue-900">
                                    {subcat.subcategory_name}
                                  </div>
                                  <div className="text-sm text-blue-700">
                                    Budget: ${subcat.budget_amount.toLocaleString()}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  {subcat.quotes.map((quote, quoteIndex) => {
                                    const subcatQuoteId = `${division.divisionCode}-sub-${subcatIndex}-${quoteIndex}`;
                                    const isSubcatQuoteExpanded = expandedDivisions.has(subcatQuoteId);
                                    
                                    return (
                                      <div key={quoteIndex} className="border rounded bg-white">
                                        <div 
                                          className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
                                          onClick={() => toggleDivision(subcatQuoteId)}
                                        >
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">
                                              {isSubcatQuoteExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className="font-medium text-gray-900">{quote.vendor_name}</span>
                                            <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                              Specialist
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-bold">
                                              ${quote.total_price.toLocaleString()}
                                            </div>
                                            <div className={`text-xs ${
                                              Math.abs(quote.variance_percent) < 1 ? 'text-green-600' :
                                              quote.variance_percent > 0 ? 'text-red-600' : 'text-blue-600'
                                            }`}>
                                              {Math.abs(quote.variance_percent) < 1 ? 'On budget' :
                                              quote.variance_percent > 0 ? `+${Math.round(quote.variance_percent)}% over` :
                                              `${Math.round(Math.abs(quote.variance_percent))}% under`}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Subcategory Quote Details */}
                                        {isSubcatQuoteExpanded && (
                                          <div className="border-t bg-gray-50 p-2">
                                            <div className="flex space-x-2 text-xs">
                                              <button className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                                Award Subcategory
                                              </button>
                                              <button className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                                                Clarify
                                              </button>
                                              <button className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strategy Comparison for Mixed Quotes */}
                      {isMixed && (
                        <div className="mb-4">
                          <h4 className="font-medium text-gray-900 mb-3">💡 Strategy Analysis</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option A - Division Quote */}
                            <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                              <div className="font-medium text-green-900 mb-2">
                                Option A - Division Quote
                              </div>
                              <div className="text-sm text-green-800">
                                <div>Best: East Manatee 3-21</div>
                                <div className="font-bold">${divisionQuotes[0]?.total_price.toLocaleString()}</div>
                                <div className="text-xs mt-1">
                                  ✅ Single vendor coordination<br/>
                                  ❌ Higher cost, less specialization
                                </div>
                              </div>
                            </div>
                            
                            {/* Option B - Specialist Mix */}
                            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                              <div className="font-medium text-blue-900 mb-2">
                                Option B - Specialist Mix
                              </div>
                              <div className="text-sm text-blue-800">
                                <div className="mb-1">
                                  ABC Concrete Co + BlockMaster
                                </div>
                                <div className="text-xs text-blue-700 mb-1">
                                  (Best from each subcategory)
                                </div>
                                <div className="font-bold">
                                  ${(subcategoryQuotes.reduce((sum, sub) => {
                                    const bestQuote = sub.quotes.reduce((best, current) => 
                                      current.total_price < best.total_price ? current : best
                                    );
                                    return sum + bestQuote.total_price;
                                  }, 0)).toLocaleString()}
                                </div>
                                <div className="text-xs mt-1">
                                  ✅ ${(divisionQuotes[0]?.total_price || 0) - (subcategoryQuotes.reduce((sum, sub) => {
                                    const bestQuote = sub.quotes.reduce((best, current) => 
                                      current.total_price < best.total_price ? current : best
                                    );
                                    return sum + bestQuote.total_price;
                                  }, 0))} savings, specialized<br/>
                                  ❌ Multiple vendor coordination
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Recommendation */}
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start space-x-2">
                          <span className="text-blue-600">🤖</span>
                          <div>
                            <div className="font-medium text-blue-900">AI Recommendation:</div>
                            <div className="text-sm text-blue-800">
                              {isMixed ? 
                                "Go with specialists (Option B) - Save $4,800 with better expertise. Ensure coordination between ABC and BlockMaster on material interfaces." :
                                getAIRecommendation(divisionQuotes)
                              }
                            </div>
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