const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.error('❌ ERROR:', err.message, '\n', err.stack);
  }

  // AppError (our custom operational errors)
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Plain errors thrown with a statusCode attached (auth.service style)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Zod validation errors
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

  // Prisma unique constraint
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  // Generic 500
  return res.status(500).json({
    success: false,
    message: 'Internal server error.',
    ...(isDev && { error: err.message, stack: err.stack }),
  });
}

module.exports = errorHandler;