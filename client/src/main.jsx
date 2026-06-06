/**
 * main.jsx
 * Application entry point with React Router v6.
 * ProtectedRoute guards authenticated pages.
 * PublicRoute redirects logged-in users away from auth pages.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import './index.css';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// App Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import VendorsPage from './pages/vendors/VendorsPage';
import RFQPage from './pages/rfq/RFQPage';
import QuotationsPage from './pages/quotations/QuotationsPage';
import ApprovalsPage from './pages/approvals/ApprovalsPage';
import POPage from './pages/purchase-orders/POPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import ReportsPage from './pages/reports/ReportsPage';
import ActivityPage from './pages/activity/ActivityPage';

/** Redirects unauthenticated users to /login */
function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
}

/** Redirects authenticated users away from auth pages */
function PublicRoute({ children }) {
  const { token } = useAuthStore();
  return token ? <Navigate to="/dashboard" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            borderRadius: '10px',
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<DashboardPage />} />
          <Route path="vendors"         element={<VendorsPage />} />
          <Route path="rfqs"            element={<RFQPage />} />
          <Route path="quotations"      element={<QuotationsPage />} />
          <Route path="approvals"       element={<ApprovalsPage />} />
          <Route path="purchase-orders" element={<POPage />} />
          <Route path="invoices"        element={<InvoicesPage />} />
          <Route path="reports"         element={<ReportsPage />} />
          <Route path="activity"        element={<ActivityPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);