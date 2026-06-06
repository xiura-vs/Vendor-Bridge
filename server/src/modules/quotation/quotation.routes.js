// =============================================================================
// quotation.routes.js
// All Quotation API endpoints with role-based access control.
// =============================================================================

const { Router } = require('express');
const quotationController = require('./quotation.controller');
const {
  submitQuotationSchema,
  updateQuotationSchema,
  quotationQuerySchema,
  validate,
} = require('./quotation.validation');

// Stubs — replace with real import once auth module is merged:
// const { authenticate, authorizeRoles } = require('../../middleware/auth');
const authenticate = (req, res, next) => {
  req.user = {
    userId: req.headers['x-user-id'] || 'dev-user',
    role: req.headers['x-user-role'] || 'ADMIN',
  };
  next();
};
const authorizeRoles = (...roles) => (req, res, next) => next();

const router = Router();

// GET /api/v1/quotations/compare/:rfqId — BEFORE /:id to avoid conflict
router.get(
  '/compare/:rfqId',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  quotationController.getQuotationsForComparison
);

// GET /api/v1/quotations
router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  validate(quotationQuerySchema, 'query'),
  quotationController.getAllQuotations
);

// GET /api/v1/quotations/:id
router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  quotationController.getQuotationById
);

// POST /api/v1/quotations
router.post(
  '/',
  authenticate,
  authorizeRoles('VENDOR'),
  validate(submitQuotationSchema, 'body'),
  quotationController.submitQuotation
);

// PUT /api/v1/quotations/:id
router.put(
  '/:id',
  authenticate,
  authorizeRoles('VENDOR'),
  validate(updateQuotationSchema, 'body'),
  quotationController.updateQuotation
);

// PATCH /api/v1/quotations/:id/accept
router.patch(
  '/:id/accept',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN', 'MANAGER'),
  quotationController.acceptQuotation
);

// PATCH /api/v1/quotations/:id/reject
router.patch(
  '/:id/reject',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN', 'MANAGER'),
  quotationController.rejectQuotation
);

module.exports = router;