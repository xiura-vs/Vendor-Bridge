// src/api/approval.api.js
/** Approval API methods for VendorBridge ERP */
import api from './axios';

export const getApprovalsAPI     = (params)     => api.get('/approvals', { params });
export const getApprovalByIdAPI  = (id)         => api.get(`/approvals/${id}`);
export const createApprovalAPI   = (data)       => api.post('/approvals', data);
export const resolveApprovalAPI  = (id, data)   => api.patch(`/approvals/${id}/resolve`, data);