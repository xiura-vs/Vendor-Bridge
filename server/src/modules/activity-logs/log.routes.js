// =============================================================================
// log.routes.js
// =============================================================================

const { Router } = require('express');
const logController = require('./log.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'MANAGER'),
  logController.getAllLogs
);

module.exports = router;