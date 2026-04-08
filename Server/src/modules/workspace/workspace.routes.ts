import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  acceptWorkspaceInvite,
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
  declineWorkspaceInvite,
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

router.use(authenticate);

const dashboardRoles = authorize(UserRole.STUDENT, UserRole.MENTOR, UserRole.INVESTOR);
const studentOnly = authorize(UserRole.STUDENT);

router.get('/', dashboardRoles, asyncHandler(listWorkspaces));
router.post('/', studentOnly, asyncHandler(createWorkspaceController));
router.get('/:id', dashboardRoles, asyncHandler(getWorkspace));
router.patch('/:id', studentOnly, asyncHandler(patchWorkspace));
router.delete('/:id', studentOnly, asyncHandler(removeWorkspace));
router.post('/:id/progress', studentOnly, asyncHandler(addWorkspaceProgress));
router.post('/:id/upload', studentOnly, upload.single('file'), asyncHandler(uploadWorkspaceAsset));
router.delete('/:id/upload/:uploadId', studentOnly, asyncHandler(removeWorkspaceAsset));
router.post('/:id/repos', studentOnly, asyncHandler(addWorkspaceRepoSubmission));
router.delete('/:id/repos/:repoId', studentOnly, asyncHandler(removeWorkspaceRepoSubmission));
router.post('/:id/code', studentOnly, asyncHandler(addWorkspaceCodeSubmission));
router.delete('/:id/code/:codeId', studentOnly, asyncHandler(removeWorkspaceCodeSubmission));
router.post('/:id/tasks', studentOnly, asyncHandler(addWorkspaceTask));
router.patch('/:id/tasks/:taskId', studentOnly, asyncHandler(patchWorkspaceTask));
router.delete('/:id/tasks/:taskId', studentOnly, asyncHandler(removeWorkspaceTask));
router.post('/:id/invite', studentOnly, asyncHandler(inviteWorkspaceMember));
router.post('/:id/invites/:requestId/accept', studentOnly, asyncHandler(acceptWorkspaceInvite));
router.post('/:id/invites/:requestId/decline', studentOnly, asyncHandler(declineWorkspaceInvite));
router.delete('/:id/members/:userId', studentOnly, asyncHandler(removeWorkspaceMember));
router.post('/:id/chat-participants', studentOnly, asyncHandler(addWorkspaceChatParticipant));
router.delete('/:id/chat-participants/:userId', studentOnly, asyncHandler(removeWorkspaceChatParticipant));
router.get('/:id/chat', dashboardRoles, asyncHandler(getWorkspaceChat));

export default router;
