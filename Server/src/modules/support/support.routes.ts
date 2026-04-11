import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { ApiError } from '../../utils/ApiError';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  addUserReplyController,
  adminAddInternalNoteController,
  adminAddReplyController,
  adminAnalyticsController,
  adminAssignTicketController,
  adminChangePriorityController,
  adminChangeStatusController,
  adminEscalateTicketController,
  adminApproveStartupEditUnlockController,
  adminGetTicketController,
  adminListTicketsController,
  createTicketController,
  getTicketController,
  listMyTicketsController,
  reopenTicketController,
  submitFeedbackController,
  uploadSupportAttachmentController,
} from './support.controller';

const router = Router();
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const allowedFileNamePattern = /\.(jpe?g|png|gif|webp|pdf)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype) || allowedFileNamePattern.test(file.originalname)) {
      cb(null, true);
      return;
    }

    cb(
      new ApiError(
        400,
        'INVALID_FILE_TYPE',
        'Only JPEG, PNG, GIF, WebP images and PDF files are allowed.',
      ),
    );
  },
});

router.use(authenticate);
router.post('/upload', upload.single('file'), asyncHandler(uploadSupportAttachmentController));

router.get('/admin/tickets', authorize(UserRole.ADMIN), asyncHandler(adminListTicketsController));
router.get('/admin/analytics', authorize(UserRole.ADMIN), asyncHandler(adminAnalyticsController));
router.get('/admin/tickets/:id', authorize(UserRole.ADMIN), asyncHandler(adminGetTicketController));
router.post(
  '/admin/tickets/:id/assign',
  authorize(UserRole.ADMIN),
  asyncHandler(adminAssignTicketController),
);
router.post(
  '/admin/tickets/:id/status',
  authorize(UserRole.ADMIN),
  asyncHandler(adminChangeStatusController),
);
router.post(
  '/admin/tickets/:id/priority',
  authorize(UserRole.ADMIN),
  asyncHandler(adminChangePriorityController),
);
router.post(
  '/admin/tickets/:id/internal-note',
  authorize(UserRole.ADMIN),
  asyncHandler(adminAddInternalNoteController),
);
router.post(
  '/admin/tickets/:id/reply',
  authorize(UserRole.ADMIN),
  asyncHandler(adminAddReplyController),
);
router.post(
  '/admin/tickets/:id/escalate',
  authorize(UserRole.ADMIN),
  asyncHandler(adminEscalateTicketController),
);
router.post(
  '/admin/tickets/:id/startup-edit-unlock',
  authorize(UserRole.ADMIN),
  asyncHandler(adminApproveStartupEditUnlockController),
);

router.get('/tickets', asyncHandler(listMyTicketsController));
router.post('/tickets', asyncHandler(createTicketController));
router.get('/tickets/:id', asyncHandler(getTicketController));
router.post('/tickets/:id/reply', asyncHandler(addUserReplyController));
router.post('/tickets/:id/reopen', asyncHandler(reopenTicketController));
router.post('/tickets/:id/feedback', asyncHandler(submitFeedbackController));

export default router;
