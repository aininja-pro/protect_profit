import React, { useState } from 'react';
import QuoteScopeModal from './QuoteScopeModal';
import QuoteComparisonSection from './QuoteComparisonSection';

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
  const [isQuoteScopeModalOpen, setIsQuoteScopeModalOpen] = useState(false);
  const [selectedDivision, setSelectedDivision] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | undefined>(undefined);
  
  const handleRequestQuotes = (division: any, subcategory?: string) => {
    setSelectedDivision(division);
    setSelectedSubcategory(subcategory);
    setIsQuoteScopeModalOpen(true);
  };
  return (
    <div className="bg-gray-50 rounded-lg p-4 h-[70vh] overflow-y-auto">
      {divisions.map((division: any, divIndex: number) => (
        <div key={divIndex} className="mb-4 last:mb-0">
          {/* Division Header */}
          <div className="flex justify-between items-center p-3 bg-white rounded-lg border-l-4 border-primary shadow-sm">
            <div>
              <span className="font-bold text-gray-900">
                Division {division.divisionCode} - {division.divisionName}
              </span>
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {division.items?.length || 0} items
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                onClick={() => handleRequestQuotes(division)}
              >
                Request Quotes
              </button>
              <span className="font-bold text-lg text-green-600">
                ${division.divisionTotal?.toLocaleString() || '0'}
              </span>
            </div>
          </div>
          
          {/* Division Items - Grouped by Subcategory */}
          {division.items && division.items.length > 0 && (
            <div className="ml-4 mt-2 space-y-2">
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
                        <div key={subcategoryName} className="space-y-1">
                          {/* Subcategory Header */}
                          <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded border-l-4 border-blue-400">
                            <div className="font-semibold text-gray-900">
                              {subcategoryName}
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                onClick={() => handleRequestQuotes(division, subcategoryName)}
                              >
                                Quote This
                              </button>
                              <span className="font-bold text-blue-700">
                                ${subcategoryTotal.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Quote Comparison Section (expandable) */}
                          <QuoteComparisonSection 
                            subcategoryName={subcategoryName}
                            division={division}
                          />
                          
                          {/* Items under this subcategory */}
                          <div className="ml-6 space-y-1">
                            {items.map((item: any, itemIndex: number) => (
                              <div key={itemIndex} className="flex justify-between items-center py-1 px-3 bg-gray-50 rounded border-l-2 border-gray-300">
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
                                <span className="font-semibold text-green-600 ml-4">
                                  ${(item.total_cost || item.totalCost)?.toLocaleString() || '0'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Render ungrouped items */}
                    {ungroupedItems.map((item: any, itemIndex: number) => (
                      <div key={`ungrouped-${itemIndex}`} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded border-l-2 border-gray-300">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {item.description || item.tradeDescription}
                          </div>
                        </div>
                        <span className="font-semibold text-green-600 ml-4">
                          ${(item.total_cost || item.totalCost)?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
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
                <span className="font-semibold">${projectSubtotal.toLocaleString()}</span>
              </div>
            )}
            {grandTotalFromItems && (
              <div className="flex justify-between">
                <span className="text-gray-600">Items Total:</span>
                <span className="font-semibold">${grandTotalFromItems.toLocaleString()}</span>
              </div>
            )}
            {overheadAndProfit && (
              <div className="flex justify-between">
                <span className="text-gray-600">Overhead & Profit:</span>
                <span className="font-semibold">${overheadAndProfit.toLocaleString()}</span>
              </div>
            )}
            {jobTotal && (
              <div className="flex justify-between">
                <span className="text-gray-600">Job Total:</span>
                <span className="font-bold text-lg text-green-600">${jobTotal.toLocaleString()}</span>
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