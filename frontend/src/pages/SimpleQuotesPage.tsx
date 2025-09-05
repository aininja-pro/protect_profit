import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import SimpleQuotesOverview from '../components/SimpleQuotesOverview';
import { quotesApi, Division } from '../services/quotesApi';

export default function SimpleQuotesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjectDivisions();
  }, [projectId]);

  const loadProjectDivisions = async () => {
    try {
      if (!projectId) return;
      
      const divisions = await quotesApi.getDivisions(projectId);
      setDivisions(divisions);
    } catch (error) {
      console.error('Failed to load divisions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">Project ID is required</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="text-lg text-gray-600">Loading quotes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentProject?.name || 'Project'} - Quote Management
              </h1>
              <p className="text-gray-600">Simple, effective quote overview</p>
            </div>
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              ← Back to Project
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <SimpleQuotesOverview 
        divisions={divisions}
        projectId={projectId}
      />
    </div>
  );
}