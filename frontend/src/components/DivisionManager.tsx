import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

interface Division {
  divisionCode: string;
  divisionName: string;
  items: any[];  // Allow flexible item format
  divisionTotal: number;
}

interface DivisionStatus {
  status: 'no_quotes' | 'quotes_uploaded' | 'winner_selected';
  selected_vendor_id?: string;
  quote_count?: number;
}

interface DivisionManagerProps {
  divisions: any[];  // Allow flexible division format
  divisionStatuses: Record<string, DivisionStatus>;
  projectId: string;
}

export default function DivisionManager({ 
  divisions, 
  divisionStatuses,
  projectId
}: DivisionManagerProps) {
  const navigate = useNavigate();

  const handleQuoteUpload = (divisionCode: string) => {
    const divisionId = `${divisionCode}-${projectId}`;
    navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/upload`);
  };

  const handleCompareQuotes = (divisionCode: string) => {
    const divisionId = `${divisionCode}-${projectId}`;
    navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/compare`);
  };

  const handleMakeDecision = (divisionCode: string) => {
    const divisionId = `${divisionCode}-${projectId}`;
    navigate(`/projects/${projectId}/divisions/${divisionId}/quotes/decision`);
  };

  const getStatusChip = (status: DivisionStatus['status'], quoteCount = 0) => {
    switch (status) {
      case 'no_quotes':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
            No Quotes
          </span>
        );
      case 'quotes_uploaded':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {quoteCount} Quote{quoteCount !== 1 ? 's' : ''} Uploaded
          </span>
        );
      case 'winner_selected':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
            Winner Selected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
            No Quotes
          </span>
        );
    }
  };

  const getActionButton = (divisionCode: string, status: DivisionStatus['status']) => {
    switch (status) {
      case 'no_quotes':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleQuoteUpload(divisionCode)}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
            >
              Upload Quotes
            </button>
            <button
              onClick={() => handleCompareQuotes(divisionCode)}
              className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Analyze
            </button>
          </div>
        );
      case 'quotes_uploaded':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleQuoteUpload(divisionCode)}
              className="px-3 py-1 text-sm border border-primary text-primary rounded hover:bg-primary/5"
            >
              Add Quote
            </button>
            <button
              onClick={() => handleCompareQuotes(divisionCode)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Compare
            </button>
          </div>
        );
      case 'winner_selected':
        return (
          <div className="flex space-x-2">
            <button
              onClick={() => handleCompareQuotes(divisionCode)}
              className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              View
            </button>
            <button
              onClick={() => handleMakeDecision(divisionCode)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Work Order
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={() => handleQuoteUpload(divisionCode)}
            className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
          >
            Upload Quotes
          </button>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Division Management</h2>
        <div className="text-sm text-gray-500">
          {divisions.length} divisions • ${divisions.reduce((sum, div) => sum + div.divisionTotal, 0).toLocaleString()}
        </div>
      </div>

      <div className="space-y-3">
        {divisions.map((division) => {
          const status = divisionStatuses[division.divisionCode]?.status || 'no_quotes';
          const quoteCount = divisionStatuses[division.divisionCode]?.quote_count || 0;
          
          return (
            <div key={division.divisionCode} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {division.divisionCode}
                    </span>
                    <h3 className="font-semibold text-gray-900">{division.divisionName}</h3>
                    {getStatusChip(status, quoteCount)}
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                    <span>{division.items.length} line items</span>
                    <span className="font-semibold text-green-600">
                      ${division.divisionTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {getActionButton(division.divisionCode, status)}
                </div>
              </div>
              
              {/* Expandable line items preview */}
              <details className="mt-3 group">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 group-open:text-gray-700">
                  View {division.items.length} line items
                </summary>
                <div className="mt-2 space-y-1 pl-4 border-l-2 border-gray-100">
                  {division.items.slice(0, 5).map((item: any) => (
                    <div key={item.lineId || item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.tradeDescription || item.description}</span>
                      <span className="font-medium text-gray-900">
                        ${(item.totalCost || item.total_cost)?.toLocaleString() || '0'}
                      </span>
                    </div>
                  ))}
                  {division.items.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                      ... and {division.items.length - 5} more items
                    </div>
                  )}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}