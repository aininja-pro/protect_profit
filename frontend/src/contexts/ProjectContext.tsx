import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Project {
  id: string;
  name: string;
  location?: string;
  project_type?: string;
  status: 'active' | 'draft' | 'completed' | 'archived';
  created_at: string;
  budget_total?: number;
  divisions_count?: number;
  quotes_count?: number;
}

interface ProjectContextType {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  recentProjects: Project[];
  setRecentProjects: (projects: Project[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load projects from API and sync with localStorage
  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Fetch projects from API
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
        const response = await fetch(`${API_BASE}/projects`);
        
        if (response.ok) {
          const apiProjects = await response.json();
          
          // Transform API data to match our Project interface
          const projects: Project[] = apiProjects.map((project: any) => ({
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
          
          setRecentProjects(projects);
          localStorage.setItem('recentProjects', JSON.stringify(projects));
          
          // Try to restore saved project, or default to first available project
          const savedProjectId = localStorage.getItem('currentProjectId');
          let projectToSet: Project | null = null;
          
          if (savedProjectId) {
            projectToSet = projects.find(p => p.id === savedProjectId) || null;
          }
          
          // If no valid saved project, use the first available project
          if (!projectToSet && projects.length > 0) {
            projectToSet = projects[0];
          }
          
          if (projectToSet) {
            setCurrentProjectState(projectToSet);
            localStorage.setItem('currentProjectId', projectToSet.id);
          } else {
            // Clean up invalid localStorage data
            localStorage.removeItem('currentProjectId');
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        
        // Fallback to localStorage data if API fails
        const savedProjects = localStorage.getItem('recentProjects');
        if (savedProjects) {
          const projects = JSON.parse(savedProjects);
          setRecentProjects(projects);
          
          const savedProjectId = localStorage.getItem('currentProjectId');
          if (savedProjectId) {
            const savedProject = projects.find((p: Project) => p.id === savedProjectId);
            if (savedProject) {
              setCurrentProjectState(savedProject);
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProjects();
  }, []);

  // Persist current project to localStorage
  const setCurrentProject = (project: Project | null) => {
    setCurrentProjectState(project);
    
    if (project) {
      localStorage.setItem('currentProjectId', project.id);
      
      // Add to recent projects if not already there
      setRecentProjects(prev => {
        const filtered = prev.filter(p => p.id !== project.id);
        const updated = [project, ...filtered].slice(0, 10); // Keep last 10
        localStorage.setItem('recentProjects', JSON.stringify(updated));
        return updated;
      });
    } else {
      localStorage.removeItem('currentProjectId');
    }
  };

  return (
    <ProjectContext.Provider value={{
      currentProject,
      setCurrentProject,
      recentProjects,
      setRecentProjects,
      isLoading,
      setIsLoading
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}