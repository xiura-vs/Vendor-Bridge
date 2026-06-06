const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const authValidator = require("./auth.validator");
const authenticate = require("../../middleware/authenticate"); // <-- Added middleware

// @route POST /api/auth/register
router.post(
  "/register",
  authValidator.validateRegister,
  authController.register,
);

// @route POST /api/auth/login
router.post("/login", authValidator.validateLogin, authController.login);

// @route POST /api/auth/forgot-password
router.post("/forgot-password", authController.forgotPassword);

// @route POST /api/auth/reset-password/:token
router.post(
  "/reset-password/:token",
  authValidator.validateResetPassword,
  authController.resetPassword,
);

// @route GET /api/auth/me
router.get(
  "/me",
  authenticate, // <-- Protected route
  authController.getMe,
);

module.exports = router;
