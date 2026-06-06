// =============================================================================
// prismaClient.js
// Singleton Prisma client with middleware for:
//   1. Auto-generating rfq_number, po_number, invoice_number before create
//   2. Query logging in development
// Import this throughout the app — never instantiate PrismaClient directly.
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

// ---------------------------------------------------------------------------
// Middleware: Auto-number generation
// Intercepts create operations on Rfq, PurchaseOrder, Invoice and injects
// the generated document number if not already provided.
// ---------------------------------------------------------------------------
prisma.$use(async (params, next) => {
  const year = new Date().getFullYear();
  const pad = (n) => String(n).padStart(4, '0');

  if (params.action === 'create') {
    // --- RFQ auto-number ---
    if (params.model === 'Rfq' && !params.args.data.rfq_number) {
      const count = await prisma.rfq.count({
        where: { rfq_number: { startsWith: `RFQ-${year}-` } },
      });
      params.args.data.rfq_number = `RFQ-${year}-${pad(count + 1)}`;
    }

    // --- PurchaseOrder auto-number ---
    if (params.model === 'PurchaseOrder' && !params.args.data.po_number) {
      const count = await prisma.purchaseOrder.count({
        where: { po_number: { startsWith: `PO-${year}-` } },
      });
      params.args.data.po_number = `PO-${year}-${pad(count + 1)}`;
    }

    // --- Invoice auto-number ---
    if (params.model === 'Invoice' && !params.args.data.invoice_number) {
      const count = await prisma.invoice.count({
        where: { invoice_number: { startsWith: `INV-${year}-` } },
      });
      params.args.data.invoice_number = `INV-${year}-${pad(count + 1)}`;
    }
  }

  return next(params);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = { prisma };