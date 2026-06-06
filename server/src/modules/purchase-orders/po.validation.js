// =============================================================================
// po.validation.js
// =============================================================================

const { z } = require('zod');

const updatePOSchema = z.object({
  terms: z.string().max(2000).optional(),
});

const updatePOStatusSchema = z.object({
  status: z.enum(['ISSUED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'], {
    required_error: 'Status is required.',
  }),
});

const poQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED']).optional(),
  vendor_id: z.string().uuid().optional(),
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

module.exports = { updatePOSchema, updatePOStatusSchema, poQuerySchema, validate };