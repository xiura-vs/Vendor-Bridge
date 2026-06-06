// src/api/dashboard.api.js
/**
 * Dashboard & Reports API
 * Fetches aggregated stats used by DashboardPage and ReportsPage.
 */
import api from './axios';

export const getDashboardStatsAPI = () => api.get('/dashboard');