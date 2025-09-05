import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import ProjectBreadcrumb from '../components/ProjectBreadcrumb';
import axios from 'axios';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { setCurrentProject } = useProject();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    project_type: '',
    target_margin: ''
  });
  const [creating, setCreating] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setCreating(true);
    try {
      // Create project via API
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
      const response = await axios.post(`${API_BASE}/projects`, {
        name: formData.name,
        location: formData.location || null,
        project_type: formData.project_type || null,
        target_margin: formData.target_margin ? parseFloat(formData.target_margin) : null
      });

      const createdProject = response.data.project;
      
      // Set as current project
      const newProject = {
        ...createdProject,
        budget_total: undefined,
        divisions_count: 0,
        quotes_count: 0
      };
      
      setCurrentProject(newProject);

      // Navigate to budget upload with project context
      navigate('/budget', { 
        state: { 
          projectId: newProject.id, 
          message: `Project "${newProject.name}" created! Upload your budget to get started.` 
        }
      });

    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <ProjectBreadcrumb 
        items={[
          { 
            label: 'Create New Project', 
            active: true 
          }
        ]} 
      />

      <div className="max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
          <p className="text-gray-600 mt-2">
            Set up a new construction project and upload your budget estimate
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Main Street Office Building, Johnson Residence Addition"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g., 123 Main St, Anytown, State"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Type
              </label>
              <select
                name="project_type"
                value={formData.project_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                <option value="">Select project type</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="renovation">Renovation</option>
                <option value="addition">Addition</option>
                <option value="infrastructure">Infrastructure</option>
              </select>
            </div>

            {/* Target Margin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Margin (%)
              </label>
              <input
                type="number"
                name="target_margin"
                value={formData.target_margin}
                onChange={handleInputChange}
                placeholder="e.g., 15"
                min="0"
                max="50"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={!formData.name.trim() || creating}
                className={`px-6 py-2 rounded font-medium ${
                  formData.name.trim() && !creating
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {creating ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Project & Upload Budget'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Next Steps Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Project is created and set as your current project</li>
            <li>2. You'll be taken to budget upload to analyze your construction estimate</li>
            <li>3. After budget analysis, you can start uploading vendor quotes</li>
            <li>4. Compare quotes, get AI recommendations, and make decisions</li>
          </ol>
        </div>
      </div>
    </div>
  );
}