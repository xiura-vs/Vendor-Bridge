// =============================================================================
// po.service.js
// Business logic for Purchase Order Management.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');
const { generateAutoNumber } = require('../../utils/autoNumber');

const PO_TRANSITIONS = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

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
// 1. Get All POs
// ---------------------------------------------------------------------------
/**
 * Returns paginated purchase orders scoped by role.
 * VENDOR sees only their own POs.
 * @param {object} filters - { status, vendor_id, page, limit }
 * @param {object} currentUser
 */
async function getAllPOs(filters, currentUser) {
  const { status, vendor_id, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  let where = {
    ...(status && { status }),
  };

  if (currentUser.role === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: currentUser.userId },
    });
    if (!vendor) throw new AppError('Vendor profile not found.', 404);
    where.vendor_id = vendor.id;
  } else {
    if (vendor_id) where.vendor_id = vendor_id;
  }

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        quotation: {
          select: {
            id: true,
            rfq: { select: { id: true, rfq_number: true } },
          },
        },
        approver: { select: { id: true, full_name: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

// ---------------------------------------------------------------------------
// 2. Get PO By ID
// ---------------------------------------------------------------------------
/**
 * Returns single PO with full details including invoice if exists.
 * VENDOR: verifies ownership.
 * @param {string} id - PO UUID
 * @param {object} currentUser
 */
async function getPOById(id, currentUser) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      quotation: {
        include: {
          items: { include: { rfq_item: true } },
          rfq: { select: { id: true, rfq_number: true, title: true } },
        },
      },
      approver: { select: { id: true, full_name: true, email: true } },
      invoice: true,
    },
  });

  if (!po) throw new AppError('Purchase Order not found.', 404);

  if (currentUser.role === 'VENDOR') {
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: currentUser.userId },
    });
    if (!vendor || po.vendor_id !== vendor.id) {
      throw new AppError('You are not authorized to view this Purchase Order.', 403);
    }
  }

  return po;
}

// ---------------------------------------------------------------------------
// 3. Update PO (terms only, DRAFT only)
// ---------------------------------------------------------------------------
/**
 * Updates terms field of a DRAFT purchase order.
 * @param {string} id - PO UUID
 * @param {object} data - { terms }
 * @param {object} currentUser
 */
async function updatePO(id, data, currentUser) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new AppError('Purchase Order not found.', 404);
  if (po.status !== 'DRAFT') {
    throw new AppError('Only DRAFT Purchase Orders can be updated.', 400);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { terms: data.terms },
  });

  await logActivity(currentUser.userId, 'PO_UPDATED', 'PurchaseOrder', id, {
    po_number: po.po_number,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 4. Update PO Status
// ---------------------------------------------------------------------------
/**
 * Updates PO status following strict transition rules.
 * On ISSUED: sets issued_at and auto-creates a DRAFT invoice.
 * VENDOR can only set ACKNOWLEDGED.
 * @param {string} id - PO UUID
 * @param {string} status - Target status
 * @param {object} currentUser
 */
async function updatePOStatus(id, status, currentUser) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      quotation: { include: { items: true } },
    },
  });

  if (!po) throw new AppError('Purchase Order not found.', 404);

  // Enforce role restriction for VENDOR
  if (currentUser.role === 'VENDOR' && status !== 'ACKNOWLEDGED') {
    throw new AppError('Vendors can only acknowledge Purchase Orders.', 403);
  }
  if (currentUser.role === 'VENDOR' && po.status !== 'ISSUED') {
    throw new AppError('You can only acknowledge an ISSUED Purchase Order.', 400);
  }

  // Enforce transition rules
  const allowed = PO_TRANSITIONS[po.status];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot transition PO from ${po.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      400
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData = { status };
    if (status === 'ISSUED') updateData.issued_at = new Date();

    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: updateData,
    });

    // Auto-create invoice when PO is ISSUED
    if (status === 'ISSUED') {
      // Calculate subtotal from quotation items
      const subtotal = po.quotation.items.reduce((sum, item) => {
        return sum + parseFloat(item.total_price.toString());
      }, 0);

      const tax_rate = 18.0; // GST default
      const tax_amount = parseFloat((subtotal * (tax_rate / 100)).toFixed(4));
      const total_amount = parseFloat((subtotal + tax_amount).toFixed(4));
      const invoice_number = await generateAutoNumber('INV');

      // due_date: 30 days from now
      const due_date = new Date();
      due_date.setDate(due_date.getDate() + 30);

      await tx.invoice.create({
        data: {
          invoice_number,
          po_id: id,
          tax_rate,
          tax_amount,
          subtotal,
          total_amount,
          due_date,
          status: 'DRAFT',
        },
      });
    }

    return updated;
  });

  const actionMap = {
    ISSUED: 'PO_ISSUED',
    ACKNOWLEDGED: 'PO_ACKNOWLEDGED',
    COMPLETED: 'PO_COMPLETED',
    CANCELLED: 'PO_CANCELLED',
  };

  await logActivity(currentUser.userId, actionMap[status], 'PurchaseOrder', id, {
    po_number: po.po_number,
    status,
  });

  return result;
}

module.exports = { getAllPOs, getPOById, updatePO, updatePOStatus };