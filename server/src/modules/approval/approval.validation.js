// =============================================================================
// approval.validation.js
// =============================================================================

const { z } = require('zod');

const requestApprovalSchema = z.object({
  rfq_id: z.string().uuid('rfq_id must be a valid UUID.'),
  quotation_id: z.string().uuid('quotation_id must be a valid UUID.').optional(),
  remarks: z.string().max(500).optional(),
});

const resolveApprovalSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED'], {
      required_error: 'Status is required.',
    }),
    remarks: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'REJECTED') {
        return data.remarks && data.remarks.trim().length > 0;
      }
      return true;
    },
    { message: 'Remarks are required when rejecting an approval.', path: ['remarks'] }
  );

const approvalQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  rfq_id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (result.success) {
      req[target] = result.data;
      return next();
    }
    const { formErrors, fieldErrors } = result.error.flatten();
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: fieldErrors,
      formErrors,
    });
  };
}

module.exports = {
  requestApprovalSchema,
  resolveApprovalSchema,
  approvalQuerySchema,
  validate,
};