const { errorResponse } = require('../utils/apiResponse');

/**
 * Authorize Middleware
 * Factory function checking req.user.role against allowed roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Access denied: insufficient permissions', 403);
    }

    next();
  };
};

module.exports = authorize;
