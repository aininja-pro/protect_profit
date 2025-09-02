import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject, Project } from '../contexts/ProjectContext';
import { quotesApi } from '../services/quotesApi';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, recentProjects, setRecentProjects } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchProjects();
  }, []);

  // Refresh projects when returning to dashboard
  useEffect(() => {
    const handleFocus = () => {
      fetchProjects();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      // Get projects from API
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
      const response = await axios.get(`${API_BASE}/projects`);
      
      // Transform API data to match our Project interface
      const apiProjects = response.data.map((project: any) => ({
        id: project.id,
        name: project.name,
        location: project.location,
        project_type: project.project_type,
        status: project.status,
        created_at: project.created_at,
        budget_total: project.budget_total || undefined,
        divisions_count: project.divisions_count || 0,
        quotes_count: project.quotes_count || 0
      }));
      
      setProjects(apiProjects);
      setRecentProjects(apiProjects);
    } catch (error: any) {
      console.error('Failed to fetch projects:', error);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getProjectStatusInfo = (project: Project) => {
    // This would be enhanced with actual budget/quote data
    return {
      hasBudget: true, // TODO: Check if project has budget items
      hasQuotes: false, // TODO: Check if project has quotes
      isComplete: false // TODO: Check if project is finalized
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${project.name}"? This will permanently remove all data including budget items, quotes, and files.`);
    
    if (!confirmDelete) return;
    
    try {
      await quotesApi.deleteProject(project.id);
      // Remove from local state
      setProjects(prev => prev.filter(p => p.id !== project.id));
      
      // Clear current project if it was deleted
      if (currentProject?.id === project.id) {
        setCurrentProject(null);
      }
      
      alert('Project deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-dark">Project Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your construction estimates and quote comparisons</p>
        </div>
        
        <button 
          onClick={() => navigate('/projects/create')}
          className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 font-medium"
        >
          + Create New Project
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Projects Yet</h3>
          <p className="text-gray-500 mb-6">Create your first project to start analyzing estimates and quotes</p>
          <button 
            onClick={() => navigate('/projects/create')}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            + Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const statusInfo = getProjectStatusInfo(project);
            
            return (
              <div key={project.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                      
                      {/* Status Indicators */}
                      <div className="flex space-x-2">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${ 
                          statusInfo.hasBudget ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {statusInfo.hasBudget ? '✅ Budget' : '📋 Budget'}
                        </span>
                        
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          statusInfo.hasQuotes ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {statusInfo.hasQuotes ? '✅ Quotes' : '⏳ Quotes'}
                        </span>
                        
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          statusInfo.isComplete ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {statusInfo.isComplete ? '🎯 Ready' : '⚪ Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 space-y-1">
                      {project.location && <p>📍 {project.location}</p>}
                      {project.project_type && <p>🏗️ {project.project_type}</p>}
                      <p>📅 Created {formatDate(project.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setCurrentProject(project);
                        navigate(`/projects/${project.id}`);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm font-medium"
                    >
                      {project.id === currentProject?.id ? 'Continue' : 'Open Project'}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteProject(project)}
                      className="px-3 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 text-sm font-medium"
                      title="Delete Project"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}