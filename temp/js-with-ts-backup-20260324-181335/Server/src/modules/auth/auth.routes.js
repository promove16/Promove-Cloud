const express = require('express');
const { body } = require('express-validator');
const ROLES = require('../../constants/roles');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const authController = require('./auth.controller');

const router = express.Router();

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

const validationRules = {
  register: [
    body('name')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage('Name must be between 2 and 80 characters'),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(passwordPattern)
      .withMessage('Password must have uppercase, lowercase, number and special character'),
    body('role')
      .isIn(Object.values(ROLES))
      .withMessage('Invalid role selected'),
  ],
  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  forgotPw: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
  ],
  resetPw: [
    body('token')
      .notEmpty()
      .withMessage('Token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(passwordPattern)
      .withMessage('Password must have uppercase, lowercase, number and special character'),
  ],
};

router.post('/register', validationRules.register, validate, asyncHandler(authController.register));
router.post('/login', validationRules.login, validate, asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/refresh', asyncHandler(authController.refresh));
router.get('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/forgot-password', validationRules.forgotPw, validate, asyncHandler(authController.forgotPassword));
router.post('/reset-password', validationRules.resetPw, validate, asyncHandler(authController.resetPassword));

module.exports = router;
