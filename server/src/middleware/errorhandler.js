// =============================================================================
// errorHandler.js
// Global Express error handler — must be mounted LAST in app.js.
// Handles AppError, Prisma errors, Zod errors, and generic 500s.
// Never leaks stack traces in production.
// =============================================================================

const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

/**
 * Global error handling middleware.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Log all errors in development
  if (isDev) {
    console.error('❌ ERROR:', err);
  }

  // --- Operational / Known Errors (AppError) ---
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // --- Zod Validation Errors ---
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // --- Prisma: Unique Constraint Violation ---
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // --- Prisma: Record Not Found ---
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found.',
    });
  }

  // --- JWT Errors ---
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired. Please log in again.',
    });
  }

  // --- Generic / Unhandled Errors ---
  return res.status(500).json({
    success: false,
    message: 'Internal server error.',
    ...(isDev && { error: err.message, stack: err.stack }),
  });
}

module.exports = errorHandler;