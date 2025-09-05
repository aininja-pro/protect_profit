import React, { useState, useEffect } from 'react';

interface DivisionQuoteSectionProps {
  division: any;
  projectId: string;
  onContextUpdate?: (context: any) => void;
}

interface DivisionQuote {
  quote_id?: string;
  vendor_name: string;
  total_price: number;
  status: 'pending' | 'received' | 'awarded';
  coverage: 'full_division';
  timeline?: string;
  notes?: string;
  variance_percent?: number;
  line_items?: Array<{
    description: string;
    total_price: number;
    quantity?: number;
    unit?: string;
  }>;
  vendor_info?: {
    contact_email?: string;
    contact_phone?: string;
    quote_date?: string;
  };
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());

  // Mock division-level quotes - replace with actual API call
  const mockDivisionQuotes: DivisionQuote[] = [
    // Division 04 - Concrete/Masonry quotes
    ...(division.divisionCode === '04' ? [
      {
        vendor_name: "East Manatee 3-21",
        total_price: 85300,
        status: 'received' as const,
        coverage: 'full_division' as const,
        timeline: "4 weeks",
        notes: "AI Parsed from uploaded file",
        variance_percent: 0 // On budget
      },
      {
        vendor_name: "East Manatee 8-26", 
        total_price: 93800,
        status: 'received' as const,
        coverage: 'full_division' as const,
        timeline: "4 weeks", 
        notes: "AI Parsed from uploaded file",
        variance_percent: 10 // 10% over budget
      }
    ] : []),
    // Other divisions - original mock data
    ...(division.divisionCode !== '04' ? [
      {
        vendor_name: "Elite Carpentry",
        total_price: 32000,
        status: 'received' as const,
        coverage: 'full_division' as const,
        timeline: "6 weeks",
        notes: "Complete finish carpentry package",
        variance_percent: -5
      },
      {
        vendor_name: "Premier Contractors", 
        total_price: 34500,
        status: 'received' as const,
        coverage: 'full_division' as const,
        timeline: "4 weeks",
        notes: "Fast timeline, higher cost",
        variance_percent: 3
      }
    ] : [])
  ];

  const loadDivisionQuotes = async () => {
    setLoading(true);
    try {
      // Load real quotes from backend
      const divisionId = `${division.divisionCode}-${projectId}`;
      console.log(`🔍 Loading quotes for division: ${divisionId} (Division ${division.divisionCode})`);
      const response = await fetch(`http://localhost:8001/api/quotes/divisions/${divisionId}/compare`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Convert backend quote data to component format and filter out incomplete quotes
        const quotes: DivisionQuote[] = data.vendor_quotes
          .map((vendorQuote: any) => {
            const totalPrice = vendorQuote.line_items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
            const variancePercent = division.divisionTotal > 0 ? 
              Math.round(((totalPrice - division.divisionTotal) / division.divisionTotal) * 100) : 0;
              
            return {
              quote_id: vendorQuote.quote_id,
              vendor_name: vendorQuote.vendor_name,
              total_price: totalPrice,
              status: vendorQuote.status === 'parsed' ? 'received' : vendorQuote.status,
              coverage: 'full_division',
              timeline: '4 weeks',
              notes: 'AI Parsed from uploaded file',
              variance_percent: variancePercent,
              line_items: vendorQuote.line_items.map((item: any) => ({
                description: item.description,
                total_price: item.total_price,
                quantity: item.quantity,
                unit: item.unit
              }))
            };
          })
          .filter((quote: DivisionQuote) => quote.total_price > 0); // Only show quotes with actual parsed totals
        
        setDivisionQuotes(quotes);
      } else {
        setDivisionQuotes([]);
      }
    } catch (error) {
      console.error('Error loading division quotes:', error);
      setDivisionQuotes([]);
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
    setSelectedFile(null);
    setUploadResult(null);
    setShowUploadModal(true);
  };

  const toggleQuoteExpanded = (quoteId: string) => {
    setExpandedQuotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quoteId)) {
        newSet.delete(quoteId);
      } else {
        newSet.add(quoteId);
      }
      return newSet;
    });
  };

  const handleDeleteQuote = async (quote: DivisionQuote) => {
    if (!quote.quote_id) return;
    
    const confirmDelete = window.confirm(`Delete quote from ${quote.vendor_name} ($${quote.total_price.toLocaleString()})?`);
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`http://localhost:8001/api/quotes/${quote.quote_id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Reload quotes to reflect deletion
        await loadDivisionQuotes();
        alert('Quote deleted successfully');
      } else {
        alert('Failed to delete quote');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete quote');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedVendor.trim()) {
      alert('Please select a file and enter vendor name');
      return;
    }

    setIsUploading(true);
    try {
      console.log("🚀 REAL UPLOAD: Starting upload for", selectedVendor);
      
      // Step 1: Upload the file (REAL upload, not fake)
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('vendor_name', selectedVendor);
      formData.append('file', selectedFile);

      const divisionId = `${division.divisionCode}-${projectId}`;
      
      const uploadResponse = await fetch(`http://localhost:8001/api/quotes/divisions/${divisionId}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const uploadResult = await uploadResponse.json();
      console.log("🚀 REAL UPLOAD: Upload response:", uploadResult);
      
      // Step 2: Parse the uploaded quote (REAL parsing with actual file)
      const parseResponse = await fetch(`http://localhost:8001/api/quotes/${uploadResult.quote_id}/parse`, {
        method: 'POST'
      });
      
      if (!parseResponse.ok) {
        throw new Error(`Parse failed: ${parseResponse.statusText}`);
      }
      
      const result = await parseResponse.json();
      console.log("🚀 REAL UPLOAD: Parse response:", result);
      setUploadResult(result);
      
      if (result.confidence_score >= 0.7) {
        alert(`✅ Division quote parsed successfully!\n\nVendor: ${result.vendor_name}\nTotal: $${result.total_amount?.toLocaleString()}\nConfidence: ${Math.round(result.confidence_score * 100)}%\n\nQuote added to division comparison.`);
        
        // Reload quotes from database to show the newly uploaded quote
        await loadDivisionQuotes();
        setShowUploadModal(false);
      } else {
        alert(`⚠️ Quote parsed with low confidence (${Math.round(result.confidence_score * 100)}%)\n\nPlease review the parsed data and correct any issues.`);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        // For PDF files, we'll need backend processing - for now use filename
        resolve(`PDF file: ${file.name} - Backend PDF extraction needed for full parsing`);
      } else if (file.type.includes('text') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        resolve(`File: ${file.name} - Backend extraction needed for this format`);
      }
    });
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
                        <button
                          onClick={() => quote.quote_id && toggleQuoteExpanded(quote.quote_id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedQuotes.has(quote.quote_id || '') ? '▼' : '▶'}
                        </button>
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
                            <button 
                              onClick={() => handleDeleteQuote(quote)}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            >
                              Delete
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
                  
                  {/* Expanded Quote Details */}
                  {expandedQuotes.has(quote.quote_id || '') && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-700 mb-2 font-medium">Line Items:</div>
                      <div className="space-y-2">
                        {quote.line_items?.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between items-start text-sm">
                            <div className="flex-1 pr-3">
                              <div className="text-gray-900">{item.description}</div>
                              {(item.quantity || item.unit) && (
                                <div className="text-gray-500 text-xs">
                                  {item.quantity && `${item.quantity} `}{item.unit || ''}
                                </div>
                              )}
                            </div>
                            <div className="font-medium text-gray-900">
                              ${item.total_price.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full border rounded p-2"
              />
              {selectedFile && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
                </div>
              )}
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
                onClick={handleFileUpload}
                disabled={!selectedFile || !selectedVendor.trim() || isUploading}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? '🤖 AI Parsing...' : '📎 Upload & Parse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}