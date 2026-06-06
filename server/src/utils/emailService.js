const { mailer } = require('../config/mailer');

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;

  await mailer.sendMail({
    from: `"VendorBridge ERP" <${process.env.MAIL_FROM}>`,
    to: email,
    subject: 'Password Reset — VendorBridge',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px;">
        <h2 style="color: #1a56db;">VendorBridge ERP</h2>
        <p>Click below to reset your password. Expires in <strong>15 minutes</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block; padding:12px 24px; background:#1a56db;
                  color:#fff; border-radius:6px; text-decoration:none; margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#6b7280; font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendPasswordResetEmail };