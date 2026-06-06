// =============================================================================
// prismaClient.js
// Singleton Prisma client instance.
// Reuses the same instance across the app to avoid connection pool exhaustion.
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const config = require('../config/env');

const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };