// =============================================================================
// po.controller.js
// =============================================================================

const poService = require('./po.service');
const asyncHandler = require('../../utils/asyncHandler');

const getAllPOs = asyncHandler(async (req, res) => {
  const result = await poService.getAllPOs(req.query, req.user);
  return res.status(200).json({ success: true, message: 'Purchase Orders fetched.', ...result });
});

const getPOById = asyncHandler(async (req, res) => {
  const po = await poService.getPOById(req.params.id, req.user);
  return res.status(200).json({ success: true, message: 'Purchase Order fetched.', data: po });
});

const updatePO = asyncHandler(async (req, res) => {
  const po = await poService.updatePO(req.params.id, req.body, req.user);
  return res.status(200).json({ success: true, message: 'Purchase Order updated.', data: po });
});

const updatePOStatus = asyncHandler(async (req, res) => {
  const po = await poService.updatePOStatus(req.params.id, req.body.status, req.user);
  return res.status(200).json({
    success: true,
    message: `Purchase Order status updated to ${req.body.status}.`,
    data: po,
  });
});

module.exports = { getAllPOs, getPOById, updatePO, updatePOStatus };