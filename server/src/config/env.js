// =============================================================================
// env.js
// Loads and validates all environment variables at startup.
// App will crash immediately if any required variable is missing —
// this prevents silent misconfigurations in production.
// =============================================================================

require('dotenv').config();

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'BCRYPT_ROUNDS',
  'CLIENT_URL',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS),
  clientUrl: process.env.CLIENT_URL,
  mail: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || 'VendorBridge <no-reply@vendorbridge.com>',
  },
};