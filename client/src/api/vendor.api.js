import api from './axios';

export const getVendorsAPI         = (params) => api.get('/vendors', { params });
export const getVendorByIdAPI      = (id) => api.get(`/vendors/${id}`);
export const createVendorAPI       = (data) => api.post('/vendors', data);
export const updateVendorAPI       = (id, data) => api.put(`/vendors/${id}`, data);
export const updateVendorStatusAPI = (id, status) => api.patch(`/vendors/${id}/status`, { status });
export const deleteVendorAPI       = (id) => api.delete(`/vendors/${id}`);