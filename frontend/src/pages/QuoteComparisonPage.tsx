import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuoteComparisonView from '../components/QuoteComparisonView';
import { quotesApi } from '../services/quotesApi';

interface BudgetLine {
  lineId: string;
  tradeDescription: string;
  quantity?: number;
  unit?: string;
  totalCost: number;
}

export default function QuoteComparisonPage() {
  const { projectId, divisionId } = useParams<{ projectId: string; divisionId: string }>();
  const navigate = useNavigate();
  const [compareData, setCompareData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompareData();
  }, [divisionId]);

  const loadCompareData = async () => {
    try {
      if (!divisionId) return;
      
      const data = await quotesApi.getCompare(divisionId);
      setCompareData(data);
    } catch (error) {
      console.error('Failed to load compare data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handled directly by QuoteComparisonView component

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
        <div className="text-lg text-gray-600">Loading comparison data...</div>
      </div>
    );
  }

  if (!compareData) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">No comparison data available</div>
      </div>
    );
  }

  return (
    <QuoteComparisonView
      divisionId={divisionId}
      compareData={compareData}
    />
  );
}