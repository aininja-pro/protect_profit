import React, { useState, useEffect } from 'react';

interface QuoteComparisonSectionProps {
  subcategoryName: string;
  division: any;
  projectId?: string;
}

interface Quote {
  quote_id?: string;
  vendor_name: string;
  total_price: number;
  status: 'pending' | 'received' | 'awarded';
  timeline?: string;
  notes?: string;
  scope?: 'full' | 'partial';
  scope_notes?: string;
  line_items?: Array<{
    description: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    total_price: number;
  }>;
}

export default function QuoteComparisonSection({ 
  subcategoryName, 
  division,
  projectId 
}: QuoteComparisonSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  
  // Enhanced scope selection state
  const [quoteScope, setQuoteScope] = useState<'full' | 'partial'>('full');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [scopeNotes, setScopeNotes] = useState<string>('');

  // Helper function to format currency without decimals
  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString();
  };

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const currentProjectId = projectId || 'c846ba2d-6b71-4216-b44c-964adebd6078';
      const response = await fetch(`http://localhost:8001/api/quotes/subcategories/${division.divisionCode}/${currentProjectId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Filter quotes for this specific subcategory
        const subcategoryId = subcategoryName.split(' -')[0].trim();
        const filteredQuotes = data.subcategory_quotes?.filter((quote: any) => 
          quote.subcategory_id === subcategoryId
        ) || [];
        
        // Convert to our Quote interface format
        const formattedQuotes = filteredQuotes.map((quote: any) => ({
          quote_id: quote.id,
          vendor_name: quote.vendor_name,
          total_price: quote.normalized_json?.pricing_summary?.total_amount || 0,
          status: quote.status === 'parsed' ? 'received' : 'pending',
          timeline: quote.normalized_json?.timeline?.completion_date || '',
          notes: quote.normalized_json?.scope_summary || '',
          scope: quote.scope_type || 'full',
          scope_notes: quote.scope_notes || '',
          line_items: quote.normalized_json?.line_items || []
        }));
        
        setQuotes(formattedQuotes);
      } else {
        setQuotes([]);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load quotes immediately on mount to get accurate counts
    loadQuotes();
  }, []);
  
  useEffect(() => {
    if (isExpanded && quotes.length === 0) {
      loadQuotes();
    }
  }, [isExpanded]);

  const handleUploadQuote = (vendorName: string) => {
    setSelectedVendor(vendorName);
    setShowUploadModal(true);
    // Reset scope selections when opening modal
    setQuoteScope('full');
    setSelectedItems(new Set());
    setScopeNotes('');
  };

  const handleCloseModal = () => {
    setShowUploadModal(false);
    // Reset form state
    setSelectedVendor('');
    setQuoteScope('full');
    setSelectedItems(new Set());
    setScopeNotes('');
    setSelectedFile(null);
  };

  const handleSubcategoryUpload = async () => {
    if (!selectedFile || !selectedVendor.trim()) {
      alert('Please select a file and enter vendor name');
      return;
    }

    setIsUploading(true);
    try {
      // Use subcategory upload endpoint instead of division
      const formData = new FormData();
      const currentProjectId = projectId || 'c846ba2d-6b71-4216-b44c-964adebd6078'; // Use prop or fallback
      formData.append('project_id', currentProjectId);
      formData.append('division_code', division.divisionCode);
      formData.append('vendor_name', selectedVendor);
      formData.append('scope_type', quoteScope);
      formData.append('scope_items', JSON.stringify(Array.from(selectedItems)));
      formData.append('scope_notes', scopeNotes);
      formData.append('file', selectedFile);

      // Extract subcategory ID from subcategory name (e.g., "2250" from "2250 - Concrete Flatwork")
      const subcategoryId = subcategoryName.split(' -')[0].trim();
      
      const uploadResponse = await fetch(`http://localhost:8001/api/quotes/subcategories/${subcategoryId}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const uploadResult = await uploadResponse.json();
      
      // Parse the uploaded quote
      const parseResponse = await fetch(`http://localhost:8001/api/quotes/${uploadResult.quote_id}/parse`, {
        method: 'POST'
      });
      
      if (!parseResponse.ok) {
        throw new Error(`Parse failed: ${parseResponse.statusText}`);
      }
      
      const parseResult = await parseResponse.json();
      
      alert(`✅ Subcategory quote uploaded and parsed!\n\nVendor: ${uploadResult.vendor_name}\nSubcategory: ${subcategoryName}\nTotal: $${parseResult.total_amount ? formatCurrency(parseResult.total_amount) : '0'}\nConfidence: ${Math.round((parseResult.confidence_score || 0) * 100)}%`);
      handleCloseModal();
      // Refresh the quotes list to show the new upload
      await loadQuotes();
      
    } catch (error) {
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string, vendorName: string) => {
    if (!window.confirm(`Are you sure you want to delete the quote from ${vendorName}?`)) {
      return;
    }

    setIsDeleting(quoteId);
    try {
      const response = await fetch(`http://localhost:8001/api/quotes/${quoteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      alert(`✅ Quote from ${vendorName} deleted successfully`);
      // Refresh the quotes list
      await loadQuotes();
    } catch (error) {
      alert(`Failed to delete quote: ${error}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const toggleQuoteDetails = (quoteId: string) => {
    const newExpanded = new Set(expandedQuotes);
    if (newExpanded.has(quoteId)) {
      newExpanded.delete(quoteId);
    } else {
      newExpanded.add(quoteId);
    }
    setExpandedQuotes(newExpanded);
  };

  // Get budget line items for this subcategory
  const getSubcategoryItems = () => {
    if (!division?.items) return [];
    
    return division.items.filter((item: any) => {
      const itemSubcat = item.subcategory_name || item.subcategoryName;
      const itemSubcatCode = item.subcategory_code || item.subcategoryCode;
      
      // Match by subcategory name or extract from description
      if (itemSubcat && subcategoryName.includes(itemSubcat)) return true;
      if (itemSubcatCode && subcategoryName.includes(itemSubcatCode)) return true;
      
      // Extract subcategory from description for items like "2250 - Concrete Flatwork: Stem Wall"
      if (item.description && item.description.includes(':')) {
        const descPrefix = item.description.split(':')[0].trim();
        if (subcategoryName.includes(descPrefix)) return true;
      }
      
      return false;
    });
  };

  const subcategoryItems = getSubcategoryItems();

  // Handle scope selection changes
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allItemIds = subcategoryItems.map((item: any) => item.lineId || item.description);
      setSelectedItems(new Set(allItemIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Calculate total of selected items
  const getSelectedTotal = () => {
    return subcategoryItems
      .filter((item: any) => selectedItems.has(item.lineId || item.description))
      .reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0);
  };

  const selectedTotal = getSelectedTotal();
  const allItemsSelected = subcategoryItems.length > 0 && selectedItems.size === subcategoryItems.length;


  return (
    <div className="ml-6 mt-1">
      {/* Subcategory-Level Quotes Header */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-900">📋 Subcategory Quotes</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              quotes.length === 0 ? 'bg-gray-100 text-gray-600' :
              quotes.filter(q => q.status === 'received').length > 0 ? 'bg-green-100 text-green-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {quotes.length === 0 ? 'No quotes' : `${quotes.length} quotes`}
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            {isExpanded ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
        
        {/* Simple Quote List (consistent with division-level) */}
        {isExpanded && (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-2 text-sm text-gray-500">
                Loading quotes...
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-2 text-sm text-gray-500">
                No quotes uploaded yet
              </div>
            ) : (
              <div className="space-y-3">
              {quotes.map((quote, idx) => {
                const quoteKey = quote.quote_id || `quote-${idx}`;
                const isExpanded = expandedQuotes.has(quoteKey);
                const hasLineItems = quote.line_items && quote.line_items.length > 0;
                
                return (
                  <div key={idx} className="bg-white rounded-lg border border-gray-200 border-l-4 border-l-blue-400 shadow-sm hover:shadow-md transition-shadow">
                    {/* Main Quote Row */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{quote.vendor_name}</div>
                          {hasLineItems && (
                            <button
                              onClick={() => toggleQuoteDetails(quoteKey)}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                            >
                              {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
                              <span className="ml-1 text-gray-500">({quote.line_items?.length || 0} items)</span>
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {quote.timeline && `Timeline: ${quote.timeline}`}
                          {quote.notes && ` • ${quote.notes}`}
                        </div>
                        {quote.scope === 'partial' && quote.scope_notes && (
                          <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded inline-block">
                            📝 Partial scope: {quote.scope_notes}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            ${formatCurrency(quote.total_price)}
                          </div>
                          <div className={`text-xs ${
                            quote.status === 'received' ? 'text-green-600' : 
                            quote.status === 'awarded' ? 'text-green-700' : 'text-yellow-600'
                          }`}>
                            {quote.status}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {quote.status === 'received' ? (
                            <>
                              <button className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                Award
                              </button>
                              <button className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                                Clarify
                              </button>
                              <button 
                                onClick={() => quote.quote_id && handleDeleteQuote(quote.quote_id, quote.vendor_name)}
                                disabled={isDeleting === quote.quote_id}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {isDeleting === quote.quote_id ? 'Deleting...' : 'Delete'}
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleUploadQuote(quote.vendor_name)}
                                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                              >
                                Upload
                              </button>
                              <button 
                                onClick={() => quote.quote_id && handleDeleteQuote(quote.quote_id, quote.vendor_name)}
                                disabled={isDeleting === quote.quote_id}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                {isDeleting === quote.quote_id ? 'Deleting...' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
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
                                    ({item.quantity} {item.unit}
                                    {item.unit_price && ` @ $${item.unit_price}`})
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
              })
              }
              </div>
            )}
            
            {/* Upload Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                📎 Upload Subcategory Quote
              </button>
              <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
                ➕ Add Vendor
              </button>
              <button className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
                📧 Send Reminders
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Quote Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Upload Quote</h3>
              <button 
                onClick={handleCloseModal}
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
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <div className="mb-4">
              <label className="block font-medium mb-2">Subcategory:</label>
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {subcategoryName}
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block font-medium mb-2">Quote Scope:</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="quoteScope" 
                    value="full" 
                    className="mr-2"
                    checked={quoteScope === 'full'}
                    onChange={(e) => setQuoteScope('full')}
                  />
                  <span className="text-sm">Full subcategory (all items)</span>
                  {subcategoryItems.length > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (${formatCurrency(subcategoryItems.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0))})
                    </span>
                  )}
                </label>
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="quoteScope" 
                    value="partial" 
                    className="mr-2"
                    checked={quoteScope === 'partial'}
                    onChange={(e) => setQuoteScope('partial')}
                  />
                  <span className="text-sm">Partial scope (select items below)</span>
                  {quoteScope === 'partial' && selectedTotal > 0 && (
                    <span className="text-xs text-green-600 ml-2 font-medium">
                      (${formatCurrency(selectedTotal)} selected)
                    </span>
                  )}
                </label>
              </div>
            </div>
            
            {/* Enhanced Item Selection */}
            {quoteScope === 'partial' && subcategoryItems.length > 0 && (
              <div className="mb-4">
                <label className="block font-medium mb-2">Select Items Included in Quote:</label>
                <div className="border rounded p-3 bg-gray-50 max-h-48 overflow-y-auto">
                  {/* Select All */}
                  <label className="flex items-center mb-2 pb-2 border-b">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={allItemsSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                    <span className="font-medium text-sm">Select All</span>
                    {subcategoryItems.length > 0 && (
                      <span className="text-xs text-gray-500 ml-auto">
                        {selectedItems.size}/{subcategoryItems.length} items
                      </span>
                    )}
                  </label>
                  
                  {/* Individual Items */}
                  <div className="space-y-1">
                    {subcategoryItems.map((item: any, index: number) => {
                      const itemId = item.lineId || item.description;
                      const itemCost = item.total_cost || item.totalCost || 0;
                      const itemDesc = item.description || item.tradeDescription || `Item ${index + 1}`;
                      
                      return (
                        <label key={itemId} className="flex items-center justify-between py-1">
                          <div className="flex items-center flex-1">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={selectedItems.has(itemId)}
                              onChange={(e) => handleItemSelect(itemId, e.target.checked)}
                            />
                            <span className="text-sm text-gray-800 flex-1">
                              {itemDesc.length > 40 ? `${itemDesc.substring(0, 40)}...` : itemDesc}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-gray-600 ml-2">
                            ${formatCurrency(itemCost)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                
                {/* Selected Total */}
                {selectedTotal > 0 && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-800">Selected Items Total:</span>
                      <span className="font-bold text-green-800">${formatCurrency(selectedTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="mb-6">
              <label className="block font-medium mb-2">Additional Notes:</label>
              <textarea
                value={scopeNotes}
                onChange={(e) => setScopeNotes(e.target.value)}
                placeholder="Any special conditions, exclusions, or anomalies..."
                className="w-full border rounded p-2 text-sm h-16 resize-none"
              />
              <div className="text-xs text-gray-500 mt-1">
                Example: "Material costs only, labor to be provided by GC"
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                onClick={handleSubcategoryUpload}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload & Parse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}