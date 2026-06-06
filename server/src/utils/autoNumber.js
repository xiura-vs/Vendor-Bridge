// =============================================================================
// autoNumber.js
// Generates padded sequential document numbers in the format:
//   PREFIX-YYYY-NNNN  →  RFQ-2024-0001 | PO-2024-0023 | INV-2024-0007
// Uses a DB count-based approach (safe for low-concurrency ERP use cases).
// For high-concurrency, replace with a DB sequence or Redis counter.
// =============================================================================

const { prisma } = require('./prismaClient.js');

/**
 * Generates the next sequential number for a given document type.
 * @param {'RFQ' | 'PO' | 'INV'} prefix
 * @returns {Promise<string>} e.g. "RFQ-2024-0042"
 */
async function generateAutoNumber(prefix) {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;

  let count;

  if (prefix === 'RFQ') {
    count = await prisma.rfq.count({
      where: { rfq_number: { startsWith: yearPrefix } },
    });
  } else if (prefix === 'PO') {
    count = await prisma.purchaseOrder.count({
      where: { po_number: { startsWith: yearPrefix } },
    });
  } else if (prefix === 'INV') {
    count = await prisma.invoice.count({
      where: { invoice_number: { startsWith: yearPrefix } },
    });
  } else {
    throw new Error(`Unknown auto-number prefix: ${prefix}`);
  }

  const sequence = String(count + 1).padStart(4, '0');
  return `${yearPrefix}${sequence}`;
}

module.exports = { generateAutoNumber };