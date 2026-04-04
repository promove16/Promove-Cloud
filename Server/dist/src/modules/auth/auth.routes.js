"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const authorize_1 = require("../../middleware/authorize");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const ApiError_1 = require("../../utils/ApiError");
const asyncHandler_1 = require("../../utils/asyncHandler");
const roles_types_1 = require("../../types/roles.types");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
const pdfFileNamePattern = /\.pdf$/i;
const institutionDocumentUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 12,
    },
    fileFilter: (_req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
        const isImage = file.mimetype.startsWith('image/');
        if (!isPdf && !isImage) {
            cb(new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed'));
            return;
        }
        cb(null, true);
    },
});
router.post('/register', (0, asyncHandler_1.asyncHandler)(auth_controller_1.register));
router.post('/register-request', institutionDocumentUpload.any(), (0, asyncHandler_1.asyncHandler)(auth_controller_1.registerRequest));
router.post('/login', (0, rateLimiter_1.withRateLimit)(rateLimiter_1.authLimiter), (0, asyncHandler_1.asyncHandler)(auth_controller_1.login));
router.post('/refresh', (0, asyncHandler_1.asyncHandler)(auth_controller_1.refresh));
router.post('/logout', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(auth_controller_1.logout));
router.put('/change-password', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(auth_controller_1.changePasswordController));
router.post('/submit-institution-token', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(auth_controller_1.submitInstitutionTokenAfterRegister));
exports.default = router;
