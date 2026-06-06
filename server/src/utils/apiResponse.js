// =============================================================================
// apiResponse.js
// Standardized JSON response helpers used across all controllers.
// Keeps response shape consistent throughout the entire API.
// =============================================================================

/**
 * Send a success response
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} message
 * @param {number} statusCode
 */
function successResponse(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send an error response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 * @param {any} errors
 */
function errorResponse(res, message = 'Something went wrong', statusCode = 400, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
}

module.exports = { successResponse, errorResponse };