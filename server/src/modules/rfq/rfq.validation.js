// =============================================================================
// rfq.validation.js
// Zod schemas for all RFQ-related request validation.
// =============================================================================

const { z } = require("zod");

// ---------------------------------------------------------------------------
// Reusable item shape
// ---------------------------------------------------------------------------
const rfqItemSchema = z.object({
  product_name: z
    .string({ required_error: "Product name is required." })
    .min(2, "Product name must be at least 2 characters."),
  description: z.string().max(500).optional(),
  quantity: z.coerce
    .number({ required_error: "Quantity is required." })
    .positive("Quantity must be a positive number."),
  unit: z
    .string({ required_error: "Unit is required." })
    .min(1, "Unit cannot be empty."),
  specifications: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 1. Create RFQ Schema
// ---------------------------------------------------------------------------
const createRFQSchema = z.object({
  title: z
    .string({ required_error: "Title is required." })
    .min(5, "Title must be at least 5 characters.")
    .max(200, "Title must not exceed 200 characters."),

  description: z.string().max(1000).optional(),

  deadline: z
    .string({ required_error: "Deadline is required." })
    .refine((val) => new Date(val) > new Date(), {
      message: "Deadline must be a future date.",
    }),

  items: z
    .array(rfqItemSchema, { required_error: "Items are required." })
    .min(1, "At least one item is required."),

  vendor_ids: z
    .array(z.string().uuid("Each vendor_id must be a valid UUID."), {
      required_error: "vendor_ids are required.",
    })
    .min(1, "At least one vendor must be assigned."),
});

// ---------------------------------------------------------------------------
// 2. Update RFQ Schema (partial — items/vendors updated via separate endpoints)
// ---------------------------------------------------------------------------
const updateRFQSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters.")
    .max(200)
    .optional(),

  description: z.string().max(1000).optional(),

  deadline: z
    .string()
    .refine((val) => new Date(val) > new Date(), {
      message: "Deadline must be a future date.",
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// 3. Add RFQ Items Schema
// ---------------------------------------------------------------------------
const addRFQItemsSchema = z.object({
  items: z.array(rfqItemSchema).min(1, "At least one item is required."),
});

// ---------------------------------------------------------------------------
// 4. Assign Vendors Schema
// ---------------------------------------------------------------------------
const assignVendorsSchema = z.object({
  vendor_ids: z
    .array(z.string().uuid("Each vendor_id must be a valid UUID."))
    .min(1, "At least one vendor_id is required."),
});

// ---------------------------------------------------------------------------
// 5. Update RFQ Status Schema
// NOTE: PUBLISHED status requires at least 1 vendor assigned.
//       This is enforced in the service layer (vendor count check),
//       not here, since it requires a DB lookup.
// ---------------------------------------------------------------------------
const updateRFQStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"], {
    required_error: "Status is required.",
    invalid_type_error:
      "Status must be DRAFT, PUBLISHED, CLOSED, or CANCELLED.",
  }),
});

// ---------------------------------------------------------------------------
// 6. RFQ Query Schema (list filters + pagination)
// ---------------------------------------------------------------------------
const rfqQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"]).optional(),
  created_by: z.string().uuid().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
});

// ---------------------------------------------------------------------------
// Reusable validate middleware
// ---------------------------------------------------------------------------
/**
 * Validates req[target] against a Zod schema.
 * Returns 400 with structured errors on failure.
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} target
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (result.success) {
      req[target] = result.data;
      return next();
    }

    // formErrors = top level, fieldErrors = per field
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
  createRFQSchema,
  updateRFQSchema,
  addRFQItemsSchema,
  assignVendorsSchema,
  updateRFQStatusSchema,
  rfqQuerySchema,
  validate,
};
