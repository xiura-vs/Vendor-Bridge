// =============================================================================
// approval.controller.js
// =============================================================================

const approvalService = require('./approval.service');
const asyncHandler = require('../../utils/asyncHandler');

const getAllApprovals = asyncHandler(async (req, res) => {
  const result = await approvalService.getAllApprovals(req.query, req.user);
  return res.status(200).json({
    success: true,
    message: 'Approvals fetched successfully.',
    ...result,
  });
});

const getApprovalById = asyncHandler(async (req, res) => {
  const approval = await approvalService.getApprovalById(req.params.id);
  return res.status(200).json({
    success: true,
    message: 'Approval fetched successfully.',
    data: approval,
  });
});

const requestApproval = asyncHandler(async (req, res) => {
  const approval = await approvalService.requestApproval(req.body, req.user);
  return res.status(201).json({
    success: true,
    message: 'Approval requested successfully.',
    data: approval,
  });
});

const resolveApproval = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  const approval = await approvalService.resolveApproval(
    req.params.id,
    status,
    remarks,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: `Approval ${status.toLowerCase()} successfully.`,
    data: approval,
  });
});

module.exports = { getAllApprovals, getApprovalById, requestApproval, resolveApproval };