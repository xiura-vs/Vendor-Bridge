// =============================================================================
// requestLogger.js
// HTTP request logging via morgan.
// Uses 'dev' format locally for colorized output,
// 'combined' in production for full Apache-style logs.
// =============================================================================

const morgan = require('morgan');
const config = require('../config/env');

const requestLogger = morgan(config.nodeEnv === 'production' ? 'combined' : 'dev');

module.exports = { requestLogger };