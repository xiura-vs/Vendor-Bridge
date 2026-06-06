<<<<<<< HEAD
=======
// =============================================================================
// prismaClient.js
// Singleton Prisma client instance.
// Reuses the same instance across the app to avoid connection pool exhaustion.
// =============================================================================

>>>>>>> 73bf2d23b1fce59b2923124e70c07c9a4321f788
const { PrismaClient } = require('@prisma/client');
const config = require('../config/env');

<<<<<<< HEAD
const prisma = new PrismaClient();

module.exports = { prisma };
=======
const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };
>>>>>>> 73bf2d23b1fce59b2923124e70c07c9a4321f788
