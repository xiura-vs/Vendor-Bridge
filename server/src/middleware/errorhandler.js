// =============================================================================
// errorHandler.js
// Global Express error handler — must be mounted LAST in app.js.
// Handles Prisma errors, JWT errors, validation errors, and generic errors.
// Never leaks stack traces in production.
// =============================================================================

const config = require('../config/env');

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);

  // --- Prisma Errors ---
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      field: err.meta?.target,
    });
  }

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

  // --- Express Validator Errors (passed as array) ---
  if (Array.isArray(err)) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: err,
    });
  }

  // --- Custom App Errors (thrown with statusCode) ---
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // --- Generic / Unhandled Errors ---
  return res.status(500).json({
    success: false,
    message: 'Internal server error.',
    ...(config.nodeEnv === 'development' && {
      error: err.message,
      stack: err.stack,
    }),
  });
}

module.exports = { errorHandler };