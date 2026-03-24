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
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            cb(new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed'));
            return;
        }
        cb(null, true);
    },
});
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT));
router.post('/', (0, asyncHandler_1.asyncHandler)(startup_controller_1.createStartup));
router.get('/mine', (0, asyncHandler_1.asyncHandler)(startup_controller_1.getMyStartupController));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(startup_controller_1.patchStartup));
router.post('/:id/launch', (0, asyncHandler_1.asyncHandler)(startup_controller_1.launchStartupController));
router.post('/:id/upload-pitch', upload.single('file'), (0, asyncHandler_1.asyncHandler)(startup_controller_1.uploadPitchController));
exports.default = router;
