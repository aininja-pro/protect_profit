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
  coverage: 'complete_division' | 'specific_items' | 'full_division';
  timeline?: string;
  notes?: string;
  variance_percent?: number;
  scope_type?: 'complete_division' | 'specific_items';
  scope_info?: {
    description: string;
    indicator: string;
    coverage: string;
  };
  scope_budget?: number;
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
  const [divisionAnalysis, setDivisionAnalysis] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // Enhanced scope selection state
  const [scopeType, setScopeType] = useState<'complete_division' | 'specific_items'>('complete_division');
  const [selectedScopeItems, setSelectedScopeItems] = useState<string[]>([]);
  const [scopeBudgetTotal, setScopeBudgetTotal] = useState<number>(0);
  
  // Quote management state
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingVendorName, setEditingVendorName] = useState<string>('');

  // Helper function to format currency without decimals
  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString();
  };

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

  // Helper function to build scope coverage information
  const buildScopeInfo = (vendorQuote: any, division: any) => {
    const scopeType = vendorQuote.scope_type || 'complete_division';
    const scopeBudget = vendorQuote.scope_budget_total || 0;
    const scopeItems = vendorQuote.scope_items || [];
    
    if (scopeType === 'complete_division') {
      return {
        description: `Complete Division: ${division.divisionCode} - ${division.divisionName}`,
        indicator: '🏗️ Complete Division',
        coverage: 'full'
      };
    } else {
      // For specific items, try to map scope items to division items
      const coveredItems = division.items?.filter((item: any) => 
        scopeItems.includes(item.lineId || `item-${division.items.indexOf(item)}`)
      ) || [];
      
      const itemNames = coveredItems.map((item: any) => 
        item.tradeDescription || item.description || 'Unknown Item'
      ).join(', ') || 'Selected Items';
      
      const totalItems = division.items?.length || 0;
      const coveredCount = coveredItems.length;
      
      return {
        description: `Covers: ${itemNames} ($${scopeBudget.toLocaleString()} budget)`,
        indicator: `📦 ${coveredCount} of ${totalItems} items`,
        coverage: 'partial'
      };
    }
  };

  const loadDivisionQuotes = async () => {
    setLoading(true);
    try {
      // Load real quotes from backend
      const divisionId = `${division.divisionCode}-${projectId}`;
      console.log(`🔍 Loading quotes for division: ${divisionId} (Division ${division.divisionCode})`);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/divisions/${divisionId}/compare`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Convert backend quote data to component format and filter out incomplete quotes
        const quotes: DivisionQuote[] = data.vendor_quotes
          .map((vendorQuote: any) => {
            let totalPrice = vendorQuote.line_items.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);
            // Always prefer quote-level total when available (more reliable than line item math)
            if (vendorQuote.quote_level_total > 0) {
              totalPrice = vendorQuote.quote_level_total;
            }
            // Calculate variance against appropriate budget (scope budget vs division total)
            const scopeBudget = vendorQuote.scope_budget_total > 0 ? vendorQuote.scope_budget_total : division.divisionTotal;
            const variancePercent = scopeBudget > 0 ? 
              Math.round(((totalPrice - scopeBudget) / scopeBudget) * 100) : 0;
              
            // Build scope coverage description
            const scopeInfo = buildScopeInfo(vendorQuote, division);
            const scopeSummary = vendorQuote.normalized_json?.scope_summary || scopeInfo.description;
            
            return {
              quote_id: vendorQuote.quote_id,
              vendor_name: vendorQuote.vendor_name,
              total_price: totalPrice,
              status: vendorQuote.status === 'parsed' ? 'received' : vendorQuote.status,
              coverage: vendorQuote.scope_type || 'complete_division',
              timeline: '4 weeks',
              notes: scopeSummary,
              variance_percent: variancePercent,
              // Add scope information for display
              scope_type: vendorQuote.scope_type || 'complete_division',
              scope_info: scopeInfo,
              scope_budget: scopeBudget,
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

  const fetchDivisionAnalysis = async () => {
    if (divisionQuotes.length === 0) {
      setDivisionAnalysis('');
      return;
    }

    setAnalysisLoading(true);
    try {
      // Build dynamic budget line item structure
      const lineItems = division.items?.map((item: any) => ({
        lineId: item.lineId || `${division.divisionCode}-${item.description?.toLowerCase().replace(/\s+/g, '-')}`,
        name: item.tradeDescription || item.description || 'Unknown Item',
        budget: item.totalCost || item.total_cost || 0
      })) || [];

      // Enhance quotes with scope mapping to line items
      const enhancedQuotes = divisionQuotes.map((quote: any) => ({
        ...quote,
        scopeItems: quote.scope_type === 'specific_items' ? 
          (quote.scope_info?.description || 'Unknown scope') : 'Complete Division',
        scopeBudget: quote.scope_budget || division.divisionTotal,
        coverageType: quote.scope_type || 'complete_division'
      }));

      const context = {
        type: 'division',
        divisionId: division.divisionCode,
        divisionName: division.divisionName,
        totalBudget: division.divisionTotal,
        lineItems: lineItems,
        quotes: enhancedQuotes
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/ai/division-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze division quotes',
          context
        })
      });

      if (response.ok) {
        const data = await response.json();
        setDivisionAnalysis(data.ai_response || 'Analysis unavailable');
      } else {
        setDivisionAnalysis('AI analysis temporarily unavailable');
      }
    } catch (error) {
      console.error('Division analysis failed:', error);
      setDivisionAnalysis('AI analysis temporarily unavailable');
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    // Load quotes immediately on mount to get accurate counts
    loadDivisionQuotes();
  }, []);
  
  useEffect(() => {
    if (isExpanded && divisionQuotes.length === 0) {
      loadDivisionQuotes();
    }
  }, [isExpanded]);

  useEffect(() => {
    // Auto-update analysis when quotes change
    if (isExpanded && divisionQuotes.length > 0) {
      fetchDivisionAnalysis();
    }
  }, [divisionQuotes, isExpanded]);

  const handleUploadQuote = (vendorName?: string) => {
    setSelectedVendor(vendorName || '');
    setSelectedFile(null);
    setUploadResult(null);
    // Reset scope selection to defaults
    setScopeType('complete_division');
    setSelectedScopeItems([]);
    setScopeBudgetTotal(division.divisionTotal || 0);
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
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/${quote.quote_id}`, {
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

  const handleEditVendorName = (quote: DivisionQuote) => {
    setEditingQuoteId(quote.quote_id || null);
    setEditingVendorName(quote.vendor_name);
  };

  const handleSaveVendorName = async (quoteId: string) => {
    if (!editingVendorName.trim()) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/${quoteId}/vendor-name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: editingVendorName.trim() })
      });
      
      if (response.ok) {
        // Reload quotes to reflect name change
        await loadDivisionQuotes();
        setEditingQuoteId(null);
        setEditingVendorName('');
      } else {
        alert('Failed to update vendor name');
      }
    } catch (error) {
      console.error('Edit failed:', error);
      alert('Failed to update vendor name');
    }
  };

  const handleCancelEdit = () => {
    setEditingQuoteId(null);
    setEditingVendorName('');
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedVendor.trim()) {
      alert('Please select a file and enter vendor name');
      return;
    }

    setIsUploading(true);
    try {
      console.log("🚀 REAL UPLOAD: Starting upload for", selectedVendor);
      
      // Step 1: Upload the file with enhanced scope data
      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('vendor_name', selectedVendor);
      formData.append('file', selectedFile);
      // Enhanced scope information
      formData.append('scope_type', scopeType);
      formData.append('scope_items', JSON.stringify(selectedScopeItems));
      formData.append('scope_budget_total', scopeBudgetTotal.toString());
      formData.append('scope_notes', `${scopeType === 'complete_division' ? 'Complete division coverage' : 'Partial scope coverage'}`);
      
      console.log("🎯 SCOPE DATA:", {
        scope_type: scopeType,
        scope_items: selectedScopeItems,
        scope_budget_total: scopeBudgetTotal
      });

      const divisionId = `${division.divisionCode}-${projectId}`;
      
      const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/divisions/${divisionId}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const uploadResult = await uploadResponse.json();
      console.log("🚀 REAL UPLOAD: Upload response:", uploadResult);
      
      // Step 2: Parse the uploaded quote (REAL parsing with actual file)
      const parseResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/${uploadResult.quote_id}/parse`, {
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
        
        // Trigger fresh AI analysis with new quote
        setTimeout(fetchDivisionAnalysis, 1000); // Small delay to ensure quote data is loaded
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
          <span className="text-sm font-medium">💼 Quotes</span>
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
            <div className="space-y-4">
              {divisionQuotes.map((quote, idx) => {
                const quoteKey = quote.quote_id || `quote-${idx}`;
                const isExpanded = expandedQuotes.has(quoteKey);
                const hasLineItems = quote.line_items && quote.line_items.length > 0;
                
                return (
                  <div key={idx} className="group bg-white rounded-lg border border-gray-200 border-l-4 border-l-purple-400 shadow-sm hover:shadow-md transition-shadow">
                    {/* Main Quote Row */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">
                            {editingQuoteId === quote.quote_id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingVendorName}
                                  onChange={(e) => setEditingVendorName(e.target.value)}
                                  className="px-2 py-1 border rounded text-sm"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') handleSaveVendorName(quote.quote_id!);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveVendorName(quote.quote_id!)}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-gray-600 hover:text-gray-800 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span 
                                  onClick={() => handleEditVendorName(quote)}
                                  className="cursor-pointer hover:text-blue-600"
                                  title="Click to edit vendor name"
                                >
                                  {quote.vendor_name}
                                </span>
                                {quote.scope_type === 'specific_items' && quote.scope_info && (
                                  <span className="font-normal text-gray-600"> - {quote.scope_info.description.split('(')[0].replace('Covers: ', '')}</span>
                                )}
                                <button
                                  onClick={() => handleDeleteQuote(quote)}
                                  className="text-red-500 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete quote"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                          {hasLineItems && (
                            <button
                              onClick={() => toggleQuoteExpanded(quoteKey)}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
                              <span className="ml-1 text-gray-500">({quote.line_items?.length || 0} items)</span>
                            </button>
                          )}
                          {quote.variance_percent !== undefined && (
                            <span className={`text-xs px-2 py-1 rounded ${quote.variance_percent < 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {quote.variance_percent > 0 ? '+' : ''}{quote.variance_percent}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {quote.timeline && `Timeline: ${quote.timeline}`}
                          {quote.notes && ` • ${quote.notes}`}
                        </div>
                        {/* Enhanced scope coverage display */}
                        {quote.scope_type === 'specific_items' && quote.scope_info && (
                          <div className="text-xs text-blue-600 mt-1">
                            {quote.scope_info.indicator} - Partial division coverage
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            ${quote.total_price > 0 ? formatCurrency(quote.total_price) : 'TBD'}
                          </div>
                          {quote.scope_type === 'specific_items' && quote.scope_budget && (
                            <div className="text-xs text-gray-600">
                              vs ${formatCurrency(quote.scope_budget)} budget
                            </div>
                          )}
                          <div className={`text-xs ${
                            quote.variance_percent !== undefined && quote.variance_percent < 0 ? 'text-green-600' : 
                            quote.variance_percent !== undefined && quote.variance_percent > 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {quote.variance_percent !== undefined ? 
                              `${quote.variance_percent > 0 ? '+' : ''}${quote.variance_percent}% ${quote.variance_percent < 0 ? 'under' : 'over'} budget` :
                              quote.status
                            }
                          </div>
                        </div>
                        {/* Removed clutter buttons - actions moved to division level */}
                      </div>
                    </div>

                    {/* Collapsible Line Items */}
                    {hasLineItems && isExpanded && (
                      <div className="px-3 pb-3 border-t bg-gray-50">
                        <div className="text-xs font-medium text-gray-700 mb-2 pt-2">Quote Line Items:</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {quote.line_items?.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex justify-between text-xs bg-white p-2 rounded border">
                              <span className="flex-1">
                                {item.description}
                                {item.quantity && item.unit && (
                                  <span className="text-gray-500 ml-1">
                                    ({item.quantity} {item.unit})
                                  </span>
                                )}
                              </span>
                              <span className="font-medium ml-2">${formatCurrency(item.total_price)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
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
                      {analysisLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-3 h-3 border border-purple-600 border-t-transparent rounded-full"></div>
                          Analyzing quotes...
                        </div>
                      ) : (
                        <div>{divisionAnalysis || 'Click to expand for AI insights'}</div>
                      )}
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
              <label className="block font-medium mb-2">Quote Scope:</label>
              
              {/* Scope Type Selection */}
              <div className="mb-3">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="scopeType"
                      value="complete_division"
                      checked={scopeType === 'complete_division'}
                      onChange={(e) => {
                        setScopeType('complete_division');
                        setSelectedScopeItems([]);
                        setScopeBudgetTotal(division.divisionTotal || 0);
                      }}
                      className="mr-2"
                    />
                    Complete Division
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="scopeType"
                      value="specific_items"
                      checked={scopeType === 'specific_items'}
                      onChange={(e) => {
                        setScopeType('specific_items');
                        setSelectedScopeItems([]);
                        setScopeBudgetTotal(0);
                      }}
                      className="mr-2"
                    />
                    Specific Items
                  </label>
                </div>
              </div>

              {/* Scope Information Display */}
              {scopeType === 'complete_division' ? (
                <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded border">
                  <strong>Entire Division:</strong> {division.divisionCode} - {division.divisionName}
                  <br />
                  <span className="text-xs">Budget: ${division.divisionTotal?.toLocaleString() || '0'}</span>
                  <br />
                  <span className="text-xs text-green-600">✓ Covers all subcategories and line items</span>
                </div>
              ) : (
                <div className="text-sm border rounded p-3 bg-blue-50">
                  <div className="font-medium text-blue-800 mb-2">Select items this quote covers:</div>
                  <div className="text-xs text-blue-600 mb-3">
                    Budget Total: ${scopeBudgetTotal.toLocaleString()}
                  </div>
                  
                  {/* For now, show a simple interface - we'll enhance this later */}
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {division.items && division.items.length > 0 ? (
                      division.items.map((item: any, idx: number) => (
                        <label key={idx} className="flex items-start text-xs">
                          <input
                            type="checkbox"
                            className="mr-2 mt-0.5"
                            checked={selectedScopeItems.includes(item.lineId || `item-${idx}`)}
                            onChange={(e) => {
                              const itemId = item.lineId || `item-${idx}`;
                              const itemBudget = item.totalCost || item.total_cost || 0;
                              
                              if (e.target.checked) {
                                setSelectedScopeItems(prev => [...prev, itemId]);
                                setScopeBudgetTotal(prev => prev + itemBudget);
                              } else {
                                setSelectedScopeItems(prev => prev.filter(id => id !== itemId));
                                setScopeBudgetTotal(prev => prev - itemBudget);
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.tradeDescription || item.description}</div>
                            <div className="text-gray-500">${(item.totalCost || item.total_cost || 0).toLocaleString()}</div>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="text-gray-500 text-xs">No line items available for this division</div>
                    )}
                  </div>
                </div>
              )}
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