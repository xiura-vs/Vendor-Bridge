/**
 * @file rfq.api.js
 * @description Axios API calls for the RFQ (Request for Quotation) module.
 */

import api from './axios';

/** Fetch paginated list of RFQs */
export const getRFQsAPI = (params) => api.get('/rfqs', { params });

/** Fetch aggregate counts by status */
export const getRFQStatsAPI = () => api.get('/rfqs/stats');

/** Fetch a single RFQ with items + vendors */
export const getRFQByIdAPI = (id) => api.get(`/rfqs/${id}`);

/** Create a new RFQ */
export const createRFQAPI = (data) => api.post('/rfqs', data);

/** Update an existing RFQ */
export const updateRFQAPI = (id, data) => api.put(`/rfqs/${id}`, data);

/** Append items to an existing RFQ */
export const addRFQItemsAPI = (id, items) => api.post(`/rfqs/${id}/items`, { items });

/** Append vendors to an existing RFQ */
export const addRFQVendorsAPI = (id, vendor_ids) => api.post(`/rfqs/${id}/vendors`, { vendor_ids });

/** Transition RFQ to a new status */
export const updateRFQStatusAPI = (id, status) => api.patch(`/rfqs/${id}/status`, { status });

/** Permanently delete a DRAFT RFQ */
export const deleteRFQAPI = (id) => api.delete(`/rfqs/${id}`);