// =============================================================================
// mailer.js
// Nodemailer transporter singleton.
// Verifies SMTP connection on startup and exposes a sendMail helper.
// =============================================================================

const nodemailer = require('nodemailer');
const config = require('./env');

const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: {
    user: config.mail.user,
    pass: config.mail.pass,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify((error) => {
  if (error) {
    console.warn('⚠️  Mailer not connected:', error.message);
  } else {
    console.log('📧 Mailer ready');
  }
});

/**
 * Send an email
 * @param {{ to: string, subject: string, html: string }} options
 */
async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: config.mail.from,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };