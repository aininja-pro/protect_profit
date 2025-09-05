import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuoteMappingView from '../components/QuoteMappingView';
import { quotesApi, Division, Mapping } from '../services/quotesApi';

interface BudgetLine {
  lineId: string;
  tradeDescription: string;
  quantity?: number;
  unit?: string;
  totalCost: number;
}

export default function QuoteMappingPage() {
  const { projectId, divisionId } = useParams<{ projectId: string; divisionId: string }>();
  const navigate = useNavigate();
  const [division, setDivision] = useState<Division | null>(null);
  const [parsedQuoteLines, setParsedQuoteLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMappingData();
  }, [projectId, divisionId]);

  const loadMappingData = async () => {
    try {
      if (!projectId || !divisionId) return;

      // Load division data for budget lines
      const divisions = await quotesApi.getDivisions(projectId);
      const divisionCode = divisionId.split('-')[0];
      const foundDivision = divisions.find(d => d.divisionCode === divisionCode);
      setDivision(foundDivision || null);

      // Load parsed quote lines for this division
      const compareData = await quotesApi.getCompare(divisionId);
      const allQuoteLines = compareData.vendor_quotes.flatMap(quote => 
        quote.line_items.map(item => ({
          ...item,
          vendor_name: quote.vendor_name,
          quote_id: quote.quote_id
        }))
      );
      setParsedQuoteLines(allQuoteLines);

    } catch (error) {
      console.error('Failed to load mapping data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (mappings: Mapping[]) => {
    try {
      console.log('Confirming mappings:', mappings);
      // Mappings are saved within the component, just handle the confirmation
    } catch (error) {
      console.error('Failed to confirm mappings:', error);
    }
  };

  // Navigation handled directly by QuoteMappingView component

  if (!projectId || !divisionId) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">Project ID and Division ID are required</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-lg text-gray-600">Loading mapping data...</div>
      </div>
    );
  }

  if (!division) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">Division not found</div>
      </div>
    );
  }

  return (
    <QuoteMappingView
      division={division}
      divisionId={divisionId}
      budgetLines={division.items}
      parsedQuoteLines={parsedQuoteLines}
      onConfirm={handleConfirm}
    />
  );
}