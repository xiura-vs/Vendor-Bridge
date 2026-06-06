// =============================================================================
// log.controller.js
// =============================================================================

const logService = require('./log.service');
const asyncHandler = require('../../utils/asyncHandler');

const getAllLogs = asyncHandler(async (req, res) => {
  const result = await logService.getAllLogs(req.query);
  return res.status(200).json({
    success: true,
    message: 'Activity logs fetched successfully.',
    ...result,
  });
});

module.exports = { getAllLogs };