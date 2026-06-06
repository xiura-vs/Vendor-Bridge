// =============================================================================
// log.service.js
// Read-only access to activity logs for audit trail.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');

/**
 * Returns paginated activity logs with optional filters.
 * @param {object} filters - { entity_type, action, user_id, from_date, to_date, page, limit }
 */
async function getAllLogs(filters) {
  const { entity_type, action, user_id, from_date, to_date, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Math.min(Number(limit) || 20, 100);

  const where = {
    ...(entity_type && { entity_type }),
    ...(action && { action: { contains: action, mode: 'insensitive' } }),
    ...(user_id && { user_id }),
    ...((from_date || to_date) && {
      created_at: {
        ...(from_date && { gte: new Date(from_date) }),
        ...(to_date && { lte: new Date(to_date) }),
      },
    }),
  };

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { id: true, full_name: true, email: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

module.exports = { getAllLogs };