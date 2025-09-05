import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { quotesApi } from '../services/quotesApi';
import LiveAnalysisPanel from './LiveAnalysisPanel';
import ProjectBreadcrumb from './ProjectBreadcrumb';
import { analysisEngine } from '../services/analysisEngine';

interface BudgetLine {
  lineId: string;
  tradeDescription: string;
  quantity?: number;
  unit?: string;
  totalCost: number;
}

interface VendorQuote {
  vendor_id: string;
  vendor_name: string;
  quote_id: string;
  status: string;
  line_items: Array<{
    quote_line_id: string;
    description: string;
    total_price: number;
    coverage: 'required' | 'extra' | 'unknown';
    mapped_budget_lines: string[];
  }>;
}

interface ComparisonRow {
  budget_line: BudgetLine;
  vendor_quotes: Record<string, {
    price: number;
    description: string;
    coverage: string;
    delta_amount: number;
    delta_percent: number;
    quote_line_id: string;
  } | null>;
  best_price: number;
  best_vendor: string | null;
  missing_vendors: string[];
}

interface QuoteComparisonViewProps {
  divisionId: string;
  compareData: any;
}

export default function QuoteComparisonView({ 
  divisionId, 
  compareData
}: QuoteComparisonViewProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonRow[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (compareData) {
      setVendorQuotes(compareData.vendor_quotes || []);
      
      // Extract budget lines from mapped quote lines (we need division data)
      // For now, create mock budget lines - in real app, this would come from stored project data
      const mockBudgetLines = extractBudgetLinesFromQuotes(compareData.vendor_quotes);
      setBudgetLines(mockBudgetLines);
      
      // Build comparison matrix
      const comparison = buildComparisonMatrix(mockBudgetLines, compareData.vendor_quotes);
      setComparisonData(comparison);
    }
  }, [compareData]);

  const extractBudgetLinesFromQuotes = (quotes: any[]): BudgetLine[] => {
    // For Shed Project electrical division, return the real budget line
    if (divisionId === '08-2271a70f-0709-4275-a663-3a57b253ccaa') {
      return [
        {
          lineId: "08-electrical-allowance-776",
          tradeDescription: "Electrical Allowance",
          quantity: undefined,
          unit: undefined,
          totalCost: 25000.00
        }
      ];
    }

    // For other divisions, extract from quotes (fallback)
    const budgetLinesMap = new Map<string, BudgetLine>();
    
    quotes.forEach(quote => {
      quote.line_items.forEach((item: any) => {
        item.mapped_budget_lines?.forEach((budgetLineId: string) => {
          if (!budgetLinesMap.has(budgetLineId)) {
            budgetLinesMap.set(budgetLineId, {
              lineId: budgetLineId,
              tradeDescription: item.description,
              totalCost: 0 // This should come from stored project budget data
            });
          }
        });
      });
    });
    
    return Array.from(budgetLinesMap.values());
  };

  const buildComparisonMatrix = (budget: BudgetLine[], quotes: VendorQuote[]): ComparisonRow[] => {
    return budget.map(budgetLine => {
      const vendorQuoteData: Record<string, any> = {};
      let bestPrice = Infinity;
      let bestVendor = null;
      const missingVendors: string[] = [];

      quotes.forEach(quote => {
        // Find mapped quote lines for this budget line
        const mappedLines = quote.line_items.filter(item => 
          item.mapped_budget_lines.includes(budgetLine.lineId)
        );

        if (mappedLines.length > 0) {
          // Sum up all mapped lines (in case of multiple mappings)
          const totalPrice = mappedLines.reduce((sum, line) => sum + line.total_price, 0);
          const descriptions = mappedLines.map(line => line.description).join(' + ');
          
          const deltaAmount = totalPrice - budgetLine.totalCost;
          const deltaPercent = budgetLine.totalCost > 0 ? (deltaAmount / budgetLine.totalCost) * 100 : 0;

          vendorQuoteData[quote.vendor_id] = {
            price: totalPrice,
            description: descriptions,
            coverage: mappedLines[0].coverage,
            delta_amount: deltaAmount,
            delta_percent: deltaPercent,
            quote_line_id: mappedLines[0].quote_line_id
          };

          if (totalPrice < bestPrice) {
            bestPrice = totalPrice;
            bestVendor = quote.vendor_id;
          }
        } else {
          missingVendors.push(quote.vendor_name);
          vendorQuoteData[quote.vendor_id] = null;
        }
      });

      return {
        budget_line: budgetLine,
        vendor_quotes: vendorQuoteData,
        best_price: bestPrice === Infinity ? 0 : bestPrice,
        best_vendor: bestVendor,
        missing_vendors: missingVendors
      };
    });
  };

  const getVendorName = (vendorId: string): string => {
    const quote = vendorQuotes.find(q => q.vendor_id === vendorId);
    return quote?.vendor_name || 'Unknown Vendor';
  };

  const getDeltaColor = (deltaPercent: number) => {
    if (deltaPercent < -10) return 'text-green-700 bg-green-100';
    if (deltaPercent < 0) return 'text-green-600 bg-green-50';
    if (deltaPercent < 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTotalsByVendor = () => {
    const totals: Record<string, number> = {};
    vendorQuotes.forEach(quote => {
      totals[quote.vendor_id] = 0;
    });

    comparisonData.forEach(row => {
      Object.entries(row.vendor_quotes).forEach(([vendorId, data]) => {
        if (data) {
          totals[vendorId] += data.price;
        }
      });
    });

    return totals;
  };

  const getRecommendations = () => {
    const totals = getTotalsByVendor();
    const lowestTotal = Math.min(...Object.values(totals));
    const lowestVendor = Object.entries(totals).find(([_, total]) => total === lowestTotal)?.[0];
    
    const recommendations = [];
    
    if (lowestVendor) {
      recommendations.push(`💰 Lowest total: ${getVendorName(lowestVendor)} at $${lowestTotal.toLocaleString()}`);
    }

    const missingScope = comparisonData.filter(row => row.missing_vendors.length > 0);
    if (missingScope.length > 0) {
      recommendations.push(`⚠️ ${missingScope.length} budget lines missing quotes from some vendors`);
    }

    const extraItems = vendorQuotes.reduce((sum, quote) => {
      return sum + quote.line_items.filter(item => item.coverage === 'extra').length;
    }, 0);
    
    if (extraItems > 0) {
      recommendations.push(`➕ ${extraItems} extra items not in budget across all quotes`);
    }

    return recommendations;
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading comparison data...</div>;
  }

  if (vendorQuotes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No quotes available for comparison</p>
      </div>
    );
  }

  const totals = getTotalsByVendor();
  const recommendations = getRecommendations();

  const divisionCode = divisionId.split('-')[0];
  const divisionName = vendorQuotes.length > 0 ? `Division ${divisionCode}` : `Division ${divisionCode}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <ProjectBreadcrumb 
        items={[
          { 
            label: 'Divisions', 
            href: `/projects/${projectId}/divisions` 
          },
          { 
            label: `${divisionCode} - Electrical` 
          },
          { 
            label: 'Quote Comparison', 
            active: true 
          }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Comparison</h1>
          <p className="text-gray-600">
            Division {divisionCode} - Electrical • {vendorQuotes.length} vendors • {comparisonData.length} budget lines
          </p>
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/decision`)}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Make Decision
        </button>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-20 min-w-64">
                  Budget Item
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 min-w-32">
                  Budget Cost
                </th>
                {vendorQuotes.slice(0, 6).map((quote, index) => (
                  <th key={quote.vendor_id} className={cn(
                    "px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-40",
                    index >= 4 && "bg-gray-100" // Highlight additional columns after 4 quotes
                  )}>
                    <div className="truncate" title={quote.vendor_name}>
                      {quote.vendor_name.length > 12 ? 
                        `${quote.vendor_name.substring(0, 12)}...` : 
                        quote.vendor_name
                      }
                    </div>
                    {index >= 4 && (
                      <div className="text-xs text-gray-500 mt-1">#{index + 1}</div>
                    )}
                  </th>
                ))}
                {vendorQuotes.length > 6 && (
                  <th className="px-4 py-3 text-center text-xs text-gray-500 bg-gray-100 min-w-20">
                    <div>+{vendorQuotes.length - 6}</div>
                    <div>more</div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comparisonData.map((row, rowIndex) => (
                <tr key={row.budget_line.lineId} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                    <div className="text-sm font-medium text-gray-900">
                      {row.budget_line.tradeDescription}
                    </div>
                    {(row.budget_line.quantity || row.budget_line.unit) && (
                      <div className="text-xs text-gray-500">
                        {row.budget_line.quantity ? `${row.budget_line.quantity} ` : ''}{row.budget_line.unit || ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    ${row.budget_line.totalCost.toLocaleString()}
                  </td>
                  {vendorQuotes.slice(0, 6).map((quote, index) => {
                    const vendorData = row.vendor_quotes[quote.vendor_id];
                    
                    if (!vendorData) {
                      return (
                        <td key={quote.vendor_id} className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            No Quote
                          </span>
                        </td>
                      );
                    }

                    const isBest = row.best_vendor === quote.vendor_id;
                    
                    return (
                      <td key={quote.vendor_id} className={cn(
                        "px-4 py-3 text-center",
                        index >= 4 && "bg-gray-50"
                      )}>
                        <div className={cn(
                          "text-sm font-semibold mb-1",
                          isBest ? "text-green-600" : "text-gray-900"
                        )}>
                          ${vendorData.price.toLocaleString()}
                          {isBest && <span className="ml-1">👑</span>}
                        </div>
                        <div className={cn(
                          "text-xs px-2 py-1 rounded",
                          getDeltaColor(vendorData.delta_percent)
                        )}>
                          {vendorData.delta_amount >= 0 ? '+' : ''}${vendorData.delta_amount.toLocaleString()} 
                          ({vendorData.delta_percent.toFixed(1)}%)
                        </div>
                        {vendorData.coverage === 'extra' && (
                          <div className="text-xs text-yellow-600 font-medium mt-1">
                            EXTRA
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {vendorQuotes.length > 6 && (
                    <td className="px-4 py-3 text-center text-xs text-gray-500 bg-gray-100">
                      <div>View all {vendorQuotes.length}</div>
                      <div>vendors →</div>
                    </td>
                  )}
                </tr>
              ))}
              
              {/* Totals Row */}
              <tr className="bg-gray-100 font-bold">
                <td className="px-4 py-3 sticky left-0 bg-gray-100 z-10 text-sm font-bold text-gray-900">
                  TOTAL
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  ${budgetLines.reduce((sum, line) => sum + line.totalCost, 0).toLocaleString()}
                </td>
                {vendorQuotes.slice(0, 6).map((quote, index) => {
                  const total = totals[quote.vendor_id] || 0;
                  const budgetTotal = budgetLines.reduce((sum, line) => sum + line.totalCost, 0);
                  const delta = total - budgetTotal;
                  const deltaPercent = budgetTotal > 0 ? (delta / budgetTotal) * 100 : 0;
                  
                  return (
                    <td key={quote.vendor_id} className={cn(
                      "px-4 py-3 text-center",
                      index >= 4 && "bg-gray-100"
                    )}>
                      <div className="text-sm font-bold text-gray-900">
                        ${total.toLocaleString()}
                      </div>
                      <div className={cn(
                        "text-xs px-2 py-1 rounded mt-1",
                        getDeltaColor(deltaPercent)
                      )}>
                        {delta >= 0 ? '+' : ''}${delta.toLocaleString()} ({deltaPercent.toFixed(1)}%)
                      </div>
                    </td>
                  );
                })}
                {vendorQuotes.length > 6 && (
                  <td className="px-4 py-3 text-center text-xs text-gray-500 bg-gray-100">
                    <button className="text-blue-600 hover:text-blue-800">
                      Show All
                    </button>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Analysis Panel */}
      <LiveAnalysisPanel
        divisionId={divisionId}
        quotes={vendorQuotes}
        budgetLines={budgetLines}
        analysisEngine={analysisEngine}
        onPreferencesChange={(prefs) => console.log('Preferences updated:', prefs)}
      />

      {/* Extra Items Summary */}
      {vendorQuotes.some(quote => quote.line_items.some(item => item.coverage === 'extra')) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Extra Items Not in Budget</h3>
          <div className="space-y-4">
            {vendorQuotes.map(quote => {
              const extraItems = quote.line_items.filter(item => item.coverage === 'extra');
              if (extraItems.length === 0) return null;
              
              return (
                <div key={quote.vendor_id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                  <h4 className="font-medium text-yellow-900 mb-2">
                    {quote.vendor_name} ({extraItems.length} extras)
                  </h4>
                  <div className="space-y-1">
                    {extraItems.map(item => (
                      <div key={item.quote_line_id} className="flex justify-between text-sm">
                        <span className="text-yellow-800">{item.description}</span>
                        <span className="font-semibold text-yellow-900">
                          ${item.total_price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}