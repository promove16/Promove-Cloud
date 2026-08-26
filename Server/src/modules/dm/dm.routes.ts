import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { withRateLimit, uploadLimiter } from '../../middleware/rateLimiter';
import { enforceStorageQuota } from '../../middleware/storageQuota';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { listConversations, getThread, sendMessage, getPartnerProfile, markAsRead, uploadAttachment } from './dm.controller';

const router = Router();
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const allowedFileNamePattern = /\.(jpe?g|png|gif|webp|pdf)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype) || allowedFileNamePattern.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, GIF, WebP images and PDF files are allowed'));
    }
  },
});

router.use(authenticate);

// Upload route must come before /:userId to avoid matching issues
router.post('/upload', withRateLimit(uploadLimiter), enforceStorageQuota(), upload.single('file'), asyncHandler(uploadAttachment));

router.get('/conversations', asyncHandler(listConversations));
router.get('/partner/:userId', asyncHandler(getPartnerProfile));
router.get('/:userId', asyncHandler(getThread));
router.post('/:userId', asyncHandler(sendMessage));
router.patch('/:userId/read', asyncHandler(markAsRead));

export default router;
