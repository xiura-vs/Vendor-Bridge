// =============================================================================
// rfq.controller.js
// HTTP layer for RFQ Management.
// Calls service functions, formats responses. No business logic here.
// =============================================================================

const rfqService = require('./rfq.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * GET /api/rfqs
 * Returns paginated RFQ list scoped by user role.
 */
const getAllRFQs = asyncHandler(async (req, res) => {
  const result = await rfqService.getAllRFQs(req.query, req.user);
  return res.status(200).json({
    success: true,
    message: 'RFQs fetched successfully.',
    ...result,
  });
});

/**
 * GET /api/rfqs/stats
 * Returns RFQ counts grouped by status.
 */
const getRFQStats = asyncHandler(async (req, res) => {
  const stats = await rfqService.getRFQStats(req.user);
  return res.status(200).json({
    success: true,
    message: 'RFQ stats fetched successfully.',
    data: stats,
  });
});

/**
 * GET /api/rfqs/:id
 * Returns single RFQ with full details.
 */
const getRFQById = asyncHandler(async (req, res) => {
  const rfq = await rfqService.getRFQById(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: 'RFQ fetched successfully.',
    data: rfq,
  });
});

/**
 * POST /api/rfqs
 * Creates a new RFQ with items and vendor assignments.
 */
const createRFQ = asyncHandler(async (req, res) => {
  const rfq = await rfqService.createRFQ(req.body, req.user.userId);
  return res.status(201).json({
    success: true,
    message: 'RFQ created successfully.',
    data: rfq,
  });
});

/**
 * PUT /api/rfqs/:id
 * Updates basic RFQ fields (DRAFT only).
 */
const updateRFQ = asyncHandler(async (req, res) => {
  const rfq = await rfqService.updateRFQ(req.params.id, req.body, req.user);
  return res.status(200).json({
    success: true,
    message: 'RFQ updated successfully.',
    data: rfq,
  });
});

/**
 * POST /api/rfqs/:id/items
 * Adds line items to an existing DRAFT RFQ.
 */
const addItemsToRFQ = asyncHandler(async (req, res) => {
  const items = await rfqService.addItemsToRFQ(
    req.params.id,
    req.body.items,
    req.user
  );
  return res.status(201).json({
    success: true,
    message: 'Items added to RFQ successfully.',
    data: items,
  });
});

/**
 * POST /api/rfqs/:id/vendors
 * Assigns vendors to an RFQ.
 */
const assignVendorsToRFQ = asyncHandler(async (req, res) => {
  const result = await rfqService.assignVendorsToRFQ(
    req.params.id,
    req.body.vendor_ids,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: 'Vendors assigned to RFQ successfully.',
    data: result,
  });
});

/**
 * PATCH /api/rfqs/:id/status
 * Updates RFQ status following transition rules.
 */
const updateRFQStatus = asyncHandler(async (req, res) => {
  const rfq = await rfqService.updateRFQStatus(
    req.params.id,
    req.body.status,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: `RFQ status updated to ${req.body.status}.`,
    data: rfq,
  });
});

/**
 * DELETE /api/rfqs/:id
 * Permanently deletes a DRAFT RFQ.
 */
const deleteRFQ = asyncHandler(async (req, res) => {
  await rfqService.deleteRFQ(req.params.id, req.user);
  return res.status(200).json({
    success: true,
    message: 'RFQ deleted successfully.',
    data: null,
  });
});

module.exports = {
  getAllRFQs,
  getRFQStats,
  getRFQById,
  createRFQ,
  updateRFQ,
  addItemsToRFQ,
  assignVendorsToRFQ,
  updateRFQStatus,
  deleteRFQ,
};