// src/api/invoice.api.js
/** Invoice API methods for VendorBridge ERP */
import api from './axios';

export const getInvoicesAPI      = (params)     => api.get('/invoices', { params });
export const getInvoiceByIdAPI   = (id)         => api.get(`/invoices/${id}`);
export const updateInvoiceAPI    = (id, data)   => api.put(`/invoices/${id}`, data);
export const updateInvoiceStatusAPI = (id, status) => api.patch(`/invoices/${id}/status`, { status });
export const sendInvoiceAPI      = (id)         => api.post(`/invoices/${id}/send`);
export const getInvoicePdfUrl    = (id)         => `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/invoices/${id}/pdf`;