import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface ProjectBreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function ProjectBreadcrumb({ items }: ProjectBreadcrumbProps) {
  const navigate = useNavigate();
  const { currentProject } = useProject();

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      {/* Dashboard */}
      <button
        onClick={() => navigate('/')}
        className="hover:text-gray-900 transition-colors"
      >
        Dashboard
      </button>
      
      <span className="text-gray-400">/</span>
      
      {/* Current Project */}
      {currentProject && (
        <>
          <button
            onClick={() => navigate(`/projects/${currentProject.id}`)}
            className="hover:text-gray-900 transition-colors font-medium"
          >
            {currentProject.name}
          </button>
          <span className="text-gray-400">/</span>
        </>
      )}
      
      {/* Dynamic Items */}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.href && !item.active ? (
            <button
              onClick={() => handleNavigation(item.href!)}
              className="hover:text-gray-900 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className={item.active ? 'text-gray-900 font-medium' : 'text-gray-600'}>
              {item.label}
            </span>
          )}
          
          {index < items.length - 1 && (
            <span className="text-gray-400">/</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}