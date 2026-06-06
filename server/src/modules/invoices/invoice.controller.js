// =============================================================================
// invoice.controller.js
// =============================================================================

const invoiceService = require('./invoice.service');
const asyncHandler = require('../../utils/asyncHandler');

const getAllInvoices = asyncHandler(async (req, res) => {
  const result = await invoiceService.getAllInvoices(req.query);
  return res.status(200).json({ success: true, message: 'Invoices fetched.', ...result });
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  return res.status(200).json({ success: true, message: 'Invoice fetched.', data: invoice });
});

const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user);
  return res.status(200).json({ success: true, message: 'Invoice updated.', data: invoice });
});

const updateInvoiceStatus = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoiceStatus(
    req.params.id,
    req.body.status,
    req.user
  );
  return res.status(200).json({
    success: true,
    message: `Invoice status updated to ${req.body.status}.`,
    data: invoice,
  });
});

const sendInvoiceEmail = asyncHandler(async (req, res) => {
  const result = await invoiceService.sendInvoiceEmail(
    req.params.id,
    req.body.recipient_email,
    req.user
  );
  return res.status(200).json({ success: true, ...result });
});

// PDF download — does not use standard JSON response
const downloadInvoicePDF = asyncHandler(async (req, res) => {
  await invoiceService.downloadInvoicePDF(req.params.id, res);
});

module.exports = {
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  updateInvoiceStatus,
  sendInvoiceEmail,
  downloadInvoicePDF,
};