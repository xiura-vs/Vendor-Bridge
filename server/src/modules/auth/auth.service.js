const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../../utils/prismaClient');
const { sendPasswordResetEmail } = require('../../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
const JWT_EXPIRES_IN = '7d';

// Helper: create error with statusCode
const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const registerUser = async (userData) => {
  const { email, password, full_name, role } = userData;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw createError('User already exists with this email.', 409);

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: { email, password_hash, full_name, role },
  });

  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const loginUser = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw createError('Invalid credentials.', 401);
  if (!user.is_active) throw createError('Account is deactivated.', 403);

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw createError('Invalid credentials.', 401);

  const token = jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const { password_hash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw createError('User not found with this email.', 404);

  const resetToken = crypto.randomBytes(32).toString('hex');
  const reset_password_expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { reset_password_token: resetToken, reset_password_expires },
  });

  await sendPasswordResetEmail(user.email, resetToken);
  return true;
};

const resetPassword = async (token, newPassword) => {
  const user = await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: { gt: new Date() },
    },
  });
  if (!user) throw createError('Invalid or expired reset token.', 400);

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(newPassword, salt);

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

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError('User not found.', 404);

  const { password_hash, reset_password_token, reset_password_expires, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

module.exports = { registerUser, loginUser, forgotPassword, resetPassword, getMe };