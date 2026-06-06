// =============================================================================
// invoice.routes.js
// =============================================================================

const { Router } = require('express');
const invoiceController = require('./invoice.controller');
const {
  updateInvoiceSchema,
  sendInvoiceSchema,
  updateInvoiceStatusSchema,
  invoiceQuerySchema,
  validate,
} = require('./invoice.validation');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  validate(invoiceQuerySchema, 'query'),
  invoiceController.getAllInvoices
);

router.get(
  '/:id/pdf',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  invoiceController.downloadInvoicePDF
);

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  invoiceController.getInvoiceById
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER'),
  validate(updateInvoiceSchema, 'body'),
  invoiceController.updateInvoice
);

router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  validate(updateInvoiceStatusSchema, 'body'),
  invoiceController.updateInvoiceStatus
);

router.post(
  '/:id/send',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER'),
  validate(sendInvoiceSchema, 'body'),
  invoiceController.sendInvoiceEmail
);

module.exports = router;