import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import { cn } from '../lib/utils';

export default function ProjectSwitcher() {
  const { currentProject, setCurrentProject, recentProjects } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProjectSelect = (project: any) => {
    setCurrentProject(project);
    setIsOpen(false);
    navigate(`/projects/${project.id}`);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    navigate('/projects/create');
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/projects');
  };

  if (!currentProject) {
    return (
      <button
        onClick={() => navigate('/projects')}
        className="px-3 py-2 text-sm font-medium text-white hover:text-primary border border-gray-600 rounded"
      >
        Select Project
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white hover:text-primary border border-gray-600 rounded"
      >
        <span className="truncate max-w-32">
          {currentProject.name || 'Unknown Project'}
        </span>
        <svg 
          className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
          {/* Current Project */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase">Current Project</div>
            <div className="text-sm font-medium text-gray-900">{currentProject.name || 'Unknown Project'}</div>
            <div className="text-xs text-gray-500">
              {currentProject.budget_total ? 
                `$${(currentProject.budget_total / 1000).toFixed(0)}K budget` : 
                'No budget loaded'
              }
              {currentProject.divisions_count && ` • ${currentProject.divisions_count} divisions`}
            </div>
          </div>

          {/* Recent Projects */}
          {recentProjects.length > 1 && (
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Recent Projects</div>
              {recentProjects
                .filter(p => p.id !== currentProject.id)
                .slice(0, 5)
                .map(project => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{project.name}</div>
                    <div className="text-xs text-gray-500">{project.status}</div>
                  </div>
                  {project.budget_total && (
                    <div className="text-xs text-gray-400">
                      ${(project.budget_total / 1000).toFixed(0)}K
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleCreateNew}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-primary font-medium"
            >
              + Create New Project
            </button>
            <button
              onClick={handleViewAll}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
            >
              📋 View All Projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}