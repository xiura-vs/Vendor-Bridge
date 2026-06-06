// =============================================================================
// vendor.controller.js
// HTTP layer for Vendor Management. Calls service functions and formats
// responses. No business logic or Prisma calls here.
// =============================================================================

const vendorService = require('./vendor.service');
const asyncHandler = require('../../utils/asyncHandler');

// ---------------------------------------------------------------------------
// GET /api/vendors
// ---------------------------------------------------------------------------
/**
 * Returns paginated list of vendors with optional filters.
 */
const getAllVendors = asyncHandler(async (req, res) => {
  const result = await vendorService.getAllVendors(req.query);
  return res.status(200).json({
    success: true,
    message: 'Vendors fetched successfully.',
    ...result, // spreads: data, total, page, limit, totalPages
  });
});

// ---------------------------------------------------------------------------
// GET /api/vendors/:id
// ---------------------------------------------------------------------------
/**
 * Returns a single vendor by UUID.
 */
const getVendorById = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'Vendor fetched successfully.',
    data: vendor,
  });
});

// ---------------------------------------------------------------------------
// POST /api/vendors
// ---------------------------------------------------------------------------
/**
 * Creates a new vendor. Requires ADMIN role.
 */
const createVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.createVendor(req.body, req.user.userId);
  return res.status(201).json({
    success: true,
    message: 'Vendor created successfully.',
    data: vendor,
  });
});

// ---------------------------------------------------------------------------
// PUT /api/vendors/:id
// ---------------------------------------------------------------------------
/**
 * Updates an existing vendor's details. Requires ADMIN role.
 */
const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendor(
    req.params.id,
    req.body,
    req.user.userId
  );
  return res.status(200).json({
    success: true,
    message: 'Vendor updated successfully.',
    data: vendor,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/vendors/:id/status
// ---------------------------------------------------------------------------
/**
 * Updates only the status of a vendor (ACTIVE/INACTIVE/BLACKLISTED).
 */
const updateVendorStatus = asyncHandler(async (req, res) => {
  const vendor = await vendorService.updateVendorStatus(
    req.params.id,
    req.body.status,
    req.user.userId
  );
  return res.status(200).json({
    success: true,
    message: `Vendor status updated to ${req.body.status}.`,
    data: vendor,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/vendors/:id
// ---------------------------------------------------------------------------
/**
 * Soft-deletes a vendor by setting status to INACTIVE.
 */
const deleteVendor = asyncHandler(async (req, res) => {
  await vendorService.deleteVendor(req.params.id, req.user.userId);
  return res.status(200).json({
    success: true,
    message: 'Vendor deactivated successfully.',
    data: null,
  });
});

module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
};