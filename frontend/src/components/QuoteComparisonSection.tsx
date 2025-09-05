import React, { useState, useEffect } from 'react';

interface QuoteComparisonSectionProps {
  subcategoryName: string;
  division: any;
}

interface Quote {
  vendor_name: string;
  total_price: number;
  status: 'pending' | 'received' | 'awarded';
  timeline?: string;
  notes?: string;
  scope?: 'full' | 'partial';
  scope_notes?: string;
}

export default function QuoteComparisonSection({ 
  subcategoryName, 
  division 
}: QuoteComparisonSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  
  // Enhanced scope selection state
  const [quoteScope, setQuoteScope] = useState<'full' | 'partial'>('full');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [scopeNotes, setScopeNotes] = useState<string>('');

  // Mock quote data - replace with actual API call
  const mockQuotes: Quote[] = [
    {
      vendor_name: "ABC Millwork",
      total_price: 14500,
      status: 'received',
      timeline: "4 weeks",
      notes: "Standard millwork",
      scope: 'full'
    },
    {
      vendor_name: "Custom Door Co",
      total_price: 15800,
      status: 'received', 
      timeline: "3 weeks",
      notes: "Specializes in barn doors",
      scope: 'partial',
      scope_notes: "Includes doors only, excludes hardware installation"
    },
    {
      vendor_name: "Premier Trim", 
      total_price: 13900,
      status: 'pending',
      timeline: "6 weeks",
      notes: "Lowest bid",
      scope: 'full'
    }
  ];

  const loadQuotes = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/quotes/subcategory/${subcategoryName}`);
      // setQuotes(response.data);
      
      // For demo, only show mock subcategory quotes for specific subcategories
      if (subcategoryName.includes('5300 - Interior Doors') || subcategoryName.includes('Interior Doors')) {
        setQuotes(mockQuotes);
      } else {
        setQuotes([]); // No quotes for other subcategories yet
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
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
              quotes.map((quote, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{quote.vendor_name}</div>
                    <div className="text-xs text-gray-500">
                      {quote.timeline && `Timeline: ${quote.timeline}`}
                      {quote.notes && ` • ${quote.notes}`}
                    </div>
                    {quote.scope === 'partial' && quote.scope_notes && (
                      <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">
                        📝 Partial scope: {quote.scope_notes}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">
                        ${quote.total_price.toLocaleString()}
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
                          <button className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                            Delete
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleUploadQuote(quote.vendor_name)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Upload
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
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
                      (${subcategoryItems.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0).toLocaleString()})
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
                      (${selectedTotal.toLocaleString()} selected)
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
                            ${itemCost.toLocaleString()}
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
                      <span className="font-bold text-green-800">${selectedTotal.toLocaleString()}</span>
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
                onClick={() => {
                  // TODO: Implement upload logic with scope data
                  console.log('Upload quote:', {
                    vendor: selectedVendor,
                    scope: quoteScope,
                    selectedItems: Array.from(selectedItems),
                    notes: scopeNotes,
                    total: quoteScope === 'partial' ? selectedTotal : subcategoryItems.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0)
                  });
                  handleCloseModal();
                }}
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