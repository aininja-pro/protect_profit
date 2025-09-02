import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import { quotesApi, type Mapping, Division } from '../services/quotesApi';
import ProjectBreadcrumb from './ProjectBreadcrumb';

interface BudgetLine {
  lineId?: string;
  tradeDescription?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  totalCost?: number;
  total_cost?: number;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity?: number;
  unit?: string;
  normalized_unit?: string;
  unit_price: number;
  total_price: number;
  notes?: string;
  coverage: 'required' | 'extra' | 'unknown';
}

interface QuoteWithLines {
  quote_id: string;
  vendor_name: string;
  status: string;
  line_items: QuoteLine[];
}

// Mapping interface now imported from quotesApi

interface QuoteMappingViewProps {
  division: Division;
  divisionId: string;
  budgetLines: BudgetLine[];
  parsedQuoteLines: any[];
  onConfirm: (mappings: Mapping[]) => void;
}

export default function QuoteMappingView({ 
  division,
  divisionId, 
  budgetLines,
  parsedQuoteLines,
  onConfirm
}: QuoteMappingViewProps) {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [quotes, setQuotes] = useState<QuoteWithLines[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedBudgetLine, setSelectedBudgetLine] = useState<string | null>(null);
  const [draggedQuoteLine, setDraggedQuoteLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Data is loaded by parent

  useEffect(() => {
    // Convert parsed quote lines into the format expected by the component
    const quotesMap = new Map<string, any>();
    
    parsedQuoteLines.forEach(line => {
      if (!quotesMap.has(line.quote_id)) {
        quotesMap.set(line.quote_id, {
          quote_id: line.quote_id,
          vendor_name: line.vendor_name,
          status: 'parsed',
          line_items: []
        });
      }
      quotesMap.get(line.quote_id)!.line_items.push(line);
    });

    setQuotes(Array.from(quotesMap.values()));
  }, [parsedQuoteLines]);

  const createMapping = (budgetLineId: string, quoteLineId: string) => {
    // Remove any existing mapping for this quote line
    setMappings(prev => prev.filter(m => m.quote_line_item_id !== quoteLineId));
    
    // Add new mapping
    const newMapping: Mapping = {
      budget_line_id: budgetLineId,
      quote_line_item_id: quoteLineId,
      confidence: 0.8,
      user_confirmed: true
    };
    
    setMappings(prev => [...prev, newMapping]);
  };

  const removeMapping = (quoteLineId: string) => {
    setMappings(prev => prev.filter(m => m.quote_line_item_id !== quoteLineId));
  };

  const saveMappings = async () => {
    try {
      // Group mappings by quote
      const mappingsByQuote = quotes.reduce((acc, quote) => {
        acc[quote.quote_id] = mappings.filter(m => 
          quote.line_items.some(item => item.id === m.quote_line_item_id)
        );
        return acc;
      }, {} as Record<string, Mapping[]>);

      // Save mappings for each quote
      for (const [quoteId, quoteMappings] of Object.entries(mappingsByQuote)) {
        if (quoteMappings.length > 0) {
          await quotesApi.saveMappings(quoteId, quoteMappings);
        }
      }

      // Call parent callback with mappings
      onConfirm(mappings);

      // Status update: After mapping is completed, quotes are still "quotes_uploaded" 
      // but now they're ready for comparison. The backend handles status transitions.

      // Navigate to comparison view after successful mapping
      navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/compare`);
    } catch (error) {
      console.error('Failed to save mappings:', error);
    }
  };

  const getMappedBudgetLine = (quoteLineId: string): string | null => {
    const mapping = mappings.find(m => m.quote_line_item_id === quoteLineId);
    return mapping?.budget_line_id || null;
  };

  const getMappedQuoteLines = (budgetLineId: string): string[] => {
    return mappings
      .filter(m => m.budget_line_id === budgetLineId)
      .map(m => m.quote_line_item_id);
  };

  const handleDragStart = (e: React.DragEvent, quoteLineId: string) => {
    setDraggedQuoteLine(quoteLineId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, budgetLineId: string) => {
    e.preventDefault();
    if (draggedQuoteLine) {
      createMapping(budgetLineId, draggedQuoteLine);
      setDraggedQuoteLine(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading division data...</div>;
  }

  const totalMappings = mappings.length;
  const totalQuoteLines = quotes.reduce((sum, quote) => sum + quote.line_items.length, 0);
  const mappingProgress = totalQuoteLines > 0 ? (totalMappings / totalQuoteLines * 100) : 0;

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
            label: `${division.divisionCode} - ${division.divisionName}` 
          },
          { 
            label: 'Map Quote Lines', 
            active: true 
          }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Map Quote Lines</h1>
          <p className="text-gray-600">
            Division {division.divisionCode} - {division.divisionName}
          </p>
          <p className="text-sm text-gray-500">
            Drag quote lines to budget items • {totalMappings} of {totalQuoteLines} mapped ({mappingProgress.toFixed(0)}%)
          </p>
        </div>
        <button
          onClick={saveMappings}
          disabled={totalMappings === 0}
          className={cn(
            "px-4 py-2 rounded font-medium",
            totalMappings > 0
              ? "bg-primary text-white hover:bg-primary/90"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          )}
        >
          Save Mappings & Continue
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Lines (Left) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-green-900">Budget Lines</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {budgetLines.map((line) => {
              const mappedQuoteLines = getMappedQuoteLines(line.lineId || '');
              
              return (
                <div
                  key={line.lineId}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, line.lineId || '')}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedBudgetLine === line.lineId
                      ? "border-primary bg-primary/5"
                      : mappedQuoteLines.length > 0
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedBudgetLine(
                    selectedBudgetLine === line.lineId ? null : (line.lineId || null)
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {line.tradeDescription || line.description}
                      </p>
                      {(line.quantity || line.unit) && (
                        <p className="text-xs text-gray-500">
                          {line.quantity ? `${line.quantity} ` : ''}{line.unit || ''}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-green-600 text-sm">
                      ${(line.totalCost || line.total_cost || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  {mappedQuoteLines.length > 0 && (
                    <div className="mt-2 text-xs text-green-700">
                      ✓ {mappedQuoteLines.length} quote line{mappedQuoteLines.length !== 1 ? 's' : ''} mapped
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quote Lines (Right) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-900">Quote Lines</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {quotes.map((quote) => (
              <div key={quote.quote_id} className="space-y-2">
                <h3 className="font-medium text-gray-800 text-sm border-b pb-1">
                  {quote.vendor_name} ({quote.line_items.length} items)
                </h3>
                
                {quote.line_items.map((line) => {
                  const mappedBudgetLine = getMappedBudgetLine(line.id);
                  
                  return (
                    <div
                      key={line.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, line.id)}
                      className={cn(
                        "p-3 border rounded-lg cursor-move transition-colors",
                        mappedBudgetLine
                          ? "border-green-300 bg-green-50"
                          : line.coverage === 'extra'
                          ? "border-yellow-300 bg-yellow-50"
                          : "border-gray-200 hover:border-blue-300"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {line.description}
                          </p>
                          {(line.quantity || line.unit) && (
                            <p className="text-xs text-gray-500">
                              {line.quantity ? `${line.quantity} ` : ''}{line.normalized_unit || line.unit || ''}
                            </p>
                          )}
                          {line.notes && (
                            <p className="text-xs text-gray-600 italic">{line.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-blue-600 text-sm">
                            ${line.total_price.toLocaleString()}
                          </span>
                          {line.coverage === 'extra' && (
                            <div className="text-xs text-yellow-700 font-medium">EXTRA</div>
                          )}
                        </div>
                      </div>
                      
                      {mappedBudgetLine && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-green-700">
                            ✓ Mapped to budget line
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMapping(line.id);
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Unmap
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-lg font-bold text-green-600">{totalMappings}</p>
          <p className="text-sm text-green-700">Lines Mapped</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="text-lg font-bold text-yellow-600">
            {quotes.reduce((sum, q) => sum + q.line_items.filter(l => l.coverage === 'extra').length, 0)}
          </p>
          <p className="text-sm text-yellow-700">Extra Items</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-lg font-bold text-blue-600">{quotes.length}</p>
          <p className="text-sm text-blue-700">Vendor Quotes</p>
        </div>
      </div>
    </div>
  );
}