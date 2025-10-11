import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { theme } from './theme/theme';
import Layout from './components/Layout/Layout';
import ImportInvoicesPage from './pages/ImportInvoicesPage';
import ReviewPage from './pages/ReviewPage';
import InvoicesPage from './pages/InvoicesPage';
import VendorsPage from './pages/VendorsPage';
import PromptsPage from './pages/PromptsPage';
import BatchesPage from './pages/BatchesPage';
import ExportPage from './pages/ExportPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<ImportInvoicesPage />} />
              <Route path="import" element={<ImportInvoicesPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="prompts" element={<PromptsPage />} />
              <Route path="batches" element={<BatchesPage />} />
              <Route path="export" element={<ExportPage />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;