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
const workspace_controller_1 = require("./workspace.controller");
const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            cb(new ApiError_1.ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF and image files are allowed'));
            return;
        }
        cb(null, true);
    },
});
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT));
router.get('/', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.listWorkspaces));
router.post('/', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.createWorkspaceController));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.getWorkspace));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.patchWorkspace));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.removeWorkspace));
router.post('/:id/progress', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.addWorkspaceProgress));
router.post('/:id/upload', upload.single('file'), (0, asyncHandler_1.asyncHandler)(workspace_controller_1.uploadWorkspaceAsset));
router.delete('/:id/upload/:uploadId', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.removeWorkspaceAsset));
router.post('/:id/tasks', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.addWorkspaceTask));
router.patch('/:id/tasks/:taskId', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.patchWorkspaceTask));
router.delete('/:id/tasks/:taskId', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.removeWorkspaceTask));
router.post('/:id/invite', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.inviteWorkspaceMember));
router.delete('/:id/members/:userId', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.removeWorkspaceMember));
router.get('/:id/chat', (0, asyncHandler_1.asyncHandler)(workspace_controller_1.getWorkspaceChat));
exports.default = router;
