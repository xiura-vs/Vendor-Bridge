// =============================================================================
// vendor.service.js
// Business logic layer for Vendor Management.
// All database operations via Prisma. No Express objects here.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');

// ---------------------------------------------------------------------------
// Helper: Log Activity
// ---------------------------------------------------------------------------
/**
 * Writes an entry to the activity_logs table.
 * @param {string|null} userId - ID of user performing the action
 * @param {string} action - Action identifier e.g. 'VENDOR_CREATED'
 * @param {string} entityType - Model name e.g. 'Vendor'
 * @param {string} entityId - UUID of the affected record
 * @param {object} metadata - Additional context stored as JSON
 */
async function logActivity(userId, action, entityType, entityId, metadata = {}) {
  try {
    await prisma.activityLog.create({
      data: {
        user_id: userId || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      },
    });
  } catch (err) {
    // Non-blocking — log failure should not crash the main operation
    console.error('⚠️  Activity log failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// 1. Get All Vendors (with filters + pagination)
// ---------------------------------------------------------------------------
/**
 * Retrieves a paginated, filtered list of vendors.
 * @param {{ search?: string, category?: string, status?: string, page: number, limit: number }} filters
 * @returns {{ data: object[], total: number, page: number, limit: number, totalPages: number }}
 */
async function getAllVendors({ search, category, status, page, limit }) {
  // Add these two lines to ensure they are always numbers
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  const where = {
    ...(status && { status }),
    ...(category && {
      category: { contains: category, mode: 'insensitive' },
    }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { contact_email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      skip,                // ← now always a number
      take: limitNum,      // ← now always a number
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, full_name: true, email: true },
        },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return {
    data,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

// ---------------------------------------------------------------------------
// 2. Get Single Vendor by ID
// ---------------------------------------------------------------------------
/**
 * Fetches a single vendor by UUID, including its linked user info.
 * @param {string} id - Vendor UUID
 * @returns {object} Vendor record
 * @throws {AppError} 404 if not found
 */
async function getVendorById(id) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, full_name: true, email: true },
      },
    },
  });

  if (!vendor) {
    throw new AppError('Vendor not found.', 404);
  }

  return vendor;
}

// ---------------------------------------------------------------------------
// 3. Create Vendor
// ---------------------------------------------------------------------------
/**
 * Creates a new vendor after checking for duplicate GST and email.
 * Logs 'VENDOR_CREATED' to activity_logs.
 * @param {object} data - Vendor fields
 * @param {string} requestingUserId - ID of user creating the vendor
 * @returns {object} Newly created vendor
 * @throws {AppError} 409 if GST or email already exists
 */
async function createVendor(data, requestingUserId) {
  // Check GST uniqueness
  if (data.gst_number) {
    const existingGst = await prisma.vendor.findUnique({
      where: { gst_number: data.gst_number },
    });
    if (existingGst) {
      throw new AppError('A vendor with this GST number already exists.', 409);
    }
  }

  // Check email uniqueness
  const existingEmail = await prisma.vendor.findFirst({
    where: { contact_email: data.contact_email },
  });
  if (existingEmail) {
    throw new AppError('A vendor with this contact email already exists.', 409);
  }

  const vendor = await prisma.vendor.create({ data });

  await logActivity(requestingUserId, 'VENDOR_CREATED', 'Vendor', vendor.id, {
    name: vendor.name,
    gst_number: vendor.gst_number,
  });

  return vendor;
}

// ---------------------------------------------------------------------------
// 4. Update Vendor
// ---------------------------------------------------------------------------
/**
 * Updates allowed vendor fields. Validates GST uniqueness if being changed.
 * Logs 'VENDOR_UPDATED' to activity_logs.
 * @param {string} id - Vendor UUID
 * @param {object} data - Fields to update
 * @param {string} requestingUserId - ID of user performing the update
 * @returns {object} Updated vendor
 * @throws {AppError} 404 if not found, 409 if GST conflict
 */
async function updateVendor(id, data, requestingUserId) {
  // Confirm vendor exists
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Vendor not found.', 404);
  }

  // Check GST uniqueness excluding self
  if (data.gst_number && data.gst_number !== existing.gst_number) {
    const gstConflict = await prisma.vendor.findFirst({
      where: {
        gst_number: data.gst_number,
        NOT: { id },
      },
    });
    if (gstConflict) {
      throw new AppError('Another vendor with this GST number already exists.', 409);
    }
  }

  const vendor = await prisma.vendor.update({
    where: { id },
    data,
  });

  await logActivity(requestingUserId, 'VENDOR_UPDATED', 'Vendor', vendor.id, {
    updated_fields: Object.keys(data),
  });

  return vendor;
}

// ---------------------------------------------------------------------------
// 5. Update Vendor Status
// ---------------------------------------------------------------------------
/**
 * Updates only the status field of a vendor.
 * Logs 'VENDOR_STATUS_CHANGED' with before/after values.
 * @param {string} id - Vendor UUID
 * @param {string} status - New VendorStatus enum value
 * @param {string} changedBy - User ID performing the change
 * @returns {object} Updated vendor
 * @throws {AppError} 404 if vendor not found
 */
async function updateVendorStatus(id, status, changedBy) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Vendor not found.', 404);
  }

  const vendor = await prisma.vendor.update({
    where: { id },
    data: { status },
  });

  await logActivity(changedBy, 'VENDOR_STATUS_CHANGED', 'Vendor', vendor.id, {
    from: existing.status,
    to: status,
  });

  return vendor;
}

// ---------------------------------------------------------------------------
// 6. Delete Vendor (Soft — sets status to INACTIVE)
// ---------------------------------------------------------------------------
/**
 * Soft-deletes a vendor by setting its status to INACTIVE.
 * Logs 'VENDOR_DEACTIVATED' to activity_logs.
 * @param {string} id - Vendor UUID
 * @param {string} requestingUserId - User performing the action
 * @throws {AppError} 404 if vendor not found
 */
async function deleteVendor(id, requestingUserId) {
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Vendor not found.', 404);
  }

  await prisma.vendor.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  await logActivity(requestingUserId, 'VENDOR_DEACTIVATED', 'Vendor', id, {
    name: existing.name,
  });
}

module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
};