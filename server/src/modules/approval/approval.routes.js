// =============================================================================
// approval.routes.js
// =============================================================================

const { Router } = require('express');
const approvalController = require('./approval.controller');
const {
  requestApprovalSchema,
  resolveApprovalSchema,
  approvalQuerySchema,
  validate,
} = require('./approval.validation');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER'),
  validate(approvalQuerySchema, 'query'),
  approvalController.getAllApprovals
);

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER'),
  approvalController.getApprovalById
);

router.post(
  '/',
  authenticate,
  authorizeRoles('PROCUREMENT_OFFICER', 'ADMIN'),
  validate(requestApprovalSchema, 'body'),
  approvalController.requestApproval
);

router.patch(
  '/:id/resolve',
  authenticate,
  authorizeRoles('MANAGER', 'ADMIN'),
  validate(resolveApprovalSchema, 'body'),
  approvalController.resolveApproval
);

module.exports = router;