import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  createStartup,
  deleteStartupController,
  demoteFromCoFounderController,
  getMyStartupsController,
  getStartupByIdController,
  launchStartupController,
  patchStartup,
  promoteToCoFounderController,
  removeStartupDocumentController,
  requestStartupReviewController,
  uploadStartupDocumentController,
  uploadPitchController,
  sendPitchRequestController,
  respondToPitchRequestController,
  getPitchRequestsController,
  getStartupMentorBidsController,
  respondStartupMentorBidController,
} from './startup.controller';
import { listStartupLifecycleEventsController } from '../startupLifecycle/startupLifecycle.controller';
import {
  getFundingSnapshotController,
  recomputeFundingController,
} from './funding.controller';

const pitchDeckFileNamePattern = /\.(pdf|ppt|pptx)$/i;
const documentPdfFileNamePattern = /\.pdf$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    const isPowerPoint =
      file.mimetype === 'application/vnd.ms-powerpoint' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if ((!isPdf && !isPowerPoint) || !pitchDeckFileNamePattern.test(file.originalname)) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF, PPT, or PPTX files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' || documentPdfFileNamePattern.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    if (!isPdf && !isImage) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate);
router.post('/', authorize(UserRole.STUDENT), asyncHandler(createStartup));
router.get('/mine', authorize(UserRole.STUDENT), asyncHandler(getMyStartupsController));
router.get('/pitch-requests', authorize(UserRole.INVESTOR), asyncHandler(getPitchRequestsController));
router.get(
  '/:id/timeline',
  authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.ADMIN),
  asyncHandler(listStartupLifecycleEventsController),
);
router.get('/:id', authorize(UserRole.STUDENT, UserRole.INVESTOR), asyncHandler(getStartupByIdController));
router.patch('/:id', authorize(UserRole.STUDENT), asyncHandler(patchStartup));
router.post('/:id/request-review', authorize(UserRole.STUDENT), asyncHandler(requestStartupReviewController));
router.post('/:id/launch', authorize(UserRole.STUDENT), asyncHandler(launchStartupController));
router.post('/:id/upload-pitch', authorize(UserRole.STUDENT), upload.single('file'), asyncHandler(uploadPitchController));
router.post('/:id/documents', authorize(UserRole.STUDENT), documentUpload.single('file'), asyncHandler(uploadStartupDocumentController));
router.post('/:id/members/:memberId/promote', authorize(UserRole.STUDENT), asyncHandler(promoteToCoFounderController));
router.post('/:id/members/:memberId/demote', authorize(UserRole.STUDENT), asyncHandler(demoteFromCoFounderController));
router.delete('/:id', authorize(UserRole.STUDENT), asyncHandler(deleteStartupController));
router.delete('/:id/documents/:documentId', authorize(UserRole.STUDENT), asyncHandler(removeStartupDocumentController));

router.get(
  '/:id/funding',
  authorize(UserRole.STUDENT, UserRole.INVESTOR, UserRole.ADMIN),
  asyncHandler(getFundingSnapshotController),
);
router.post(
  '/:id/funding/recompute',
  authorize(UserRole.STUDENT, UserRole.ADMIN),
  asyncHandler(recomputeFundingController),
);

router.post('/:id/pitch-request', authorize(UserRole.STUDENT), asyncHandler(sendPitchRequestController));
router.patch('/:id/pitch-request/:requestId', authorize(UserRole.STUDENT), asyncHandler(respondToPitchRequestController));

router.get('/:id/mentor-bids', authorize(UserRole.STUDENT), asyncHandler(getStartupMentorBidsController));
router.patch('/:id/mentor-bids/:bidId', authorize(UserRole.STUDENT), asyncHandler(respondStartupMentorBidController));

export default router;
