import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { quotesApi, type DecisionPayload, type LineAward } from '../services/quotesApi';
import ProjectBreadcrumb from './ProjectBreadcrumb';

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

// LineDecision type matches LineAward from quotesApi
type LineDecision = LineAward;

interface DecisionViewProps {
  divisionId: string;
  compareData: any;
  onDecide: (awards: any) => void;
}

export default function DecisionView({ 
  divisionId, 
  compareData,
  onDecide
}: DecisionViewProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [vendorQuotes, setVendorQuotes] = useState<VendorQuote[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [lineDecisions, setLineDecisions] = useState<Record<string, LineDecision>>({});
  const [primaryVendor, setPrimaryVendor] = useState<string>('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (compareData) {
      loadComparisonData();
    }
  }, [compareData]);

  const loadComparisonData = () => {
    try {
      setLoading(true);
      
      const quotes = compareData.vendor_quotes || [];
      setVendorQuotes(quotes);

      // Extract budget lines from quotes data
      const extractedBudgetLines = extractBudgetLinesFromQuotes(quotes);
      setBudgetLines(extractedBudgetLines);
      
      // Pre-populate with best price selections
      const initialDecisions: Record<string, LineDecision> = {};
      extractedBudgetLines.forEach(budgetLine => {
        const mappedQuotes = quotes.map((quote: any) => {
          const mappedLines = quote.line_items.filter((item: any) => 
            item.mapped_budget_lines.includes(budgetLine.lineId)
          );
          if (mappedLines.length > 0) {
            const totalPrice = mappedLines.reduce((sum: number, line: any) => sum + line.total_price, 0);
            return {
              vendor_id: quote.vendor_id,
              quote_id: quote.quote_id,
              quote_line_item_id: mappedLines[0].quote_line_id,
              price: totalPrice
            };
          }
          return null;
        }).filter(Boolean);

        if (mappedQuotes.length > 0) {
          const bestQuote = mappedQuotes.reduce((best: any, current: any) => 
            current!.price < best!.price ? current : best
          );
          
          initialDecisions[budgetLine.lineId] = {
            budget_line_id: budgetLine.lineId,
            vendor_id: bestQuote!.vendor_id,
            quote_id: bestQuote!.quote_id,
            quote_line_item_id: bestQuote!.quote_line_item_id,
            final_price: bestQuote!.price
          };
        }
      });
      
      setLineDecisions(initialDecisions);
      
      // Set primary vendor to most selected vendor
      const vendorCounts = Object.values(initialDecisions).reduce((acc, decision) => {
        acc[decision.vendor_id] = (acc[decision.vendor_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostUsedVendor = Object.entries(vendorCounts).reduce((max, [vendorId, count]) => 
        count > max.count ? { vendorId, count } : max, 
        { vendorId: '', count: 0 }
      );
      
      setPrimaryVendor(mostUsedVendor.vendorId);
      
    } catch (error) {
      console.error('Failed to load comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractBudgetLinesFromQuotes = (quotes: any[]): BudgetLine[] => {
    const budgetLinesMap = new Map<string, BudgetLine>();
    
    quotes.forEach(quote => {
      quote.line_items.forEach((item: any) => {
        item.mapped_budget_lines?.forEach((budgetLineId: string) => {
          if (!budgetLinesMap.has(budgetLineId)) {
            budgetLinesMap.set(budgetLineId, {
              lineId: budgetLineId,
              tradeDescription: item.description,
              totalCost: 0 // This should come from stored project data
            });
          }
        });
      });
    });
    
    return Array.from(budgetLinesMap.values());
  };

  const getVendorName = (vendorId: string): string => {
    const quote = vendorQuotes.find(q => q.vendor_id === vendorId);
    return quote?.vendor_name || 'Unknown Vendor';
  };

  const getVendorOptions = (budgetLineId: string) => {
    const options: Array<{
      vendor_id: string;
      vendor_name: string;
      quote_id: string;
      price: number;
      quote_line_item_id?: string;
    }> = [];

    vendorQuotes.forEach(quote => {
      const mappedLines = quote.line_items.filter(item => 
        item.mapped_budget_lines.includes(budgetLineId)
      );
      
      if (mappedLines.length > 0) {
        const totalPrice = mappedLines.reduce((sum, line) => sum + line.total_price, 0);
        options.push({
          vendor_id: quote.vendor_id,
          vendor_name: quote.vendor_name,
          quote_id: quote.quote_id,
          price: totalPrice,
          quote_line_item_id: mappedLines[0].quote_line_id
        });
      }
    });

    return options.sort((a, b) => a.price - b.price);
  };

  const updateLineDecision = (budgetLineId: string, vendorId: string) => {
    const options = getVendorOptions(budgetLineId);
    const selectedOption = options.find(opt => opt.vendor_id === vendorId);
    
    if (selectedOption) {
      setLineDecisions(prev => ({
        ...prev,
        [budgetLineId]: {
          budget_line_id: budgetLineId,
          vendor_id: selectedOption.vendor_id,
          quote_id: selectedOption.quote_id,
          quote_line_item_id: selectedOption.quote_line_item_id,
          final_price: selectedOption.price
        }
      }));
    }
  };

  const selectAllFromVendor = (vendorId: string) => {
    const newDecisions = { ...lineDecisions };
    
    budgetLines.forEach(budgetLine => {
      const options = getVendorOptions(budgetLine.lineId);
      const vendorOption = options.find(opt => opt.vendor_id === vendorId);
      
      if (vendorOption) {
        newDecisions[budgetLine.lineId] = {
          budget_line_id: budgetLine.lineId,
          vendor_id: vendorOption.vendor_id,
          quote_id: vendorOption.quote_id,
          quote_line_item_id: vendorOption.quote_line_item_id,
          final_price: vendorOption.price
        };
      }
    });
    
    setLineDecisions(newDecisions);
    setPrimaryVendor(vendorId);
  };

  const getTotalAward = (): number => {
    return Object.values(lineDecisions).reduce((sum, decision) => sum + decision.final_price, 0);
  };

  const getVendorTotals = (): Record<string, { count: number; total: number }> => {
    const totals: Record<string, { count: number; total: number }> = {};
    
    Object.values(lineDecisions).forEach(decision => {
      if (!totals[decision.vendor_id]) {
        totals[decision.vendor_id] = { count: 0, total: 0 };
      }
      totals[decision.vendor_id].count += 1;
      totals[decision.vendor_id].total += decision.final_price;
    });
    
    return totals;
  };

  const saveDecision = async () => {
    try {
      setSaving(true);
      
      const decisionData: DecisionPayload = {
        primary_vendor_id: primaryVendor,
        notes: decisionNotes,
        line_awards: Object.values(lineDecisions)
      };

      await quotesApi.decideDivision(divisionId, decisionData);

      // Call parent callback
      onDecide(decisionData);

      // Status update: After decision is made, the division status should be "winner_selected"
      // The backend decision endpoint updates the division_status table accordingly

      // Navigate back to divisions with success message
      navigate(`/projects/${projectId}/divisions`, { 
        state: { message: `Decision saved for division ${divisionId}`, refreshStatus: true }
      });
      
    } catch (error) {
      console.error('Failed to save decision:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateWorkOrder = async () => {
    try {
      setGeneratingPdf(true);
      
      const response = await quotesApi.generateWorkOrder(divisionId);

      // In a real implementation, this would download the PDF
      console.log('Work order generated:', response.pdf_filename);
      alert(`Work order PDF generated: ${response.pdf_filename}`);
      
      // Navigate back to divisions after work order generation
      navigate(`/projects/${projectId}/divisions`, { 
        state: { message: `Work order generated: ${response.pdf_filename}`, refreshStatus: true }
      });
      
    } catch (error) {
      console.error('Failed to generate work order:', error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading decision data...</div>;
  }

  const vendorTotals = getVendorTotals();
  const totalAward = getTotalAward();
  const budgetTotal = budgetLines.reduce((sum, line) => sum + line.totalCost, 0);
  const totalDelta = totalAward - budgetTotal;
  const totalDeltaPercent = budgetTotal > 0 ? (totalDelta / budgetTotal) * 100 : 0;

  const divisionCode = divisionId.split('-')[0];

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
            label: 'Comparison', 
            href: `/projects/${projectId}/divisions/${divisionId}/quotes/compare` 
          },
          { 
            label: 'Make Decision', 
            active: true 
          }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Make Decision</h1>
          <p className="text-gray-600">
            Division {divisionCode} - Electrical • Select winning vendors for each budget line
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateWorkOrder}
            disabled={Object.keys(lineDecisions).length === 0 || generatingPdf}
            className={cn(
              "px-4 py-2 rounded font-medium",
              Object.keys(lineDecisions).length > 0 && !generatingPdf
                ? "border border-primary text-primary hover:bg-primary/5"
                : "border border-gray-300 text-gray-500 cursor-not-allowed"
            )}
          >
            {generatingPdf ? 'Generating PDF...' : 'Generate Work Order'}
          </button>
          <button
            onClick={saveDecision}
            disabled={Object.keys(lineDecisions).length === 0 || saving}
            className={cn(
              "px-4 py-2 rounded font-medium",
              Object.keys(lineDecisions).length > 0 && !saving
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            )}
          >
            {saving ? 'Saving...' : 'Save Decision'}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {vendorQuotes.map(quote => (
            <button
              key={quote.vendor_id}
              onClick={() => selectAllFromVendor(quote.vendor_id)}
              className={cn(
                "px-3 py-2 rounded border text-sm",
                primaryVendor === quote.vendor_id
                  ? "border-primary bg-primary text-white"
                  : "border-gray-300 text-gray-700 hover:border-gray-400"
              )}
            >
              Select All from {quote.vendor_name}
            </button>
          ))}
        </div>
      </div>

      {/* Line-by-Line Decisions */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Line-by-Line Decisions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  Budget Item
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Budget Cost
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                  Award To
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Award Price
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  Delta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgetLines.map((line, index) => {
                const options = getVendorOptions(line.lineId);
                const decision = lineDecisions[line.lineId];
                const delta = decision ? decision.final_price - line.totalCost : 0;
                const deltaPercent = line.totalCost > 0 ? (delta / line.totalCost) * 100 : 0;

                return (
                  <tr key={line.lineId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {line.tradeDescription}
                      </div>
                      {(line.quantity || line.unit) && (
                        <div className="text-xs text-gray-500">
                          {line.quantity ? `${line.quantity} ` : ''}{line.unit || ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      ${line.totalCost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={decision?.vendor_id || ''}
                        onChange={(e) => updateLineDecision(line.lineId, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                      >
                        <option value="">Select Vendor</option>
                        {options.map(option => (
                          <option key={option.vendor_id} value={option.vendor_id}>
                            {option.vendor_name} - ${option.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {decision ? `$${decision.final_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {decision && (
                        <div className={cn(
                          "text-xs px-2 py-1 rounded",
                          deltaPercent < -5 ? "text-green-700 bg-green-100" :
                          deltaPercent < 0 ? "text-green-600 bg-green-50" :
                          deltaPercent < 10 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"
                        )}>
                          {delta >= 0 ? '+' : ''}${delta.toLocaleString()}
                          <br />({deltaPercent.toFixed(1)}%)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Award Summary</h3>
          <div className="space-y-3">
            {Object.entries(vendorTotals).map(([vendorId, { count, total }]) => (
              <div key={vendorId} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{getVendorName(vendorId)}</span>
                  <span className="text-sm text-gray-500 ml-2">({count} lines)</span>
                </div>
                <span className="font-semibold">${total.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between items-center font-bold">
              <span>Total Award</span>
              <span>${totalAward.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>vs Budget ({budgetTotal.toLocaleString()})</span>
              <span className={cn(
                "font-semibold",
                totalDeltaPercent < 0 ? "text-green-600" : "text-red-600"
              )}>
                {totalDelta >= 0 ? '+' : ''}${totalDelta.toLocaleString()} ({totalDeltaPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Decision Notes</h3>
          <textarea
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            placeholder="Add notes about this decision (vendor selection rationale, negotiation notes, etc.)"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>
    </div>
  );
}