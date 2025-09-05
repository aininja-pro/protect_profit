import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DivisionQuoteUpload from '../components/DivisionQuoteUpload';
import { quotesApi, Division } from '../services/quotesApi';

export default function DivisionQuoteUploadPage() {
  const { projectId, divisionId } = useParams<{ projectId: string; divisionId: string }>();
  const navigate = useNavigate();
  const [division, setDivision] = useState<Division | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDivisionData();
  }, [projectId, divisionId]);

  const loadDivisionData = async () => {
    try {
      if (!projectId || !divisionId) return;

      const divisions = await quotesApi.getDivisions(projectId);
      const divisionCode = divisionId.split('-')[0];
      const foundDivision = divisions.find(d => d.divisionCode === divisionCode);
      
      setDivision(foundDivision || null);
    } catch (error) {
      console.error('Failed to load division data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploaded = async (quoteIds: string[]) => {
    console.log('Quotes uploaded:', quoteIds);
    
    // Trigger status refresh after upload - this will update the division status chip
    // The actual status update is handled by backend on quote creation
    // We just need to make sure parent components refresh their status
    if (window.opener) {
      // If opened in new window, tell parent to refresh
      window.opener.postMessage({ type: 'QUOTE_UPLOADED', divisionId }, '*');
    }
  };

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
        <div className="text-lg text-gray-600">Loading division data...</div>
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
    <DivisionQuoteUpload
      division={division}
      divisionId={divisionId}
      projectId={projectId}
      onUploaded={handleUploaded}
    />
  );
}

// Helper function to get division name from code
function getDivisionName(divisionCode: string): string {
  const divisionMap: Record<string, string> = {
    '08': 'Electrical',
    '15': 'Plumbing',
    '03': 'Concrete',
    '06': 'Wood & Plastics',
    '09': 'Finishes',
    '16': 'Electrical (Legacy)'
  };
  return divisionMap[divisionCode] || `Division ${divisionCode}`;
}