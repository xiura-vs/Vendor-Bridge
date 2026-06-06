const nodemailer = require("nodemailer");

/**
 * Email Service
 * Configures a nodemailer transporter using environment variables.
 * Defaults to Ethereal host for local testing if not specified.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send Password Reset Email
 * @param {string} to - Recipient email
 * @param {string} resetToken - The reset token
 */
const sendPasswordResetEmail = async (to, resetToken) => {
  // Uses CLIENT_URL if you build a frontend later, otherwise falls back to your local API route
  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5000/api/auth"}/reset-password/${resetToken}`;

  const mailOptions = {
    from: '"VendorBridge ERP" <no-reply@vendorbridge.com>',
    to,
    subject: "Password Reset Request",
    text:
      `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    html:
      `<p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>` +
      `<p>Please click on the following link, or paste this into your browser to complete the process:</p>` +
      `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
      `<p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log("\n-----------------------------------------");
    console.log("✉️ Email Sent Successfully!");
    console.log("Message ID: %s", info.messageId);

    // If using Ethereal, print the handy preview link
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("Preview URL: %s", previewUrl);
    }
    console.log("-----------------------------------------\n");

    return info;
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error("Failed to send reset email");
  }
};

module.exports = {
  sendPasswordResetEmail,
};
