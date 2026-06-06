// =============================================================================
// quotation.service.js
// Business logic for Quotation Management.
// All DB operations via Prisma. No Express objects here.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');

// ---------------------------------------------------------------------------
// Quotation status constants
// ---------------------------------------------------------------------------
const Q_STATUS = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  REVISED: 'REVISED',
};

// ---------------------------------------------------------------------------
// Helper: Log Activity
// ---------------------------------------------------------------------------
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
// Helper: Calculate total price for items
// ---------------------------------------------------------------------------
function calculateItemTotal(unit_price, quantity) {
  return parseFloat((unit_price * quantity).toFixed(4));
}

// ---------------------------------------------------------------------------
// 1. Submit Quotation
// ---------------------------------------------------------------------------
/**
 * Vendor submits a quotation against a PUBLISHED RFQ.
 * One quotation per vendor per RFQ — enforced by DB unique constraint.
 * All rfq_item_ids must belong to the target RFQ.
 * @param {object} data - { rfq_id, notes, delivery_days, validity_days, items }
 * @param {object} currentUser - { userId, role }
 * @returns {object} Created quotation with items
 */
async function submitQuotation(data, currentUser) {
  const { rfq_id, notes, delivery_days, validity_days, items } = data;

  // Get vendor profile linked to this user
  const vendor = await prisma.vendor.findFirst({
    where: { user_id: currentUser.userId },
  });
  if (!vendor) throw new AppError('Vendor profile not found for this user.', 404);

  // RFQ must exist and be PUBLISHED
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfq_id },
    include: { items: true, rfq_vendors: true },
  });
  if (!rfq) throw new AppError('RFQ not found.', 404);
  if (rfq.status !== 'PUBLISHED') {
    throw new AppError('Quotations can only be submitted for PUBLISHED RFQs.', 400);
  }

  // Vendor must be invited to this RFQ
  const isInvited = rfq.rfq_vendors.some((rv) => rv.vendor_id === vendor.id);
  if (!isInvited) throw new AppError('You are not invited to quote on this RFQ.', 403);

  // Check no existing quotation (other than REJECTED)
  const existing = await prisma.quotation.findUnique({
    where: { rfq_id_vendor_id: { rfq_id, vendor_id: vendor.id } },
  });
  if (existing && existing.status !== Q_STATUS.REJECTED) {
    throw new AppError('You have already submitted a quotation for this RFQ.', 409);
  }

  // Validate all rfq_item_ids belong to this RFQ
  const rfqItemIds = rfq.items.map((i) => i.id);
  const invalidItems = items.filter((i) => !rfqItemIds.includes(i.rfq_item_id));
  if (invalidItems.length > 0) {
    throw new AppError('One or more rfq_item_ids do not belong to this RFQ.', 400);
  }

  // Build quotation items with calculated totals
  const quotationItems = items.map((item) => ({
    rfq_item_id: item.rfq_item_id,
    unit_price: item.unit_price,
    quantity: item.quantity,
    total_price: calculateItemTotal(item.unit_price, item.quantity),
  }));

  // Create quotation + items in transaction
  const quotation = await prisma.$transaction(async (tx) => {
    // If revising a rejected quotation, delete old one first
    if (existing) {
      await tx.quotationItem.deleteMany({ where: { quotation_id: existing.id } });
      await tx.quotation.delete({ where: { id: existing.id } });
    }

    const created = await tx.quotation.create({
      data: {
        rfq_id,
        vendor_id: vendor.id,
        notes,
        delivery_days,
        validity_days,
        status: Q_STATUS.SUBMITTED,
        submitted_at: new Date(),
        items: { create: quotationItems },
      },
      include: {
        items: { include: { rfq_item: true } },
        vendor: { select: { id: true, name: true, category: true } },
        rfq: { select: { id: true, rfq_number: true, title: true } },
      },
    });

    // Mark vendor as responded in rfq_vendors
    await tx.rfqVendor.update({
      where: { rfq_id_vendor_id: { rfq_id, vendor_id: vendor.id } },
      data: { responded: true },
    });

    return created;
  });

  await logActivity(currentUser.userId, 'QUOTATION_SUBMITTED', 'Quotation', quotation.id, {
    rfq_id,
    rfq_number: rfq.rfq_number,
    vendor_name: vendor.name,
    item_count: items.length,
  });

  return quotation;
}

// ---------------------------------------------------------------------------
// 2. Get All Quotations
// ---------------------------------------------------------------------------
/**
 * Returns paginated quotations scoped by role.
 * Vendors only see their own. Officers/Managers/Admins see all.
 * @param {object} filters - { rfq_id, vendor_id, status, page, limit }
 * @param {object} currentUser
 */
async function getAllQuotations(filters, currentUser) {
  const { rfq_id, vendor_id, status, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  // Build base where
  let where = {
    ...(rfq_id && { rfq_id }),
    ...(status && { status }),
  };

  // Vendors only see their own quotations
  if (currentUser.role === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: currentUser.userId },
    });
    if (!vendor) throw new AppError('Vendor profile not found.', 404);
    where.vendor_id = vendor.id;
  } else {
    // Officers/Managers/Admins can filter by vendor_id
    if (vendor_id) where.vendor_id = vendor_id;
  }

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.quotation.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { submitted_at: 'desc' },
      include: {
        vendor: { select: { id: true, name: true, category: true } },
        rfq: { select: { id: true, rfq_number: true, title: true, deadline: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

// ---------------------------------------------------------------------------
// 3. Get Quotation By ID
// ---------------------------------------------------------------------------
/**
 * Returns single quotation with full item details.
 * Vendors can only view their own quotations.
 * @param {string} id - Quotation UUID
 * @param {object} currentUser
 */
async function getQuotationById(id, currentUser) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          rfq_item: {
            select: {
              id: true,
              product_name: true,
              unit: true,
              specifications: true,
            },
          },
        },
      },
      vendor: { select: { id: true, name: true, category: true, contact_email: true } },
      rfq: { select: { id: true, rfq_number: true, title: true, deadline: true } },
    },
  });

  if (!quotation) throw new AppError('Quotation not found.', 404);

  // Vendors can only view their own
  if (currentUser.role === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: currentUser.userId },
    });
    if (!vendor || quotation.vendor_id !== vendor.id) {
      throw new AppError('You are not authorized to view this quotation.', 403);
    }
  }

  return quotation;
}

// ---------------------------------------------------------------------------
// 4. Get Quotations for Comparison (by RFQ)
// ---------------------------------------------------------------------------
/**
 * Returns all SUBMITTED quotations for an RFQ side-by-side for comparison.
 * Includes computed grand total per quotation for easy sorting.
 * Only accessible by PROCUREMENT_OFFICER, MANAGER, ADMIN.
 * @param {string} rfqId - RFQ UUID
 */
async function getQuotationsForComparison(rfqId) {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    include: { items: true },
  });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  const quotations = await prisma.quotation.findMany({
    where: {
      rfq_id: rfqId,
      status: { in: [Q_STATUS.SUBMITTED, Q_STATUS.ACCEPTED, Q_STATUS.REVISED] },
    },
    include: {
      vendor: { select: { id: true, name: true, category: true, contact_email: true } },
      items: {
        include: {
          rfq_item: { select: { id: true, product_name: true, unit: true, quantity: true } },
        },
      },
    },
    orderBy: { submitted_at: 'asc' },
  });

  // Compute grand total for each quotation
  const enriched = quotations.map((q) => {
    const grand_total = q.items.reduce((sum, item) => {
      return sum + parseFloat(item.total_price.toString());
    }, 0);

    return { ...q, grand_total: parseFloat(grand_total.toFixed(4)) };
  });

  // Sort by grand_total ascending (lowest first — for UI highlighting)
  enriched.sort((a, b) => a.grand_total - b.grand_total);

  return {
    rfq: {
      id: rfq.id,
      rfq_number: rfq.rfq_number,
      title: rfq.title,
      deadline: rfq.deadline,
      items: rfq.items,
    },
    quotations: enriched,
    lowest_total: enriched.length > 0 ? enriched[0].grand_total : null,
    lowest_vendor_id: enriched.length > 0 ? enriched[0].vendor_id : null,
  };
}

// ---------------------------------------------------------------------------
// 5. Update Quotation (Revise)
// ---------------------------------------------------------------------------
/**
 * Vendor revises a SUBMITTED quotation before it is accepted/rejected.
 * Status changes to REVISED. Only the submitting vendor can revise.
 * @param {string} id - Quotation UUID
 * @param {object} data - Fields to update
 * @param {object} currentUser
 */
async function updateQuotation(id, data, currentUser) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!quotation) throw new AppError('Quotation not found.', 404);

  // Only vendor who submitted can revise
  const vendor = await prisma.vendor.findFirst({
    where: { user_id: currentUser.userId },
  });
  if (!vendor || quotation.vendor_id !== vendor.id) {
    throw new AppError('You are not authorized to revise this quotation.', 403);
  }

  // Only SUBMITTED or REVISED quotations can be updated
  if (![Q_STATUS.SUBMITTED, Q_STATUS.REVISED].includes(quotation.status)) {
    throw new AppError('Only SUBMITTED or REVISED quotations can be updated.', 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Replace items if provided
    if (data.items && data.items.length > 0) {
      await tx.quotationItem.deleteMany({ where: { quotation_id: id } });
      await tx.quotationItem.createMany({
        data: data.items.map((item) => ({
          quotation_id: id,
          rfq_item_id: item.rfq_item_id,
          unit_price: item.unit_price,
          quantity: item.quantity,
          total_price: calculateItemTotal(item.unit_price, item.quantity),
        })),
      });
    }

    return tx.quotation.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.delivery_days && { delivery_days: data.delivery_days }),
        ...(data.validity_days && { validity_days: data.validity_days }),
        status: Q_STATUS.REVISED,
      },
      include: {
        items: { include: { rfq_item: true } },
        vendor: { select: { id: true, name: true } },
      },
    });
  });

  await logActivity(currentUser.userId, 'QUOTATION_REVISED', 'Quotation', id, {
    rfq_id: quotation.rfq_id,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 6. Accept Quotation
// ---------------------------------------------------------------------------
/**
 * Procurement Officer/Manager accepts one quotation for an RFQ.
 * All other SUBMITTED quotations for the same RFQ are automatically REJECTED.
 * RFQ status moves to CLOSED.
 * @param {string} id - Quotation UUID
 * @param {object} currentUser
 */
async function acceptQuotation(id, currentUser) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { rfq: true },
  });
  if (!quotation) throw new AppError('Quotation not found.', 404);

  if (![Q_STATUS.SUBMITTED, Q_STATUS.REVISED].includes(quotation.status)) {
    throw new AppError('Only SUBMITTED or REVISED quotations can be accepted.', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Accept this quotation
    const accepted = await tx.quotation.update({
      where: { id },
      data: { status: Q_STATUS.ACCEPTED },
    });

    // Reject all other quotations for the same RFQ
    await tx.quotation.updateMany({
      where: {
        rfq_id: quotation.rfq_id,
        id: { not: id },
        status: { in: [Q_STATUS.SUBMITTED, Q_STATUS.REVISED, Q_STATUS.PENDING] },
      },
      data: { status: Q_STATUS.REJECTED },
    });

    // Close the RFQ
    await tx.rfq.update({
      where: { id: quotation.rfq_id },
      data: { status: 'CLOSED' },
    });

    return accepted;
  });

  await logActivity(currentUser.userId, 'QUOTATION_ACCEPTED', 'Quotation', id, {
    rfq_id: quotation.rfq_id,
    rfq_number: quotation.rfq.rfq_number,
    vendor_id: quotation.vendor_id,
  });

  return result;
}

// ---------------------------------------------------------------------------
// 7. Reject Quotation
// ---------------------------------------------------------------------------
/**
 * Rejects a single quotation. RFQ stays open for other quotations.
 * @param {string} id - Quotation UUID
 * @param {object} currentUser
 */
async function rejectQuotation(id, currentUser) {
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new AppError('Quotation not found.', 404);

  if (![Q_STATUS.SUBMITTED, Q_STATUS.REVISED].includes(quotation.status)) {
    throw new AppError('Only SUBMITTED or REVISED quotations can be rejected.', 400);
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: Q_STATUS.REJECTED },
  });

  await logActivity(currentUser.userId, 'QUOTATION_REJECTED', 'Quotation', id, {
    rfq_id: quotation.rfq_id,
    vendor_id: quotation.vendor_id,
  });

  return updated;
}

module.exports = {
  submitQuotation,
  getAllQuotations,
  getQuotationById,
  getQuotationsForComparison,
  updateQuotation,
  acceptQuotation,
  rejectQuotation,
};