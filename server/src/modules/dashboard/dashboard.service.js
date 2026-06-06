// =============================================================================
// dashboard.service.js
// Aggregates stats from all modules for the dashboard.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');

/**
 * Returns all dashboard stats in a single DB-efficient query set.
 * Scoped by role for PROCUREMENT_OFFICER.
 * @param {object} currentUser - { userId, role }
 */
async function getDashboardStats(currentUser) {
  const isOfficer = currentUser.role === 'PROCUREMENT_OFFICER';

  // RFQ scope for procurement officer
  const rfqWhere = isOfficer ? { created_by: currentUser.userId } : {};

  // Run all aggregation queries in parallel
  const [
    rfqGroups,
    quotationGroups,
    approvalGroups,
    poGroups,
    invoiceGroups,
    totalRevenue,
    recentRFQs,
    recentPOs,
    recentInvoices,
    pendingApprovals,
    monthlyTrend,
  ] = await Promise.all([
    // RFQ stats
    prisma.rfq.groupBy({
      by: ['status'],
      where: rfqWhere,
      _count: { status: true },
    }),

    // Quotation stats
    prisma.quotation.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Approval stats
    prisma.approval.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // PO stats
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Invoice stats
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Total revenue (PAID invoices)
    prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { total_amount: true },
    }),

    // Recent RFQs
    prisma.rfq.findMany({
      where: rfqWhere,
      take: 5,
      orderBy: { created_at: 'desc' },
      select: { id: true, rfq_number: true, title: true, status: true, created_at: true },
    }),

    // Recent POs
    prisma.purchaseOrder.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        po_number: true,
        status: true,
        issued_at: true,
        vendor: { select: { name: true } },
      },
    }),

    // Recent Invoices
    prisma.invoice.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        invoice_number: true,
        total_amount: true,
        status: true,
        created_at: true,
      },
    }),

    // Pending approvals count
    prisma.approval.count({ where: { status: 'PENDING' } }),

    // Monthly procurement trend (last 6 months)
    prisma.$queryRaw`
      SELECT
        TO_CHAR(po.created_at, 'Mon YYYY') as month,
        COUNT(po.id)::int as po_count,
        COALESCE(SUM(i.total_amount), 0)::float as total_value
      FROM purchase_orders po
      LEFT JOIN invoices i ON i.po_id = po.id
      WHERE po.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(po.created_at, 'Mon YYYY'), DATE_TRUNC('month', po.created_at)
      ORDER BY DATE_TRUNC('month', po.created_at)
    `,
  ]);

  // Build grouped stat objects
  function buildStats(groups, allStatuses) {
    const result = {};
    allStatuses.forEach((s) => (result[s] = 0));
    groups.forEach((g) => (result[g.status] = g._count.status));
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    return result;
  }

  return {
    rfq_stats: buildStats(rfqGroups, ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED']),
    quotation_stats: buildStats(quotationGroups, ['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISED']),
    approval_stats: buildStats(approvalGroups, ['PENDING', 'APPROVED', 'REJECTED']),
    po_stats: buildStats(poGroups, ['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED']),
    invoice_stats: {
      ...buildStats(invoiceGroups, ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']),
      total_revenue: parseFloat(
        (totalRevenue._sum.total_amount || 0).toString()
      ).toFixed(2),
    },
    recent_rfqs: recentRFQs,
    recent_pos: recentPOs,
    recent_invoices: recentInvoices,
    pending_approvals: pendingApprovals,
    monthly_procurement_trend: monthlyTrend,
  };
}

module.exports = { getDashboardStats };