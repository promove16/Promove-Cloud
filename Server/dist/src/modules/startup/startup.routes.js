"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const authorize_1 = require("../../middleware/authorize");
const roles_types_1 = require("../../types/roles.types");
const asyncHandler_1 = require("../../utils/asyncHandler");
const ApiError_1 = require("../../utils/ApiError");
const startup_controller_1 = require("./startup.controller");
const pdfFileNamePattern = /\.pdf$/i;
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf' && !pdfFileNamePattern.test(file.originalname)) {
            cb(new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed'));
            return;
        }
        cb(null, true);
    },
});
const documentUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
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
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT));
router.post('/', (0, asyncHandler_1.asyncHandler)(startup_controller_1.createStartup));
router.get('/mine', (0, asyncHandler_1.asyncHandler)(startup_controller_1.getMyStartupsController));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(startup_controller_1.getStartupByIdController));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(startup_controller_1.patchStartup));
router.post('/:id/request-review', (0, asyncHandler_1.asyncHandler)(startup_controller_1.requestStartupReviewController));
router.post('/:id/launch', (0, asyncHandler_1.asyncHandler)(startup_controller_1.launchStartupController));
router.post('/:id/upload-pitch', upload.single('file'), (0, asyncHandler_1.asyncHandler)(startup_controller_1.uploadPitchController));
router.post('/:id/documents', documentUpload.single('file'), (0, asyncHandler_1.asyncHandler)(startup_controller_1.uploadStartupDocumentController));
router.post('/:id/members/:memberId/promote', (0, asyncHandler_1.asyncHandler)(startup_controller_1.promoteToCoFounderController));
router.post('/:id/members/:memberId/demote', (0, asyncHandler_1.asyncHandler)(startup_controller_1.demoteFromCoFounderController));
router.delete('/:id/documents/:documentId', (0, asyncHandler_1.asyncHandler)(startup_controller_1.removeStartupDocumentController));
exports.default = router;
