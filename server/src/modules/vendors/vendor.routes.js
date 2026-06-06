// =============================================================================
// vendor.routes.js
// Defines all vendor API endpoints with authentication and role guards.
// Auth middleware is provided by teammate — assumed to export:
//   authenticate       → verifies JWT, attaches req.user
//   authorizeRoles()   → role-based access control factory
// =============================================================================

const { Router } = require('express');
const vendorController = require('./vendor.controller');
const {
  createVendorSchema,
  updateVendorSchema,
  updateVendorStatusSchema,
  vendorQuerySchema,
  validate,
} = require('./vendor.validation');

// Temporary stubs until teammate's auth module is merged
// These will be replaced by: const { authenticate, authorizeRoles } = require('../../middleware/auth');
const authenticate = (req, res, next) => next();
const authorizeRoles = (...roles) => (req, res, next) => next();

const router = Router();

// GET /api/vendors — List all vendors (with filters)
router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  validate(vendorQuerySchema, 'query'),
  vendorController.getAllVendors
);

// GET /api/vendors/:id — Get single vendor
router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  vendorController.getVendorById
);

// POST /api/vendors — Create vendor
router.post(
  '/',
  authenticate,
  authorizeRoles('ADMIN'),
  validate(createVendorSchema, 'body'),
  vendorController.createVendor
);

// PUT /api/vendors/:id — Update vendor
router.put(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN'),
  validate(updateVendorSchema, 'body'),
  vendorController.updateVendor
);

// PATCH /api/vendors/:id/status — Update vendor status only
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('ADMIN'),
  validate(updateVendorStatusSchema, 'body'),
  vendorController.updateVendorStatus
);

// DELETE /api/vendors/:id — Soft delete vendor
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN'),
  vendorController.deleteVendor
);

module.exports = router;