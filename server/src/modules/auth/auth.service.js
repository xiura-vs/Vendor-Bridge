const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { prisma } = require("../../utils/prismaClient");
const { sendPasswordResetEmail } = require("../../utils/emailService");

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
const JWT_EXPIRES_IN = "7d";

/**
 * Register User
 */
const registerUser = async (userData) => {
  const { email, password, full_name, role } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      full_name,
      role,
    },
  });

  // Don't return password hash
  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Login User
 */
const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (!user.is_active) {
    throw new Error("Account is deactivated");
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  const { password_hash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
};

/**
 * Forgot Password
 */
const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("User not found with this email");
  }

  // Generate random token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const reset_password_expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Save to DB
  await prisma.user.update({
    where: { id: user.id },
    data: {
      reset_password_token: resetToken,
      reset_password_expires,
    },
  });

  // Send email
  await sendPasswordResetEmail(user.email, resetToken);

  return true;
};

/**
 * Reset Password
 */
const resetPassword = async (token, newPassword) => {
  const user = await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      reset_password_token: null,
      reset_password_expires: null,
    },
  });

  return true;
};

/**
 * Get current user profile
 */
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Strip sensitive data before returning
  const {
    password_hash,
    reset_password_token,
    reset_password_expires,
    ...userWithoutPassword
  } = user;
  return userWithoutPassword;
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getMe, // <-- Added here
};
