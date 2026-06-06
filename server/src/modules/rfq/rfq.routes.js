// =============================================================================
// rfq.routes.js
// All RFQ API endpoints with authentication and role-based access control.
// Auth middleware assumed from teammate — stubs used until merged.
// =============================================================================

const { Router } = require('express');
const rfqController = require('./rfq.controller');
const {
  createRFQSchema,
  updateRFQSchema,
  addRFQItemsSchema,
  assignVendorsSchema,
  updateRFQStatusSchema,
  rfqQuerySchema,
  validate,
} = require('./rfq.validation');

// Stubs — replace with real import once auth module is merged:
// const { authenticate, authorizeRoles } = require('../../middleware/auth');
const authenticate = (req, res, next) => {
  // Temporary: attach a mock user so service role-scoping works during dev
  // rfq.routes.js
req.user = { 
  userId: req.headers['x-user-id'] || 'dev-user',  // ← 'dev-user' is not a real UUID
  role: req.headers['x-user-role'] || 'ADMIN' 
}
  next();
};
const authorizeRoles = (...roles) => (req, res, next) => next();

const router = Router();

// GET /api/rfqs/stats — must be BEFORE /:id to avoid conflict
router.get(
  '/stats',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  rfqController.getRFQStats
);

// GET /api/rfqs
router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  validate(rfqQuerySchema, 'query'),
  rfqController.getAllRFQs
);

// GET /api/rfqs/:id
router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  rfqController.getRFQById
);

// POST /api/rfqs
router.post(
  '/',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  validate(createRFQSchema, 'body'),
  rfqController.createRFQ
);

// PUT /api/rfqs/:id
router.put(
  '/:id',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  validate(updateRFQSchema, 'body'),
  rfqController.updateRFQ
);

// POST /api/rfqs/:id/items
router.post(
  '/:id/items',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  validate(addRFQItemsSchema, 'body'),
  rfqController.addItemsToRFQ
);

// POST /api/rfqs/:id/vendors
router.post(
  '/:id/vendors',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  validate(assignVendorsSchema, 'body'),
  rfqController.assignVendorsToRFQ
);

// PATCH /api/rfqs/:id/status
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN', 'MANAGER'),
  validate(updateRFQStatusSchema, 'body'),
  rfqController.updateRFQStatus
);

// DELETE /api/rfqs/:id
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  rfqController.deleteRFQ
);

module.exports = router;