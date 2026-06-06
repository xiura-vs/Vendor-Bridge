const { PrismaClient } = require("@prisma/client");

/**
 * Prisma Client Singleton
 * Prevents multiple instances of Prisma Client in development
 * due to hot reloading or multiple module imports.
 */

const prisma = new PrismaClient({
  log: ["warn", "error"], // Optional: logs warnings and errors to the console
});

module.exports = { prisma };
