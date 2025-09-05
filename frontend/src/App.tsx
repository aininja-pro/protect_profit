import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ProjectProvider } from './contexts/ProjectContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProjectPage from './pages/ProjectPage';
import CreateProjectPage from './pages/CreateProjectPage';
import DivisionsPage from './pages/DivisionsPage';
import SimpleQuotesPage from './pages/SimpleQuotesPage';
import DivisionQuoteUploadPage from './pages/DivisionQuoteUploadPage';
import QuoteMappingPage from './pages/QuoteMappingPage';
import QuoteComparisonPage from './pages/QuoteComparisonPage';
import DecisionPage from './pages/DecisionPage';
import BudgetUpload from './pages/BudgetUpload';
import QuoteUpload from './pages/QuoteUpload';

function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <Router>
          <Layout>
            <Routes>
              {/* Dashboard/Projects */}
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<Dashboard />} />
              <Route path="/projects/create" element={<CreateProjectPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              
              {/* Simple Quote Management */}
              <Route path="/projects/:projectId/quotes" element={<SimpleQuotesPage />} />
              
              {/* Division Management */}
              <Route path="/projects/:projectId/divisions" element={<DivisionsPage />} />
              <Route path="/projects/:projectId/divisions/:divisionId/quotes/upload" element={<DivisionQuoteUploadPage />} />
              <Route path="/projects/:projectId/divisions/:divisionId/quotes/mapping" element={<QuoteMappingPage />} />
              <Route path="/projects/:projectId/divisions/:divisionId/quotes/compare" element={<QuoteComparisonPage />} />
              <Route path="/projects/:projectId/divisions/:divisionId/quotes/decision" element={<DecisionPage />} />
              
              {/* Legacy routes */}
              <Route path="/budget" element={<BudgetUpload />} />
              <Route path="/quotes" element={<QuoteUpload />} />
              
              <Route path="*" element={<Navigate to="/projects" replace />} />
            </Routes>
          </Layout>
        </Router>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
