// =============================================================================
// invoice.validation.js
// =============================================================================

const { z } = require('zod');

const updateInvoiceSchema = z.object({
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  due_date: z
    .string()
    .refine((val) => new Date(val) > new Date(), { message: 'Due date must be in the future.' })
    .optional(),
});

const sendInvoiceSchema = z.object({
  recipient_email: z.string().email('Must be a valid email address.').optional(),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['SENT', 'PAID', 'OVERDUE', 'CANCELLED'], {
    required_error: 'Status is required.',
  }),
});

const invoiceQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  po_id: z.string().uuid().optional(),
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
  updateInvoiceSchema,
  sendInvoiceSchema,
  updateInvoiceStatusSchema,
  invoiceQuerySchema,
  validate,
};