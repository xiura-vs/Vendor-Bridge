// =============================================================================
// vendor.validation.js
// Zod schemas for all vendor-related request validation.
// Includes a reusable validate() middleware factory.
// =============================================================================

const { z } = require('zod');

// --- Constants ---
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/; // Indian mobile numbers

// ---------------------------------------------------------------------------
// 1. Create Vendor Schema
// ---------------------------------------------------------------------------
const createVendorSchema = z.object({
  name: z
    .string({ required_error: 'Vendor name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.'),

  category: z
    .string({ required_error: 'Category is required.' })
    .min(1, 'Category cannot be empty.'),

  gst_number: z
    .string({ required_error: 'GST number is required.' })
    .regex(GST_REGEX, 'Invalid GST number format. Expected: 22AAAAA0000A1Z5'),

  pan_number: z
    .string({ required_error: 'PAN number is required.' })
    .regex(PAN_REGEX, 'Invalid PAN format. Expected: ABCDE1234F'),

  contact_email: z
    .string({ required_error: 'Contact email is required.' })
    .email('Invalid email address.'),

  contact_phone: z
    .string({ required_error: 'Contact phone is required.' })
    .regex(PHONE_REGEX, 'Invalid Indian mobile number. Must be 10 digits starting with 6-9.'),

  address: z
    .string({ required_error: 'Address is required.' })
    .min(10, 'Address must be at least 10 characters.'),

  user_id: z
    .string()
    .uuid('user_id must be a valid UUID.')
    .optional(),
});

// ---------------------------------------------------------------------------
// 2. Update Vendor Schema (all fields optional)
// ---------------------------------------------------------------------------
const updateVendorSchema = createVendorSchema.partial();

// ---------------------------------------------------------------------------
// 3. Update Vendor Status Schema
// ---------------------------------------------------------------------------
const updateVendorStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED'], {
    required_error: 'Status is required.',
    invalid_type_error: 'Status must be ACTIVE, INACTIVE, or BLACKLISTED.',
  }),
});

// ---------------------------------------------------------------------------
// 4. Vendor Query Schema (for list filtering & pagination)
// ---------------------------------------------------------------------------
const vendorQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ---------------------------------------------------------------------------
// Reusable Validate Middleware Factory
// ---------------------------------------------------------------------------
/**
 * Returns an Express middleware that validates req[target] against a Zod schema.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} target - Part of request to validate
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // Replace req[target] with parsed & coerced data (e.g. page becomes number)
    req[target] = result.data;
    next();
  };
}

module.exports = {
  createVendorSchema,
  updateVendorSchema,
  updateVendorStatusSchema,
  vendorQuerySchema,
  validate,
};