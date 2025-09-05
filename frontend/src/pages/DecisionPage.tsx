import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DecisionView from '../components/DecisionView';
import { quotesApi } from '../services/quotesApi';

interface BudgetLine {
  lineId: string;
  tradeDescription: string;
  quantity?: number;
  unit?: string;
  totalCost: number;
}

export default function DecisionPage() {
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

  const handleDecide = async (awards: any) => {
    try {
      console.log('Making decision:', awards);
      // Decisions are handled within the component
    } catch (error) {
      console.error('Failed to make decision:', error);
    }
  };

  // Navigation handled directly by DecisionView component

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
        <div className="text-lg text-gray-600">Loading decision data...</div>
      </div>
    );
  }

  if (!compareData) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">No comparison data available for decisions</div>
      </div>
    );
  }

  return (
    <DecisionView
      divisionId={divisionId}
      compareData={compareData}
      onDecide={handleDecide}
    />
  );
}