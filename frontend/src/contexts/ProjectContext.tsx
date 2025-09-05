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

  // Load current project from localStorage on mount
  useEffect(() => {
    const savedProjectId = localStorage.getItem('currentProjectId');
    const savedProjects = localStorage.getItem('recentProjects');
    
    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      setRecentProjects(projects);
      
      if (savedProjectId) {
        const savedProject = projects.find((p: Project) => p.id === savedProjectId);
        if (savedProject) {
          setCurrentProjectState(savedProject);
        }
      }
    }
    
    setIsLoading(false);
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