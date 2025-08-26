import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import Layout from './components/Layout';
import BudgetUpload from './pages/BudgetUpload';
import QuoteUpload from './pages/QuoteUpload';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/budget" replace />} />
            <Route path="/budget" element={<BudgetUpload />} />
            <Route path="/quotes" element={<QuoteUpload />} />
            <Route path="*" element={<Navigate to="/budget" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
