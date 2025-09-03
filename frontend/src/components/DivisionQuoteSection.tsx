import React, { useState, useEffect } from 'react';

interface DivisionQuoteSectionProps {
  division: any;
  projectId: string;
  onContextUpdate?: (context: any) => void;
}

interface DivisionQuote {
  vendor_name: string;
  total_price: number;
  status: 'pending' | 'received' | 'awarded';
  coverage: 'full_division';
  timeline?: string;
  notes?: string;
  variance_percent?: number;
}

export default function DivisionQuoteSection({ 
  division, 
  projectId,
  onContextUpdate 
}: DivisionQuoteSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [divisionQuotes, setDivisionQuotes] = useState<DivisionQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  // Mock division-level quotes - replace with actual API call
  const mockDivisionQuotes: DivisionQuote[] = [
    {
      vendor_name: "Elite Carpentry",
      total_price: 32000,
      status: 'received',
      coverage: 'full_division',
      timeline: "6 weeks",
      notes: "Complete finish carpentry package",
      variance_percent: -5 // 5% under budget
    },
    {
      vendor_name: "Premier Contractors", 
      total_price: 34500,
      status: 'received',
      coverage: 'full_division',
      timeline: "4 weeks",
      notes: "Fast timeline, higher cost",
      variance_percent: 3 // 3% over budget
    },
    {
      vendor_name: "Master Millwork",
      total_price: 0,
      status: 'pending',
      coverage: 'full_division',
      timeline: "TBD",
      notes: "Quote pending"
    }
  ];

  const loadDivisionQuotes = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/quotes/division/${division.divisionCode}`);
      
      // For demo, only show mock data for specific divisions
      if (division.divisionCode === '11') {
        // Only show division quotes for Division 11 (Finish Carpentry)
        setDivisionQuotes(mockDivisionQuotes);
      } else {
        setDivisionQuotes([]);
      }
    } catch (error) {
      console.error('Error loading division quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      loadDivisionQuotes();
    }
  }, [isExpanded]);

  const handleUploadQuote = (vendorName?: string) => {
    setSelectedVendor(vendorName || '');
    setShowUploadModal(true);
  };

  const getDivisionQuoteStatus = () => {
    if (divisionQuotes.length === 0) return { status: 'none', text: 'No quotes', color: 'text-gray-500' };
    
    const receivedQuotes = divisionQuotes.filter(q => q.status === 'received').length;
    const awardedQuotes = divisionQuotes.filter(q => q.status === 'awarded').length;
    
    if (awardedQuotes > 0) return { status: 'awarded', text: 'Division Awarded', color: 'text-green-600' };
    if (receivedQuotes > 0) return { status: 'received', text: `${receivedQuotes} division quotes`, color: 'text-purple-600' };
    return { status: 'pending', text: `${divisionQuotes.length} pending`, color: 'text-yellow-600' };
  };

  const quoteStatus = getDivisionQuoteStatus();

  return (
    <div className="ml-4 mt-2 mb-3">
      {/* Division Quote Status Indicator */}
      <button
        onClick={() => {
          const newExpanded = !isExpanded;
          setIsExpanded(newExpanded);
          
          // Update AI context when expanding division quotes
          if (newExpanded && onContextUpdate) {
            onContextUpdate({
              type: 'division',
              projectId: projectId,
              divisionId: division.divisionCode,
              divisionName: division.divisionName,
              quotes: divisionQuotes,
              budget: division.divisionTotal
            });
          }
        }}
        className="flex items-center justify-between w-full p-3 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">🏗️ Division-Level Quotes</span>
          <span className={`text-xs ${quoteStatus.color}`}>
            {quoteStatus.text}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {isExpanded ? '▲ Hide' : '▼ Manage'}
        </span>
      </button>

      {/* Expandable Division Quote Management */}
      {isExpanded && (
        <div className="mt-2 bg-white border border-purple-200 rounded p-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-purple-800">
              Division {division.divisionCode} - Complete Package Quotes
            </h4>
            <div className="text-sm text-gray-600">
              Budget: ${division.divisionTotal?.toLocaleString() || '0'}
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full"></div>
                Loading division quotes...
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {divisionQuotes.map((quote, idx) => (
                <div key={idx} className={`p-3 rounded border ${
                  quote.status === 'received' ? 'border-green-200 bg-green-50' :
                  quote.status === 'awarded' ? 'border-purple-200 bg-purple-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{quote.vendor_name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          quote.status === 'awarded' ? 'bg-purple-100 text-purple-800' :
                          quote.status === 'received' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {quote.status}
                        </span>
                        {quote.variance_percent !== undefined && (
                          <span className={`text-xs ${quote.variance_percent < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {quote.variance_percent > 0 ? '+' : ''}{quote.variance_percent}%
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {quote.notes} • Timeline: {quote.timeline}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        ${quote.total_price > 0 ? quote.total_price.toLocaleString() : 'TBD'}
                      </div>
                      <div className="mt-1">
                        {quote.status === 'received' ? (
                          <div className="flex gap-1">
                            <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                              Award Division
                            </button>
                            <button className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                              Clarify
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleUploadQuote(quote.vendor_name)}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            📎 Upload
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Division Quote Actions */}
              <div className="mt-4 pt-3 border-t flex gap-2">
                <button 
                  onClick={() => handleUploadQuote()}
                  className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-1"
                >
                  📎 Upload Division Quote
                </button>
                <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
                  ➕ Add Vendor
                </button>
                <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
                  📧 Send Reminders
                </button>
              </div>
              
              {/* AI Analysis for Division Quotes */}
              {divisionQuotes.some(q => q.status === 'received') && (
                <div className="mt-3 p-3 bg-purple-50 rounded border border-purple-200">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-600">🤖</span>
                    <div className="text-sm text-purple-800">
                      <div className="font-medium">AI Division Analysis:</div>
                      <div>Elite Carpentry offers excellent value at 5% under budget. Their 6-week timeline fits your schedule. Consider Elite for full division award, or break out specialty items (barn door) for Custom Door Co.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Quote Upload Modal - same as subcategory but for division scope */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Upload Division Quote</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block font-medium mb-2">Vendor:</label>
              <input 
                type="text" 
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                placeholder="Vendor name"
                className="w-full border rounded p-2"
              />
            </div>
            
            <div className="mb-4">
              <label className="block font-medium mb-2">Quote File:</label>
              <input 
                type="file" 
                accept=".pdf,.doc,.docx,.xlsx,.xls,.csv"
                className="w-full border rounded p-2"
              />
            </div>
            
            <div className="mb-6">
              <label className="block font-medium mb-2">Scope:</label>
              <div className="text-sm text-gray-600 bg-purple-50 p-2 rounded border">
                <strong>Entire Division:</strong> {division.divisionCode} - {division.divisionName}
                <br />
                <span className="text-xs">Covers all subcategories and line items</span>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Upload & Parse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}