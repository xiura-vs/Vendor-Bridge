// =============================================================================
// invoice.service.js
// Business logic for Invoice Management.
// =============================================================================

const { prisma } = require('../../utils/prismaClient');
const AppError = require('../../utils/AppError');
const { mailer } = require('../../config/mailer');
const PdfPrinter = require('pdfmake');

const INV_TRANSITIONS = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PAID', 'OVERDUE'],
  OVERDUE: ['PAID', 'CANCELLED'],
  PAID: [],
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
// Helper: Fetch full invoice for PDF/email
// ---------------------------------------------------------------------------
async function fetchFullInvoice(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      purchase_order: {
        include: {
          vendor: true,
          quotation: {
            include: {
              items: {
                include: {
                  rfq_item: { select: { product_name: true, unit: true } },
                },
              },
              rfq: { select: { rfq_number: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!invoice) throw new AppError('Invoice not found.', 404);
  return invoice;
}

// ---------------------------------------------------------------------------
// Helper: Build PDF document definition
// ---------------------------------------------------------------------------
function buildInvoicePDF(invoice) {
  const po = invoice.purchase_order;
  const vendor = po.vendor;
  const items = po.quotation.items;

  const fonts = {
    Roboto: {
      normal: 'node_modules/pdfmake/build/vfs_fonts.js',
      bold: 'node_modules/pdfmake/build/vfs_fonts.js',
    },
  };

  const printer = new PdfPrinter(fonts);

  const itemRows = items.map((item, i) => [
    { text: (i + 1).toString(), style: 'tableCell' },
    { text: item.rfq_item.product_name, style: 'tableCell' },
    { text: parseFloat(item.quantity.toString()).toString(), style: 'tableCell' },
    { text: item.rfq_item.unit, style: 'tableCell' },
    { text: `₹${parseFloat(item.unit_price.toString()).toFixed(2)}`, style: 'tableCell' },
    { text: `₹${parseFloat(item.total_price.toString()).toFixed(2)}`, style: 'tableCell' },
  ]);

  const docDefinition = {
    content: [
      // Header
      { text: 'VendorBridge ERP', style: 'header' },
      { text: 'INVOICE', style: 'invoiceTitle' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] },
      { text: ' ' },

      // Invoice Info
      {
        columns: [
          {
            stack: [
              { text: 'Invoice Details', style: 'sectionHeader' },
              { text: `Invoice #: ${invoice.invoice_number}` },
              { text: `PO #: ${po.po_number}` },
              { text: `Date: ${new Date(invoice.created_at).toLocaleDateString()}` },
              { text: `Due Date: ${new Date(invoice.due_date).toLocaleDateString()}` },
              { text: `Status: ${invoice.status}` },
            ],
          },
          {
            stack: [
              { text: 'Bill To', style: 'sectionHeader' },
              { text: vendor.name, bold: true },
              { text: vendor.address },
              { text: `GST: ${vendor.gst_number || 'N/A'}` },
              { text: `Email: ${vendor.contact_email}` },
              { text: `Phone: ${vendor.contact_phone}` },
            ],
          },
        ],
      },
      { text: ' ' },

      // Items Table
      { text: 'Line Items', style: 'sectionHeader' },
      {
        table: {
          headerRows: 1,
          widths: [20, '*', 50, 40, 70, 70],
          body: [
            [
              { text: '#', style: 'tableHeader' },
              { text: 'Product', style: 'tableHeader' },
              { text: 'Qty', style: 'tableHeader' },
              { text: 'Unit', style: 'tableHeader' },
              { text: 'Unit Price', style: 'tableHeader' },
              { text: 'Total', style: 'tableHeader' },
            ],
            ...itemRows,
          ],
        },
      },
      { text: ' ' },

      // Summary
      {
        columns: [
          { text: '' },
          {
            table: {
              widths: ['*', 100],
              body: [
                [{ text: 'Subtotal', bold: true }, `₹${parseFloat(invoice.subtotal.toString()).toFixed(2)}`],
                [{ text: `GST (${parseFloat(invoice.tax_rate.toString())}%)`, bold: true }, `₹${parseFloat(invoice.tax_amount.toString()).toFixed(2)}`],
                [{ text: 'Total Amount', bold: true, fontSize: 13 }, { text: `₹${parseFloat(invoice.total_amount.toString()).toFixed(2)}`, bold: true, fontSize: 13 }],
              ],
            },
          },
        ],
      },
      { text: ' ' },
      { text: ' ' },

      // Footer
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }] },
      { text: 'Generated by VendorBridge ERP', style: 'footer' },
    ],
    styles: {
      header: { fontSize: 20, bold: true, color: '#1a56db' },
      invoiceTitle: { fontSize: 16, bold: true, margin: [0, 4, 0, 4] },
      sectionHeader: { fontSize: 12, bold: true, margin: [0, 8, 0, 4], color: '#374151' },
      tableHeader: { bold: true, fillColor: '#e5e7eb', fontSize: 10 },
      tableCell: { fontSize: 10 },
      footer: { fontSize: 9, color: '#9ca3af', alignment: 'center', margin: [0, 8, 0, 0] },
    },
    defaultStyle: { fontSize: 10, lineHeight: 1.4 },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// 1. Get All Invoices
// ---------------------------------------------------------------------------
/**
 * Returns paginated invoice list.
 * @param {object} filters - { status, po_id, page, limit }
 */
async function getAllInvoices(filters) {
  const { status, po_id, page, limit } = filters;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;

  const where = {
    ...(status && { status }),
    ...(po_id && { po_id }),
  };

  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      include: {
        purchase_order: {
          select: {
            po_number: true,
            vendor: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

// ---------------------------------------------------------------------------
// 2. Get Invoice By ID
// ---------------------------------------------------------------------------
/**
 * Returns single invoice with full PO and vendor details.
 * @param {string} id - Invoice UUID
 */
async function getInvoiceById(id) {
  return fetchFullInvoice(id);
}

// ---------------------------------------------------------------------------
// 3. Update Invoice
// ---------------------------------------------------------------------------
/**
 * Updates tax_rate and/or due_date on DRAFT invoices.
 * Recalculates tax_amount and total_amount if tax_rate changes.
 * @param {string} id - Invoice UUID
 * @param {object} data - { tax_rate?, due_date? }
 * @param {object} currentUser
 */
async function updateInvoice(id, data, currentUser) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new AppError('Invoice not found.', 404);
  if (invoice.status !== 'DRAFT') {
    throw new AppError('Only DRAFT invoices can be updated.', 400);
  }

  const updateData = {};

  if (data.due_date) updateData.due_date = new Date(data.due_date);

  if (data.tax_rate !== undefined) {
    const subtotal = parseFloat(invoice.subtotal.toString());
    const tax_amount = parseFloat((subtotal * (data.tax_rate / 100)).toFixed(4));
    const total_amount = parseFloat((subtotal + tax_amount).toFixed(4));
    updateData.tax_rate = data.tax_rate;
    updateData.tax_amount = tax_amount;
    updateData.total_amount = total_amount;
  }

  const updated = await prisma.invoice.update({ where: { id }, data: updateData });

  await logActivity(currentUser.userId, 'INVOICE_UPDATED', 'Invoice', id, {
    invoice_number: invoice.invoice_number,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 4. Update Invoice Status
// ---------------------------------------------------------------------------
/**
 * Updates invoice status following INV_TRANSITIONS rules.
 * @param {string} id - Invoice UUID
 * @param {string} status - Target status
 * @param {object} currentUser
 */
async function updateInvoiceStatus(id, status, currentUser) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new AppError('Invoice not found.', 404);

  const allowed = INV_TRANSITIONS[invoice.status];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot transition invoice from ${invoice.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`,
      400
    );
  }

  const updateData = { status };
  if (status === 'PAID') updateData.paid_at = new Date();
  if (status === 'SENT') updateData.sent_at = new Date();

  const updated = await prisma.invoice.update({ where: { id }, data: updateData });

  await logActivity(currentUser.userId, `INVOICE_${status}`, 'Invoice', id, {
    invoice_number: invoice.invoice_number,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// 5. Send Invoice Email
// ---------------------------------------------------------------------------
/**
 * Generates PDF and emails invoice to vendor or override email.
 * Updates invoice status to SENT.
 * @param {string} id - Invoice UUID
 * @param {string|undefined} recipient_email - Override email
 * @param {object} currentUser
 */
async function sendInvoiceEmail(id, recipient_email, currentUser) {
  const invoice = await fetchFullInvoice(id);
  const vendor = invoice.purchase_order.vendor;

  const toEmail = recipient_email || vendor.contact_email;
  const pdfBuffer = await buildInvoicePDF(invoice);

  await mailer.sendMail({
    from: `"VendorBridge ERP" <${process.env.MAIL_FROM}>`,
    to: toEmail,
    subject: `Invoice ${invoice.invoice_number} from VendorBridge`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">VendorBridge ERP</h2>
        <p>Dear ${vendor.name},</p>
        <p>Please find attached your invoice <strong>${invoice.invoice_number}</strong>.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Invoice #</strong></td><td style="padding:8px; border:1px solid #e5e7eb;">${invoice.invoice_number}</td></tr>
          <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>PO #</strong></td><td style="padding:8px; border:1px solid #e5e7eb;">${invoice.purchase_order.po_number}</td></tr>
          <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Total Amount</strong></td><td style="padding:8px; border:1px solid #e5e7eb;">₹${parseFloat(invoice.total_amount.toString()).toFixed(2)}</td></tr>
          <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Due Date</strong></td><td style="padding:8px; border:1px solid #e5e7eb;">${new Date(invoice.due_date).toLocaleDateString()}</td></tr>
        </table>
        <p>Please process the payment before the due date.</p>
        <p style="color: #6b7280; font-size: 12px;">This is an automated email from VendorBridge ERP.</p>
      </div>
    `,
    attachments: [
      {
        filename: `${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  // Update status to SENT
  await prisma.invoice.update({
    where: { id },
    data: { status: 'SENT', sent_at: new Date() },
  });

  await logActivity(currentUser.userId, 'INVOICE_SENT', 'Invoice', id, {
    invoice_number: invoice.invoice_number,
    sent_to: toEmail,
  });

  return { message: 'Invoice sent successfully.', sent_to: toEmail };
}

// ---------------------------------------------------------------------------
// 6. Download Invoice PDF
// ---------------------------------------------------------------------------
/**
 * Streams invoice PDF to HTTP response.
 * @param {string} id - Invoice UUID
 * @param {object} res - Express response object
 */
async function downloadInvoicePDF(id, res) {
  const invoice = await fetchFullInvoice(id);
  const pdfBuffer = await buildInvoicePDF(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoice_number}.pdf"`
  );
  res.send(pdfBuffer);
}

module.exports = {
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  updateInvoiceStatus,
  sendInvoiceEmail,
  downloadInvoicePDF,
};