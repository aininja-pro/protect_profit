import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // TODO: Add JWT token when auth is implemented
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // TODO: Handle unauthorized - redirect to login
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// Project API calls
export const projectsApi = {
  // Get all projects
  getProjects: () => api.get('/projects/'),
  
  // Create new project
  createProject: (projectData) => api.post('/projects/', projectData),
  
  // Get specific project
  getProject: (projectId) => api.get(`/projects/${projectId}`),
};

// Budget API calls
export const budgetApi = {
  // Analyze Excel file for sheet and column suggestions
  analyzeFile: (projectId, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    
    return api.post('/budget/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Upload budget file with sheet and column mapping
  uploadBudget: (projectId, sheetName, columnMapping, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('sheet_name', sheetName);
    formData.append('file', file);
    
    if (columnMapping) {
      formData.append('column_mapping', JSON.stringify(columnMapping));
    }
    
    return api.post('/budget/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Get budget preview
  getBudgetPreview: (projectId) => api.get(`/budget/preview/${projectId}`),
};

// Quotes API calls
export const quotesApi = {
  // Upload quote file
  uploadQuote: (projectId, vendorName, trade, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('vendor_name', vendorName);
    formData.append('trade', trade);
    formData.append('file', file);
    
    return api.post('/quotes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Get quotes for project
  getQuotes: (projectId) => api.get(`/quotes/list/${projectId}`),
  
  // Process quote with AI
  processQuote: (quoteId) => api.post(`/quotes/process/${quoteId}`),
};

// AI Budget API calls  
export const aiBudgetApi = {
  // Smart upload with AI analysis
  smartUpload: (projectId, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    
    return api.post('/ai-budget/smart-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Get AI analysis results
  getAnalysis: (projectId) => api.get(`/ai-budget/analysis/${projectId}`),
};

// Health check
export const healthCheck = () => api.get('/health', {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8001',
});

export default api;