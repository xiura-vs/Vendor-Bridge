// =============================================================================
// AppError.js
// Custom error class for operational errors (known, expected errors).
// Distinguishes between programmer errors and user-facing errors.
// Usage: throw new AppError('Vendor not found', 404)
// =============================================================================

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Marks as a known, handled error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;