// =============================================================================
// server.js
// HTTP server entry point.
// Starts the Express app and handles graceful shutdown on process signals.
// =============================================================================

const app = require('./app');
const config = require('./config/env');
const { prisma } = require('./utils/prismaClient');

const server = app.listen(config.port, () => {
  console.log('─────────────────────────────────────────────');
  console.log(`🚀 VendorBridge API running`);
  console.log(`   Environment : ${config.nodeEnv}`);
  console.log(`   Port        : ${config.port}`);
  console.log(`   Health      : http://localhost:${config.port}/health`);
  console.log('─────────────────────────────────────────────');
});

// --- Graceful Shutdown ---
async function shutdown(signal) {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Database disconnected. Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Unhandled Rejections ---
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});