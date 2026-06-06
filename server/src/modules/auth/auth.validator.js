const { body } = require('express-validator');

const validateRegister = [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR', 'MANAGER']).withMessage('Invalid role'),
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

const validateResetPassword = [
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

module.exports = {
  validateRegister,
  validateLogin,
  validateResetPassword,
};
