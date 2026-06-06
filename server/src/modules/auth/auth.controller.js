const { validationResult } = require("express-validator");
const authService = require("./auth.service");
const { successResponse, errorResponse } = require("../../utils/apiResponse");

/**
 * Register Controller
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation Error", 400, errors.array());
    }

    const user = await authService.registerUser(req.body);
    return successResponse(res, user, "User registered successfully", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Login Controller
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation Error", 400, errors.array());
    }

    const { email, password } = req.body;
    const data = await authService.loginUser(email, password);
    return successResponse(res, data, "Login successful");
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot Password Controller
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Email is required", 400);
    }

    await authService.forgotPassword(email);
    return successResponse(res, null, "Password reset email sent");
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password Controller
 */
const resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, "Validation Error", 400, errors.array());
    }

    const { token } = req.params;
    const { new_password } = req.body;

    await authService.resetPassword(token, new_password);
    return successResponse(res, null, "Password reset successful");
  } catch (error) {
    next(error);
  }
};

/**
 * Get Me Controller
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is attached by the authenticate middleware
    const user = await authService.getMe(req.user.userId);
    return successResponse(
      res,
      user,
      "User profile retrieved successfully",
      200,
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe, // <-- Added here
};
