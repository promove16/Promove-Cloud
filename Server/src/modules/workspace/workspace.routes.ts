import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  addWorkspaceChatParticipant,
  addWorkspaceCodeSubmission,
  addWorkspaceProgress,
  addWorkspaceRepoSubmission,
  addWorkspaceTask,
  createWorkspaceController,
  getWorkspace,
  getWorkspaceChat,
  inviteWorkspaceMember,
  listWorkspaces,
  patchWorkspace,
  patchWorkspaceTask,
  removeWorkspace,
  removeWorkspaceAsset,
  removeWorkspaceCodeSubmission,
  removeWorkspaceMember,
  removeWorkspaceRepoSubmission,
  removeWorkspaceTask,
  removeWorkspaceChatParticipant,
  uploadWorkspaceAsset,
} from './workspace.controller';

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF and image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate, authorize(UserRole.STUDENT));

router.get('/', asyncHandler(listWorkspaces));
router.post('/', asyncHandler(createWorkspaceController));
router.get('/:id', asyncHandler(getWorkspace));
router.patch('/:id', asyncHandler(patchWorkspace));
router.delete('/:id', asyncHandler(removeWorkspace));
router.post('/:id/progress', asyncHandler(addWorkspaceProgress));
router.post('/:id/upload', upload.single('file'), asyncHandler(uploadWorkspaceAsset));
router.delete('/:id/upload/:uploadId', asyncHandler(removeWorkspaceAsset));
router.post('/:id/repos', asyncHandler(addWorkspaceRepoSubmission));
router.delete('/:id/repos/:repoId', asyncHandler(removeWorkspaceRepoSubmission));
router.post('/:id/code', asyncHandler(addWorkspaceCodeSubmission));
router.delete('/:id/code/:codeId', asyncHandler(removeWorkspaceCodeSubmission));
router.post('/:id/tasks', asyncHandler(addWorkspaceTask));
router.patch('/:id/tasks/:taskId', asyncHandler(patchWorkspaceTask));
router.delete('/:id/tasks/:taskId', asyncHandler(removeWorkspaceTask));
router.post('/:id/invite', asyncHandler(inviteWorkspaceMember));
router.delete('/:id/members/:userId', asyncHandler(removeWorkspaceMember));
router.post('/:id/chat-participants', asyncHandler(addWorkspaceChatParticipant));
router.delete('/:id/chat-participants/:userId', asyncHandler(removeWorkspaceChatParticipant));
router.get('/:id/chat', asyncHandler(getWorkspaceChat));

export default router;
