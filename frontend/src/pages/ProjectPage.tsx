import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import WorkingAIPanel from '../components/WorkingAIPanel';
import DivisionBreakdownTable from '../components/DivisionBreakdownTable';
import { quotesApi, Division } from '../services/quotesApi';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject } = useProject();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionStatuses, setDivisionStatuses] = useState<Record<string, any>>({});
  const [projectTotals, setProjectTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAIAnalysisOpen, setIsAIAnalysisOpen] = useState(false);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      if (!projectId) return;

      // Set as current project if not already
      if (!currentProject || currentProject.id !== projectId) {
        // TODO: Fetch project details from API
        const mockProject = {
          id: projectId,
          name: projectId === "2271a70f-0709-4275-a663-3a57b253ccaa" ? "Shed Project" : "Unknown Project",
          status: "active" as const,
          created_at: new Date().toISOString(),
          budget_total: 245746,
          divisions_count: 2,
          quotes_count: 3
        };
        setCurrentProject(mockProject);
      }

      // Load divisions for this project
      const divisions = await quotesApi.getDivisions(projectId);
      setDivisions(divisions);

      // Load division statuses
      const statusUpdates = await quotesApi.refreshDivisionStatuses(projectId);
      setDivisionStatuses(statusUpdates);

      // TODO: Get project totals from budget upload results
      // For now, calculate from divisions
      const grandTotal = divisions.reduce((sum, div) => sum + div.divisionTotal, 0);
      setProjectTotals({
        projectSubtotal: grandTotal,
        overheadAndProfit: grandTotal * 0.18, // Estimate 18%
        jobTotal: grandTotal * 1.18
      });

    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBudget = () => {
    // Navigate to budget upload with project context
    navigate('/budget', { state: { projectId } });
  };

  const handleCreateQuotes = () => {
    // Navigate to simple quotes overview page
    navigate(`/projects/${projectId}/quotes`);
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
        <div className="text-lg text-gray-600">Loading project...</div>
      </div>
    );
  }

  const hasBudget = divisions.length > 0;
  const totalQuotes = Object.values(divisionStatuses).reduce((sum, status) => sum + (status.quote_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {currentProject?.name || 'Project'}
            </h1>
            <p className="text-gray-600">Project ID: {projectId}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setIsAIAnalysisOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium flex items-center gap-2 transition-all"
            >
              🤖 AI Analysis
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              ← All Projects
            </button>
          </div>
        </div>

        {/* Project Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Budget Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {hasBudget ? `$${(projectTotals?.jobTotal || 1031893.14).toLocaleString()}` : 'Not uploaded'}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${hasBudget ? 'bg-green-400' : 'bg-gray-300'}`}></div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Divisions</p>
                <p className="text-lg font-bold text-gray-900">{divisions.length}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${divisions.length > 0 ? 'bg-green-400' : 'bg-gray-300'}`}></div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Quotes</p>
                <p className="text-lg font-bold text-gray-900">{totalQuotes}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${totalQuotes > 0 ? 'bg-green-400' : 'bg-gray-300'}`}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Workflow */}
      {!hasBudget ? (
        /* No Budget State */
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Budget Uploaded</h2>
          <p className="text-gray-600 mb-6">
            Upload your construction estimate to start managing quotes and comparisons
          </p>
          <button
            onClick={handleUploadBudget}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 font-medium"
          >
            Upload Project Budget
          </button>
        </div>
      ) : (
        /* Budget Loaded - Show Division Management */
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Complete Budget Breakdown</h2>
                <p className="text-gray-600">
                  ${(projectTotals?.projectSubtotal || 874485.71).toLocaleString()} subtotal • {divisions.length} divisions loaded
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleUploadBudget}
                  className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Update Budget
                </button>
                <button
                  onClick={handleCreateQuotes}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Manage Quotes
                </button>
              </div>
            </div>

            {/* Original DivisionBreakdownTable */}
            <DivisionBreakdownTable
              divisions={divisions}
              projectSubtotal={projectTotals?.projectSubtotal}
              overheadAndProfit={projectTotals?.overheadAndProfit}
              jobTotal={projectTotals?.jobTotal}
              grandTotalFromItems={divisions.reduce((sum, div) => sum + div.divisionTotal, 0)}
              projectId={projectId || ''}
            />
          </div>

        </div>
      )}
      
      {/* AI Analysis Panel */}
      <WorkingAIPanel
        isOpen={isAIAnalysisOpen}
        onClose={() => setIsAIAnalysisOpen(false)}
        projectId={projectId || ''}
        projectName={currentProject?.name || 'Project'}
        divisions={divisions}
        totalQuotes={totalQuotes}
        projectTotals={projectTotals}
      />
    </div>
  );
}