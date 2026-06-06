// =============================================================================
// dashboard.controller.js
// =============================================================================

const dashboardService = require('./dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');

const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getDashboardStats(req.user);
  return res.status(200).json({
    success: true,
    message: 'Dashboard stats fetched successfully.',
    data: stats,
  });
});

module.exports = { getDashboardStats };