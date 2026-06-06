// =============================================================================
// rfq.service.js
// Business logic for RFQ Management.
// All DB operations via Prisma. No Express objects here.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');
const { generateAutoNumber } = require('../../utils/autoNumber');
const { VALID_TRANSITIONS, RFQ_STATUS, RFQ_ACTIONS } = require('../../../constants/rfqConstants');

// ---------------------------------------------------------------------------
// Helper: Log Activity
// ---------------------------------------------------------------------------
/**
 * Writes an entry to activity_logs. Non-blocking — failure won't crash request.
 * @param {string|null} userId
 * @param {string} action
 * @param {string} entityType
 * @param {string} entityId
 * @param {object} metadata
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
    console.error('⚠️  Activity log failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Helper: Build role-scoped WHERE clause
// ---------------------------------------------------------------------------
/**
 * Returns a Prisma where clause scoped to the current user's role.
 * @param {object} currentUser - { userId, role, vendorId? }
 * @param {object} extraWhere - Additional where conditions to merge
 */
async function buildRoleScope(currentUser, extraWhere = {}) {
  const { userId, role } = currentUser;

  if (role === 'PROCUREMENT_OFFICER') {
    return { ...extraWhere, created_by: userId };
  }

  if (role === 'VENDOR') {
    // Find vendor record linked to this user
    const vendor = await prisma.vendor.findFirst({ where: { user_id: userId } });
    if (!vendor) throw new AppError('Vendor profile not found for this user.', 404);
    return {
      ...extraWhere,
      rfq_vendors: { some: { vendor_id: vendor.id } },
    };
  }

  // ADMIN and MANAGER see all
  return extraWhere;
}

// ---------------------------------------------------------------------------
// 1. Get All RFQs
// ---------------------------------------------------------------------------
/**
 * Returns a paginated, filtered list of RFQs scoped by user role.
 * @param {object} filters - { search, status, created_by, from_date, to_date, page, limit }
 * @param {object} currentUser - { userId, role }
 * @returns {{ data, total, page, limit, totalPages }}
 */
async function getAllRFQs(filters, currentUser) {
  const { search, status, created_by, from_date, to_date, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  const baseWhere = {
    ...(status && { status }),
    ...(created_by && { created_by }),
    ...(from_date || to_date
      ? {
          deadline: {
            ...(from_date && { gte: new Date(from_date) }),
            ...(to_date && { lte: new Date(to_date) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const where = await buildRoleScope(currentUser, baseWhere);
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.rfq.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      include: {
        creator: { select: { id: true, full_name: true } },
        _count: { select: { items: true, rfq_vendors: true } },
      },
    }),
    prisma.rfq.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

// ---------------------------------------------------------------------------
// 2. Get RFQ By ID
// ---------------------------------------------------------------------------
/**
 * Fetches a single RFQ with full details: items, invited vendors, quotation count.
 * Vendors can only view RFQs they are invited to.
 * @param {string} id - RFQ UUID
 * @param {object} currentUser
 * @returns {object} Full RFQ record
 * @throws {AppError} 404 if not found, 403 if vendor not invited
 */
async function getRFQById(id, currentUser) {
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: {
      items: true,
      rfq_vendors: {
        include: {
          vendor: { select: { id: true, name: true, category: true, status: true } },
        },
      },
      creator: { select: { id: true, full_name: true, email: true } },
      _count: { select: { quotations: true } },
    },
  });

  if (!rfq) throw new AppError('RFQ not found.', 404);

  // Vendors can only see RFQs they are invited to
  if (currentUser.role === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: currentUser.userId },
    });
    if (!vendor) throw new AppError('Vendor profile not found.', 404);

    const isInvited = rfq.rfq_vendors.some((rv) => rv.vendor_id === vendor.id);
    if (!isInvited) throw new AppError('You are not invited to this RFQ.', 403);
  }

  return rfq;
}

// ---------------------------------------------------------------------------
// 3. Create RFQ
// ---------------------------------------------------------------------------
/**
 * Creates a new RFQ with line items in a transaction, then assigns vendors.
 * Validates all vendor_ids are ACTIVE before assigning.
 * @param {object} data - { title, description, deadline, items, vendor_ids }
 * @param {string} createdBy - User UUID of creator
 * @returns {object} Full created RFQ
 * @throws {AppError} 400 if any vendor is invalid
 */
async function createRFQ(data, createdBy) {
  const { title, description, deadline, items, vendor_ids } = data;

  // Validate vendors exist and are ACTIVE
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendor_ids } },
  });

  if (vendors.length !== vendor_ids.length) {
    throw new AppError('One or more vendor IDs are invalid.', 400);
  }

  const inactiveVendors = vendors.filter((v) => v.status !== 'ACTIVE');
  if (inactiveVendors.length > 0) {
    throw new AppError(
      `These vendors are not ACTIVE: ${inactiveVendors.map((v) => v.name).join(', ')}`,
      400
    );
  }

  // Generate auto number
  const rfq_number = await generateAutoNumber('RFQ');

  // Transaction: create RFQ + items atomically
  const [rfq] = await prisma.$transaction([
    prisma.rfq.create({
      data: {
        rfq_number,
        title,
        description,
        deadline: new Date(deadline),
        status: RFQ_STATUS.DRAFT,
        created_by: createdBy,
        items: {
          create: items.map((item) => ({
            product_name: item.product_name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            specifications: item.specifications,
          })),
        },
      },
      include: { items: true },
    }),
  ]);

  // Assign vendors after RFQ is created
  await prisma.rfqVendor.createMany({
    data: vendor_ids.map((vendor_id) => ({
      rfq_id: rfq.id,
      vendor_id,
      invited_at: new Date(),
    })),
    skipDuplicates: true,
  });

  await logActivity(createdBy, RFQ_ACTIONS.CREATED, 'Rfq', rfq.id, {
    rfq_number: rfq.rfq_number,
    title: rfq.title,
    vendor_count: vendor_ids.length,
  });

  // Return full RFQ
  return getRFQById(rfq.id, { userId: createdBy, role: 'ADMIN' });
}

// ---------------------------------------------------------------------------
// 4. Update RFQ
// ---------------------------------------------------------------------------
/**
 * Updates basic RFQ fields. Only allowed on DRAFT RFQs by creator or ADMIN.
 * @param {string} id - RFQ UUID
 * @param {object} data - Fields to update
 * @param {object} currentUser
 * @returns {object} Updated RFQ
 * @throws {AppError} 400 if not DRAFT, 403 if not authorized
 */
async function updateRFQ(id, data, currentUser) {
  const rfq = await prisma.rfq.findUnique({ where: { id } });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  if (rfq.status !== RFQ_STATUS.DRAFT) {
    throw new AppError('Only DRAFT RFQs can be edited.', 400);
  }

  if (rfq.created_by !== currentUser.userId && currentUser.role !== 'ADMIN') {
    throw new AppError('You are not authorized to edit this RFQ.', 403);
  }

  const updated = await prisma.rfq.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.deadline && { deadline: new Date(data.deadline) }),
    },
  });

  await logActivity(currentUser.userId, RFQ_ACTIONS.UPDATED, 'Rfq', id, {
    updated_fields: Object.keys(data),
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 5. Add Items to RFQ
// ---------------------------------------------------------------------------
/**
 * Adds new line items to an existing DRAFT RFQ.
 * @param {string} rfqId - RFQ UUID
 * @param {object[]} items - Array of item objects
 * @param {object} currentUser
 * @returns {object} Created items
 * @throws {AppError} 400 if RFQ not DRAFT
 */
async function addItemsToRFQ(rfqId, items, currentUser) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  if (rfq.status !== RFQ_STATUS.DRAFT) {
    throw new AppError('Items can only be added to DRAFT RFQs.', 400);
  }

  await prisma.rfqItem.createMany({
    data: items.map((item) => ({
      rfq_id: rfqId,
      product_name: item.product_name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      specifications: item.specifications,
    })),
  });

  await logActivity(currentUser.userId, RFQ_ACTIONS.ITEMS_ADDED, 'Rfq', rfqId, {
    items_added: items.length,
  });

  return prisma.rfqItem.findMany({ where: { rfq_id: rfqId } });
}

// ---------------------------------------------------------------------------
// 6. Assign Vendors to RFQ
// ---------------------------------------------------------------------------
/**
 * Assigns vendors to an RFQ. Skips already-assigned vendors silently.
 * Only allowed on DRAFT or PUBLISHED RFQs.
 * @param {string} rfqId - RFQ UUID
 * @param {string[]} vendorIds - Array of vendor UUIDs
 * @param {object} currentUser
 * @returns {object} Updated rfq_vendors list
 * @throws {AppError} 400 if invalid state or inactive vendors
 */
async function assignVendorsToRFQ(rfqId, vendorIds, currentUser) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  if (![RFQ_STATUS.DRAFT, RFQ_STATUS.PUBLISHED].includes(rfq.status)) {
    throw new AppError('Vendors can only be assigned to DRAFT or PUBLISHED RFQs.', 400);
  }

  // Validate vendors
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
  });

  if (vendors.length !== vendorIds.length) {
    throw new AppError('One or more vendor IDs are invalid.', 400);
  }

  const inactive = vendors.filter((v) => v.status !== 'ACTIVE');
  if (inactive.length > 0) {
    throw new AppError(
      `These vendors are not ACTIVE: ${inactive.map((v) => v.name).join(', ')}`,
      400
    );
  }

  await prisma.rfqVendor.createMany({
    data: vendorIds.map((vendor_id) => ({
      rfq_id: rfqId,
      vendor_id,
      invited_at: new Date(),
    })),
    skipDuplicates: true,
  });

  await logActivity(currentUser.userId, RFQ_ACTIONS.VENDORS_ASSIGNED, 'Rfq', rfqId, {
    count: vendorIds.length,
  });

  return prisma.rfqVendor.findMany({
    where: { rfq_id: rfqId },
    include: { vendor: { select: { id: true, name: true, status: true } } },
  });
}

// ---------------------------------------------------------------------------
// 7. Update RFQ Status
// ---------------------------------------------------------------------------
/**
 * Updates RFQ status following strict transition rules.
 * DRAFT → PUBLISHED requires at least 1 vendor assigned.
 * @param {string} id - RFQ UUID
 * @param {string} status - Target status
 * @param {object} currentUser
 * @returns {object} Updated RFQ
 * @throws {AppError} 400 for invalid transitions or missing vendors
 */
async function updateRFQStatus(id, status, currentUser) {
  const rfq = await prisma.rfq.findUnique({
    where: { id },
    include: { _count: { select: { rfq_vendors: true } } },
  });

  if (!rfq) throw new AppError('RFQ not found.', 404);

  // Check valid transition
  const allowed = VALID_TRANSITIONS[rfq.status];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot transition RFQ from ${rfq.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      400
    );
  }

  // Publishing requires at least 1 vendor
  if (status === RFQ_STATUS.PUBLISHED && rfq._count.rfq_vendors === 0) {
    throw new AppError('Cannot publish RFQ without at least one vendor assigned.', 400);
  }

  const updated = await prisma.rfq.update({
    where: { id },
    data: { status },
  });

  // Log based on target status
  const actionMap = {
    [RFQ_STATUS.PUBLISHED]: RFQ_ACTIONS.PUBLISHED,
    [RFQ_STATUS.CLOSED]: RFQ_ACTIONS.CLOSED,
    [RFQ_STATUS.CANCELLED]: RFQ_ACTIONS.CANCELLED,
  };

  if (actionMap[status]) {
    await logActivity(currentUser.userId, actionMap[status], 'Rfq', id, {
      rfq_number: rfq.rfq_number,
    });
  }

  return updated;
}

// ---------------------------------------------------------------------------
// 8. Delete RFQ
// ---------------------------------------------------------------------------
/**
 * Permanently deletes a DRAFT RFQ and all its items/vendor assignments.
 * Only creator or ADMIN can delete.
 * @param {string} id - RFQ UUID
 * @param {object} currentUser
 * @throws {AppError} 400 if not DRAFT, 403 if unauthorized
 */
async function deleteRFQ(id, currentUser) {
  const rfq = await prisma.rfq.findUnique({ where: { id } });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  if (rfq.status !== RFQ_STATUS.DRAFT) {
    throw new AppError('Only DRAFT RFQs can be deleted.', 400);
  }

  if (rfq.created_by !== currentUser.userId && currentUser.role !== 'ADMIN') {
    throw new AppError('You are not authorized to delete this RFQ.', 403);
  }

  // Delete child records first, then RFQ
  await prisma.$transaction([
    prisma.rfqItem.deleteMany({ where: { rfq_id: id } }),
    prisma.rfqVendor.deleteMany({ where: { rfq_id: id } }),
    prisma.rfq.delete({ where: { id } }),
  ]);

  await logActivity(currentUser.userId, RFQ_ACTIONS.DELETED, 'Rfq', id, {
    rfq_number: rfq.rfq_number,
    title: rfq.title,
  });
}

// ---------------------------------------------------------------------------
// 9. Get RFQ Stats
// ---------------------------------------------------------------------------
/**
 * Returns RFQ counts grouped by status for dashboard cards.
 * Scoped by role same as getAllRFQs.
 * @param {object} currentUser
 * @returns {{ DRAFT, PUBLISHED, CLOSED, CANCELLED, total }}
 */
async function getRFQStats(currentUser) {
  const where = await buildRoleScope(currentUser, {});

  const groups = await prisma.rfq.groupBy({
    by: ['status'],
    where,
    _count: { status: true },
  });

  const stats = {
    [RFQ_STATUS.DRAFT]: 0,
    [RFQ_STATUS.PUBLISHED]: 0,
    [RFQ_STATUS.CLOSED]: 0,
    [RFQ_STATUS.CANCELLED]: 0,
    total: 0,
  };

  groups.forEach((g) => {
    stats[g.status] = g._count.status;
    stats.total += g._count.status;
  });

  return stats;
}

module.exports = {
  getAllRFQs,
  getRFQById,
  createRFQ,
  updateRFQ,
  addItemsToRFQ,
  assignVendorsToRFQ,
  updateRFQStatus,
  deleteRFQ,
  getRFQStats,
};