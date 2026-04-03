import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  createStartup,
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
} from './startup.controller';

const pdfFileNamePattern = /\.pdf$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && !pdfFileNamePattern.test(file.originalname)) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    if (!isPdf && !isImage) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate, authorize(UserRole.STUDENT));
router.post('/', asyncHandler(createStartup));
router.get('/mine', asyncHandler(getMyStartupsController));
router.get('/:id', asyncHandler(getStartupByIdController));
router.patch('/:id', asyncHandler(patchStartup));
router.post('/:id/request-review', asyncHandler(requestStartupReviewController));
router.post('/:id/launch', asyncHandler(launchStartupController));
router.post('/:id/upload-pitch', upload.single('file'), asyncHandler(uploadPitchController));
router.post('/:id/documents', documentUpload.single('file'), asyncHandler(uploadStartupDocumentController));
router.post('/:id/members/:memberId/promote', asyncHandler(promoteToCoFounderController));
router.post('/:id/members/:memberId/demote', asyncHandler(demoteFromCoFounderController));
router.delete('/:id/documents/:documentId', asyncHandler(removeStartupDocumentController));

export default router;
