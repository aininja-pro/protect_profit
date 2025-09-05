import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DivisionManager from '../components/DivisionManager';
import ProjectBreadcrumb from '../components/ProjectBreadcrumb';
import { quotesApi, Division } from '../services/quotesApi';

export default function DivisionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [divisionStatuses, setDivisionStatuses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Show success message if coming from navigation state
  useEffect(() => {
    if (location.state?.message) {
      console.log('Success:', location.state.message);
      // In a real app, show a toast notification here
      
      // Refresh status if requested
      if (location.state?.refreshStatus && projectId) {
        refreshDivisionStatuses();
      }
    }
  }, [location.state]);

  useEffect(() => {
    loadProjectDivisions();
  }, [projectId]);

  // Refresh when coming back to this page (re-focus)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshDivisionStatuses();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [projectId]);

  const loadProjectDivisions = async () => {
    try {
      if (!projectId) return;
      
      const divisions = await quotesApi.getDivisions(projectId);
      setDivisions(divisions);

      await refreshDivisionStatuses();
    } catch (error) {
      console.error('Failed to load divisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDivisionStatuses = async () => {
    try {
      if (!projectId) return;
      
      const statusUpdates = await quotesApi.refreshDivisionStatuses(projectId);
      setDivisionStatuses(statusUpdates);
    } catch (error) {
      console.error('Failed to refresh division statuses:', error);
    }
  };

  // Navigation handled directly by DivisionManager component

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-lg text-gray-600">Loading project divisions...</div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="text-center py-12">
        <div className="text-lg text-red-600">Project ID is required</div>
      </div>
    );
  }

  const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Demo Mode Active
              </h3>
              <div className="text-sm text-yellow-700">
                Showing seeded data with electrical division pre-loaded with 2 vendor quotes. Click through the full workflow!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <ProjectBreadcrumb 
        items={[
          { 
            label: 'Divisions', 
            active: true 
          }
        ]} 
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Divisions</h1>
          <p className="text-gray-600">
            Quote workflow management {isDemo && <span className="text-yellow-600">(Demo Mode)</span>}
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-primary border border-primary rounded hover:bg-primary/5"
        >
          ← Dashboard
        </button>
      </div>

      <DivisionManager
        divisions={divisions}
        divisionStatuses={divisionStatuses}
        projectId={projectId}
      />
    </div>
  );
}