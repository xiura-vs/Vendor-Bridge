// =============================================================================
// approval.service.js
// Business logic for Approval Workflow.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');
const { generateAutoNumber } = require('../../utils/autoNumber');

const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
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
// 1. Get All Approvals
// ---------------------------------------------------------------------------
/**
 * Returns paginated approvals scoped by role.
 * PROCUREMENT_OFFICER sees only approvals for RFQs they created.
 * MANAGER/ADMIN see all.
 * @param {object} filters - { status, rfq_id, page, limit }
 * @param {object} currentUser - { userId, role }
 */
async function getAllApprovals(filters, currentUser) {
  const { status, rfq_id, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  let where = {
    ...(status && { status }),
    ...(rfq_id && { rfq_id }),
  };

  // Procurement officers only see approvals for their own RFQs
  if (currentUser.role === 'PROCUREMENT_OFFICER') {
    where = {
      ...where,
      rfq: { created_by: currentUser.userId },
    };
  }

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.approval.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { requested_at: 'desc' },
      include: {
        rfq: { select: { id: true, rfq_number: true, title: true } },
        quotation: {
          select: {
            id: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        requester: { select: { id: true, full_name: true } },
        approver: { select: { id: true, full_name: true } },
      },
    }),
    prisma.approval.count({ where }),
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
// 2. Get Approval By ID
// ---------------------------------------------------------------------------
/**
 * Returns single approval with full details.
 * @param {string} id - Approval UUID
 */
async function getApprovalById(id) {
  const approval = await prisma.approval.findUnique({
    where: { id },
    include: {
      rfq: { select: { id: true, rfq_number: true, title: true, status: true } },
      quotation: {
        include: {
          items: { include: { rfq_item: true } },
          vendor: { select: { id: true, name: true, contact_email: true } },
        },
      },
      requester: { select: { id: true, full_name: true, email: true } },
      approver: { select: { id: true, full_name: true, email: true } },
    },
  });

  if (!approval) throw new AppError('Approval not found.', 404);
  return approval;
}

// ---------------------------------------------------------------------------
// 3. Request Approval
// ---------------------------------------------------------------------------
/**
 * Creates a new approval request for an RFQ or specific quotation.
 * Only one PENDING approval allowed per RFQ at a time.
 * @param {object} data - { rfq_id, quotation_id?, remarks? }
 * @param {object} currentUser
 */
async function requestApproval(data, currentUser) {
  const { rfq_id, quotation_id, remarks } = data;

  // Validate RFQ exists
  const rfq = await prisma.rfq.findUnique({ where: { id: rfq_id } });
  if (!rfq) throw new AppError('RFQ not found.', 404);

  // Validate quotation if provided
  if (quotation_id) {
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotation_id },
    });
    if (!quotation) throw new AppError('Quotation not found.', 404);
    if (quotation.rfq_id !== rfq_id) {
      throw new AppError('Quotation does not belong to this RFQ.', 400);
    }
    if (!['SUBMITTED', 'REVISED'].includes(quotation.status)) {
      throw new AppError('Only SUBMITTED or REVISED quotations can be sent for approval.', 400);
    }
  }

  // Check no existing PENDING approval for this RFQ
  const existingPending = await prisma.approval.findFirst({
    where: { rfq_id, status: APPROVAL_STATUS.PENDING },
  });
  if (existingPending) {
    throw new AppError('A pending approval already exists for this RFQ.', 409);
  }

  const approval = await prisma.approval.create({
    data: {
      rfq_id,
      quotation_id: quotation_id || null,
      requested_by: currentUser.userId,
      status: APPROVAL_STATUS.PENDING,
      remarks: remarks || null,
    },
    include: {
      rfq: { select: { id: true, rfq_number: true, title: true } },
      requester: { select: { id: true, full_name: true } },
    },
  });

  await logActivity(currentUser.userId, 'APPROVAL_REQUESTED', 'Approval', approval.id, {
    rfq_id,
    rfq_number: rfq.rfq_number,
    quotation_id: quotation_id || null,
  });

  return approval;
}

// ---------------------------------------------------------------------------
// 4. Resolve Approval (Approve or Reject)
// ---------------------------------------------------------------------------
/**
 * Manager/Admin resolves a pending approval.
 * On APPROVED: accepts quotation, rejects others, closes RFQ, creates PO.
 * On REJECTED: remarks required, RFQ stays open.
 * @param {string} id - Approval UUID
 * @param {string} status - 'APPROVED' | 'REJECTED'
 * @param {string} remarks
 * @param {object} currentUser
 */
async function resolveApproval(id, status, remarks, currentUser) {
  const approval = await prisma.approval.findUnique({
    where: { id },
    include: {
      quotation: { include: { vendor: true } },
      rfq: true,
    },
  });

  if (!approval) throw new AppError('Approval not found.', 404);
  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw new AppError('Only PENDING approvals can be resolved.', 400);
  }
  if (status === 'REJECTED' && (!remarks || remarks.trim().length === 0)) {
    throw new AppError('Remarks are required when rejecting an approval.', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update the approval record
    const updatedApproval = await tx.approval.update({
      where: { id },
      data: {
        status,
        remarks: remarks || null,
        approved_by: currentUser.userId,
        resolved_at: new Date(),
      },
    });

    if (status === APPROVAL_STATUS.APPROVED && approval.quotation_id) {
      // Accept the selected quotation
      await tx.quotation.update({
        where: { id: approval.quotation_id },
        data: { status: 'ACCEPTED' },
      });

      // Reject all other quotations for this RFQ
      await tx.quotation.updateMany({
        where: {
          rfq_id: approval.rfq_id,
          id: { not: approval.quotation_id },
          status: { in: ['SUBMITTED', 'REVISED', 'PENDING'] },
        },
        data: { status: 'REJECTED' },
      });

      // Close the RFQ
      await tx.rfq.update({
        where: { id: approval.rfq_id },
        data: { status: 'CLOSED' },
      });

      // Auto-create Purchase Order
      const po_number = await generateAutoNumber('PO');
      await tx.purchaseOrder.create({
        data: {
          po_number,
          quotation_id: approval.quotation_id,
          approved_by: currentUser.userId,
          vendor_id: approval.quotation.vendor_id,
          status: 'DRAFT',
        },
      });
    }

    return updatedApproval;
  });

  await logActivity(
    currentUser.userId,
    status === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
    'Approval',
    id,
    {
      rfq_id: approval.rfq_id,
      rfq_number: approval.rfq.rfq_number,
      quotation_id: approval.quotation_id,
      remarks,
    }
  );

  return result;
}

module.exports = {
  getAllApprovals,
  getApprovalById,
  requestApproval,
  resolveApproval,
};