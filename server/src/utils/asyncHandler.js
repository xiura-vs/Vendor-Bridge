// =============================================================================
// asyncHandler.js
// Wraps async controller functions to eliminate repetitive try/catch blocks.
// Any thrown error is automatically forwarded to Express error handler via next().
// Usage: router.get('/', asyncHandler(myController))
// =============================================================================

/**
 * Wraps an async Express handler and catches any rejected promises.
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;