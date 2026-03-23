const express = require('express');
const authenticate = require('../../middleware/authenticate');
const asyncHandler = require('../../utils/asyncHandler');
const uploadController = require('./upload.controller');
const { uploadMiddleware } = require('./upload.service');

const router = express.Router();

router.post('/', authenticate, uploadMiddleware, asyncHandler(uploadController.uploadFiles));
router.delete('/:publicId', authenticate, asyncHandler(uploadController.deleteFile));

module.exports = router;
