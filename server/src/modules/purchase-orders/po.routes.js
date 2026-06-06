// =============================================================================
// po.routes.js
// =============================================================================

const { Router } = require('express');
const poController = require('./po.controller');
const { updatePOSchema, updatePOStatusSchema, poQuerySchema, validate } = require('./po.validation');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  validate(poQuerySchema, 'query'),
  poController.getAllPOs
);

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER', 'VENDOR'),
  poController.getPOById
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER'),
  validate(updatePOSchema, 'body'),
  poController.updatePO
);

router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR'),
  validate(updatePOStatusSchema, 'body'),
  poController.updatePOStatus
);

module.exports = router;