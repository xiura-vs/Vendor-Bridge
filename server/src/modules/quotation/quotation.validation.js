// =============================================================================
// quotation.validation.js
// Zod schemas for all Quotation-related request validation.
// =============================================================================

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Reusable quotation item shape
// Each item maps to one RfqItem and provides vendor pricing
// ---------------------------------------------------------------------------
const quotationItemSchema = z.object({
  rfq_item_id: z.string().uuid('rfq_item_id must be a valid UUID.'),
  unit_price: z.coerce
    .number({ required_error: 'Unit price is required.' })
    .positive('Unit price must be positive.'),
  quantity: z.coerce
    .number({ required_error: 'Quantity is required.' })
    .positive('Quantity must be positive.'),
});

// ---------------------------------------------------------------------------
// 1. Submit Quotation Schema
// ---------------------------------------------------------------------------
const submitQuotationSchema = z.object({
  rfq_id: z.string().uuid('rfq_id must be a valid UUID.'),
  notes: z.string().max(1000).optional(),
  delivery_days: z.coerce
    .number({ required_error: 'Delivery days is required.' })
    .int()
    .positive('Delivery days must be a positive integer.'),
  validity_days: z.coerce
    .number({ required_error: 'Validity days is required.' })
    .int()
    .positive('Validity days must be a positive integer.'),
  items: z
    .array(quotationItemSchema, { required_error: 'Items are required.' })
    .min(1, 'At least one item is required.'),
});

// ---------------------------------------------------------------------------
// 2. Update/Revise Quotation Schema (all optional)
// ---------------------------------------------------------------------------
const updateQuotationSchema = z.object({
  notes: z.string().max(1000).optional(),
  delivery_days: z.coerce.number().int().positive().optional(),
  validity_days: z.coerce.number().int().positive().optional(),
  items: z.array(quotationItemSchema).min(1).optional(),
});

// ---------------------------------------------------------------------------
// 3. Query Schema
// ---------------------------------------------------------------------------
const quotationQuerySchema = z.object({
  rfq_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional(),
  status: z
    .enum(['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISED'])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ---------------------------------------------------------------------------
// Reusable validate middleware
// ---------------------------------------------------------------------------
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
  submitQuotationSchema,
  updateQuotationSchema,
  quotationQuerySchema,
  validate,
};