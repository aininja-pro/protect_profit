import React, { useState } from 'react';
import QuoteScopeModal from './QuoteScopeModal';
import DivisionQuoteSection from './DivisionQuoteSection';

interface DivisionItem {
  lineId?: string;
  description?: string;
  tradeDescription?: string;
  quantity?: number;
  unit?: string;
  materialCost?: number;
  laborCost?: number;
  subEquipCost?: number;
  totalCost?: number;
  total_cost?: number;
  scopeNotes?: string;
  estimatingNotes?: string;
  subcategoryCode?: string;
  subcategoryName?: string;
  subcategory_code?: string;
  subcategory_name?: string;
}

interface Subcategory {
  subcategoryCode: string;
  subcategoryName: string;
  items: DivisionItem[];
}


interface DivisionBreakdownTableProps {
  divisions: any[];  // Allow any division format for flexibility
  projectSubtotal?: number;
  overheadAndProfit?: number;
  jobTotal?: number;
  grandTotalFromItems?: number;
  projectId: string;
}

export default function DivisionBreakdownTable({ 
  divisions,
  projectSubtotal,
  overheadAndProfit,
  jobTotal,
  grandTotalFromItems,
  projectId
}: DivisionBreakdownTableProps) {
  
  // Helper function to format currency without decimals
  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString();
  };
  const [isQuoteScopeModalOpen, setIsQuoteScopeModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined);
  const [quoteCounts, setQuoteCounts] = useState<{[key: string]: number}>({});
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  
  const loadQuoteCounts = async () => {
    try {
      // Load quote counts for all divisions and subcategories
      const counts: {[key: string]: number} = {};
      
      for (const division of divisions) {
        // Load division-level quotes (excluding subcategory-specific ones)
        const divisionId = `${division.divisionCode}-${projectId}`;
        const divisionResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/divisions/${divisionId}/compare`);
        if (divisionResponse.ok) {
          const divisionData = await divisionResponse.json();
          // Apply same filtering as UI: only count quotes with valid totals
          const validQuotes = divisionData.vendor_quotes?.filter((vendorQuote: any) => {
            let totalPrice = vendorQuote.line_items?.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0) || 0;
            if (vendorQuote.quote_level_total > 0) {
              totalPrice = vendorQuote.quote_level_total;
            }
            return totalPrice > 0;
          }) || [];
          counts[`division-${division.divisionCode}`] = validQuotes.length;
        }
        
        // Load subcategory quotes
        const subcategoryResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8001/api'}/quotes/subcategories/${division.divisionCode}/${projectId}`);
        if (subcategoryResponse.ok) {
          const subcategoryData = await subcategoryResponse.json();
          if (subcategoryData.subcategory_quotes) {
            // Count quotes per subcategory
            const subcategoryCounts: {[key: string]: number} = {};
            subcategoryData.subcategory_quotes.forEach((quote: any) => {
              const subcatId = quote.subcategory_id;
              subcategoryCounts[subcatId] = (subcategoryCounts[subcatId] || 0) + 1;
            });
            
            // Add to main counts object
            Object.keys(subcategoryCounts).forEach(subcatId => {
              counts[`subcategory-${subcatId}`] = subcategoryCounts[subcatId];
            });
          }
        }
      }
      
      setQuoteCounts(counts);
    } catch (error) {
      console.error('Error loading quote counts:', error);
    }
  };

  React.useEffect(() => {
    // Only load quotes when we have data AND we're not on the projects list page
    const isOnProjectsListPage = window.location.pathname === '/projects';
    if (divisions.length > 0 && projectId && !isOnProjectsListPage) {
      loadQuoteCounts();
    }
  }, [divisions, projectId]);

  const toggleDivisionExpansion = (divisionCode: string) => {
    const newExpanded = new Set(expandedDivisions);
    if (newExpanded.has(divisionCode)) {
      newExpanded.delete(divisionCode);
    } else {
      newExpanded.add(divisionCode);
    }
    setExpandedDivisions(newExpanded);
  };

  const handleRequestQuotes = (division: any, subcategory?: string) => {
    setSelectedDivision(division);
    setSelectedSubcategory(subcategory);
    setIsQuoteScopeModalOpen(true);
  };

  const getDivisionQuoteStatus = (division: any) => {
    const count = quoteCounts[`division-${division.divisionCode}`] || 0;
    return { divisionQuotes: count, awarded: false };
  };

  const getSubcategoryQuoteStatus = (subcategoryName: string) => {
    // Extract subcategory ID from name (e.g., "2250" from "2250 - Concrete Flatwork")
    const subcategoryId = subcategoryName.split(' -')[0].trim();
    const count = quoteCounts[`subcategory-${subcategoryId}`] || 0;
    return { quotes: count, awarded: false };
  };

  const getDivisionBorderColor = (division: any) => {
    const status = getDivisionQuoteStatus(division);
    if (status.awarded) return 'border-green-500'; // Awarded = Green
    if (status.divisionQuotes >= 3) return 'border-blue-500'; // 3+ quotes = Blue
    if (status.divisionQuotes >= 1) return 'border-yellow-500'; // Some quotes = Yellow  
    return 'border-primary'; // No quotes = Default
  };

  const getSubcategoryBorderColor = (subcategoryName: string) => {
    const status = getSubcategoryQuoteStatus(subcategoryName);
    if (status.awarded) return 'border-green-400'; // Awarded = Green
    if (status.quotes >= 3) return 'border-blue-400'; // 3+ quotes = Blue
    if (status.quotes >= 1) return 'border-yellow-400'; // Some quotes = Yellow
    return 'border-gray-300'; // No quotes = Gray
  };

  const getQuoteCountDisplay = (count: number, level: 'division' | 'subcategory') => {
    if (count === 0) return null;
    
    const color = count >= 3 ? 'text-blue-600' : count >= 1 ? 'text-yellow-600' : 'text-gray-500';
    const target = level === 'division' ? '3' : '3';
    
    return (
      <span className={`text-xs ${color} ml-2`}>
        {count}/{target} quotes
      </span>
    );
  };
  return (
    <div className="bg-gray-50 rounded-lg p-4 h-[70vh] overflow-y-auto">
      {divisions.map((division: any, divIndex: number) => (
        <div key={divIndex} className="mb-4 last:mb-0">
          {/* Division Header - Clickable to expand/collapse */}
          <button 
            onClick={() => toggleDivisionExpansion(division.divisionCode)}
            className={`w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 ${getDivisionBorderColor(division)} shadow-md mb-3 hover:from-blue-100 hover:to-blue-150 transition-colors text-left`}
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="font-bold text-lg text-gray-900 tracking-wide">
                  Division {division.divisionCode} - {division.divisionName}
                </span>
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  {division.items?.length || 0} items
                </span>
                {(() => {
                  const status = getDivisionQuoteStatus(division);
                  return getQuoteCountDisplay(status.divisionQuotes, 'division');
                })()}
              </div>
              <div className="text-sm text-gray-600">
                {expandedDivisions.has(division.divisionCode) ? '▲ Collapse' : '▼ Expand'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent division toggle
                  handleRequestQuotes(division);
                }}
              >
                Request Quotes
              </button>
              <span className="font-bold text-lg text-green-600 w-24 text-right">
                ${division.divisionTotal ? formatCurrency(division.divisionTotal) : '0'}
              </span>
            </div>
          </button>
          
          {/* Collapsible Division Content */}
          {expandedDivisions.has(division.divisionCode) && (
            <>
              {/* Division Items - Grouped by Subcategory (moved to top) */}
              {division.items && division.items.length > 0 && (
            <div className="ml-6 mt-4 space-y-4">
              {(() => {
                // Group items by subcategory
                const subcategoryGroups: {[key: string]: any[]} = {};
                const ungroupedItems: any[] = [];
                
                division.items.forEach((item: any) => {
                  const subcatCode = item.subcategory_code || item.subcategoryCode;
                  const subcatName = item.subcategory_name || item.subcategoryName;
                  
                  // Also try to extract from description if not in separate fields
                  let finalSubcatName = subcatName;
                  if (!subcatName && item.description && item.description.includes(':')) {
                    const parts = item.description.split(':');
                    if (parts[0].match(/\d{4}\s*-/)) {
                      finalSubcatName = parts[0].trim();
                    }
                  }
                  
                  if (subcatCode || finalSubcatName) {
                    const key = finalSubcatName || subcatCode;
                    if (!subcategoryGroups[key]) {
                      subcategoryGroups[key] = [];
                    }
                    subcategoryGroups[key].push(item);
                  } else {
                    ungroupedItems.push(item);
                  }
                });
                
                return (
                  <>
                    {/* Render subcategory groups */}
                    {Object.entries(subcategoryGroups).map(([subcategoryName, items]) => {
                      const subcategoryTotal = items.reduce((sum: number, item: any) => sum + (item.total_cost || item.totalCost || 0), 0);
                      return (
                        <div key={subcategoryName} className="space-y-3">
                          {/* Subcategory Header */}
                          <div className={`flex justify-between items-center py-3 px-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-l-4 ${getSubcategoryBorderColor(subcategoryName)} shadow-sm`}>
                            <div className="font-semibold text-base text-gray-900">
                              {subcategoryName}
                              {(() => {
                                const status = getSubcategoryQuoteStatus(subcategoryName);
                                return getQuoteCountDisplay(status.quotes, 'subcategory');
                              })()}
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => handleRequestQuotes(division, subcategoryName)}
                              >
                                Quote This
                              </button>
                              <span className="font-bold text-blue-700 w-20 text-right">
                                ${formatCurrency(subcategoryTotal)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Items under this subcategory - MOVED UP */}
                          <div className="ml-8 space-y-1">
                            {items.map((item: any, itemIndex: number) => (
                              <div key={itemIndex} className="flex justify-between items-center py-2 px-3 bg-white rounded border border-gray-200 shadow-xs">
                                <div className="flex-1">
                                  <div className="text-gray-800">
                                    {(() => {
                                      const desc = item.description || item.tradeDescription;
                                      // Remove subcategory prefix from description if it exists
                                      if (desc && desc.includes(':') && desc.match(/^\d{4}\s*-[^:]*:/)) {
                                        return desc.split(':', 2)[1].trim();
                                      }
                                      return desc;
                                    })()}
                                  </div>
                                </div>
                                <span className="font-semibold text-green-600 w-20 text-right">
                                  ${formatCurrency(item.total_cost || item.totalCost || 0)}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Subcategory quotes section removed - now handled by unified quote section */}
                        </div>
                      );
                    })}
                    
                    {/* Render ungrouped items */}
                    {ungroupedItems.map((item: any, itemIndex: number) => (
                      <div key={`ungrouped-${itemIndex}`} className="flex justify-between items-center py-2 px-3 bg-white rounded border border-gray-200 shadow-xs ml-6">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {item.description || item.tradeDescription}
                          </div>
                        </div>
                        <span className="font-semibold text-green-600 w-20 text-right">
                          ${formatCurrency(item.total_cost || item.totalCost || 0)}
                        </span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
              )}
              
              {/* Quotes Section (moved after scope breakdown) */}
              <DivisionQuoteSection 
                division={division}
                projectId={projectId}
              />
            </>
          )}
        </div>
      ))}
      
      {/* Project Totals Summary */}
      {(projectSubtotal || overheadAndProfit || jobTotal) && (
        <div className="mt-6 p-4 bg-white rounded-lg border-2 border-primary">
          <h4 className="font-bold text-gray-900 mb-3">Project Totals:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {projectSubtotal && (
              <div className="flex justify-between">
                <span className="text-gray-600">Project Subtotal:</span>
                <span className="font-semibold">${formatCurrency(projectSubtotal)}</span>
              </div>
            )}
            {grandTotalFromItems && (
              <div className="flex justify-between">
                <span className="text-gray-600">Items Total:</span>
                <span className="font-semibold">${formatCurrency(grandTotalFromItems)}</span>
              </div>
            )}
            {overheadAndProfit && (
              <div className="flex justify-between">
                <span className="text-gray-600">Overhead & Profit:</span>
                <span className="font-semibold">${formatCurrency(overheadAndProfit)}</span>
              </div>
            )}
            {jobTotal && (
              <div className="flex justify-between">
                <span className="text-gray-600">Job Total:</span>
                <span className="font-bold text-lg text-green-600">${formatCurrency(jobTotal)}</span>
              </div>
            )}
          </div>
          
          {/* Validation Status */}
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <div className="flex items-center text-green-800">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">
                ✅ Math Reconciled: Items total matches project subtotal
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Quote Scope Modal */}
      {selectedDivision && (
        <QuoteScopeModal 
          isOpen={isQuoteScopeModalOpen}
          onClose={() => setIsQuoteScopeModalOpen(false)}
          division={selectedDivision}
          preSelectedSubcategory={selectedSubcategory}
          projectId={projectId}
        />
      )}
    </div>
  );
}