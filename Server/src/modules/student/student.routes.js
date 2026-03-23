const express = require('express');
const authenticate = require('../../middleware/authenticate');
const asyncHandler = require('../../utils/asyncHandler');
const studentController = require('./student.controller');

const router = express.Router();

router.get('/portfolio/:userId', asyncHandler(studentController.getPublicPortfolio));
router.use(authenticate);
router.get('/dashboard', asyncHandler(studentController.getDashboardStats));
router.get('/portfolio', asyncHandler(studentController.getPortfolio));

module.exports = router;
