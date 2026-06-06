/**
 * @file quotation.api.js
 * @description Axios API calls for the Quotations module.
 */

import api from './axios';

/** Fetch paginated list of quotations */
export const getQuotationsAPI = (params) => api.get('/quotations', { params });

/** Fetch side-by-side comparison for all quotations on an RFQ */
export const compareQuotationsAPI = (rfqId) => api.get(`/quotations/compare/${rfqId}`);

/** Fetch a single quotation with full item breakdown */
export const getQuotationByIdAPI = (id) => api.get(`/quotations/${id}`);

/** Vendor submits a new quotation */
export const createQuotationAPI = (data) => api.post('/quotations', data);

/** Vendor revises an existing quotation */
export const updateQuotationAPI = (id, data) => api.put(`/quotations/${id}`, data);

/** Officer/Admin accepts a quotation */
export const acceptQuotationAPI = (id) => api.patch(`/quotations/${id}/accept`);

/** Officer/Admin rejects a quotation */
export const rejectQuotationAPI = (id) => api.patch(`/quotations/${id}/reject`);