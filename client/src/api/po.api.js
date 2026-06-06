// src/api/po.api.js
/** Purchase Order API methods for VendorBridge ERP */
import api from './axios';

export const getPurchaseOrdersAPI   = (params)     => api.get('/purchase-orders', { params });
export const getPurchaseOrderByIdAPI= (id)         => api.get(`/purchase-orders/${id}`);
export const updatePurchaseOrderAPI = (id, data)   => api.put(`/purchase-orders/${id}`, data);
export const updatePOStatusAPI      = (id, status) => api.patch(`/purchase-orders/${id}/status`, { status });