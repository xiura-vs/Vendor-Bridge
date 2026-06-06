// =============================================================================
// quotation.controller.js
// HTTP layer for Quotation Management.
// Calls service functions, formats responses. No business logic here.
// =============================================================================

const quotationService = require('./quotation.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * POST /api/v1/quotations
 * Vendor submits a quotation for a published RFQ.
 */
const submitQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.submitQuotation(req.body, req.user);
  return res.status(201).json({
    success: true,
    message: 'Quotation submitted successfully.',
    data: quotation,
  });
});

/**
 * GET /api/v1/quotations
 * Returns paginated quotation list scoped by role.
 */
const getAllQuotations = asyncHandler(async (req, res) => {
  const result = await quotationService.getAllQuotations(req.query, req.user);
  return res.status(200).json({
    success: true,
    message: 'Quotations fetched successfully.',
    ...result,
  });
});

/**
 * GET /api/v1/quotations/:id
 * Returns single quotation with full item details.
 */
const getQuotationById = asyncHandler(async (req, res) => {
  const quotation = await quotationService.getQuotationById(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: 'Quotation fetched successfully.',
    data: quotation,
  });
});

/**
 * GET /api/v1/quotations/compare/:rfqId
 * Returns all quotations for an RFQ sorted by grand total for comparison.
 */
const getQuotationsForComparison = asyncHandler(async (req, res) => {
  const result = await quotationService.getQuotationsForComparison(req.params.rfqId);
  return res.status(200).json({
    success: true,
    message: 'Quotation comparison data fetched successfully.',
    data: result,
  });
});

/**
 * PUT /api/v1/quotations/:id
 * Vendor revises a submitted quotation.
 */
const updateQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.updateQuotation(req.params.id, req.body, req.user);
  return res.status(200).json({
    success: true,
    message: 'Quotation revised successfully.',
    data: quotation,
  });
});

/**
 * PATCH /api/v1/quotations/:id/accept
 * Accepts a quotation and rejects all others for the same RFQ.
 */
const acceptQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.acceptQuotation(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: 'Quotation accepted. All other quotations for this RFQ have been rejected.',
    data: quotation,
  });
});

/**
 * PATCH /api/v1/quotations/:id/reject
 * Rejects a single quotation.
 */
const rejectQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.rejectQuotation(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: 'Quotation rejected successfully.',
    data: quotation,
  });
});

module.exports = {
  submitQuotation,
  getAllQuotations,
  getQuotationById,
  getQuotationsForComparison,
  updateQuotation,
  acceptQuotation,
  rejectQuotation,
};