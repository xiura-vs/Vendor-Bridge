const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { requestLogger } = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

// --- Route Imports ---
const authRoutes = require('./modules/auth/auth.routes');      // ← ADD
const vendorRoutes = require('./modules/vendors/vendor.routes');
const rfqRoutes = require('./modules/rfq/rfq.routes');
const quotationRoutes = require('./modules/quotation/quotation.routes');
const approvalRoutes = require('./modules/approval/approval.routes');
const poRoutes = require('./modules/purchase-orders/po.routes');
const invoiceRoutes = require('./modules/invoices/invoice.routes');
const logRoutes = require('./modules/activity-logs/log.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();

// --- Core Middleware ---
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);                          // ← ADD FIRST
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/rfq', rfqRoutes);
app.use('/api/v1/quotations', quotationRoutes);
app.use('/api/v1/approvals', approvalRoutes);
app.use('/api/v1/purchase-orders', poRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/logs', logRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

module.exports = app;