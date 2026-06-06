// =============================================================================
// dashboard.routes.js
// =============================================================================

const { Router } = require('express');
const dashboardController = require('./dashboard.controller');
const { authenticate, authorizeRoles } = require('../../middleware/auth');

const router = Router();

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER'),
  dashboardController.getDashboardStats
);

module.exports = router;