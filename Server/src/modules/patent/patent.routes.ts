import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  createPatent,
  createPatentRequest,
  createSimplePatentSupportRequest,
  deletePatentRequestDocumentController,
  getPatentRequest,
  listMyPatentRequests,
  listMyPatents,
  listShowcasedPatents,
  showcasePatent,
  uploadPatentRequestDocumentController,
} from './patent.controller';
import {
  sendMessageController,
  listMessagesController,
  markReadController,
  unreadCountController,
} from './patentConversation.controller';

const router = Router();
const pdfFileNamePattern = /\.pdf$/i;

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/');
    if (!isPdf && !isImage) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

// ── Public showcase (any authenticated user) ─────────────────────────────────
router.get('/showcased', authenticate, asyncHandler(listShowcasedPatents));

// ── Self-filing ──────────────────────────────────────────────────────────────
router.post('/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatent));
router.get('/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatents));
router.patch('/:id/showcase', authenticate, authorize(UserRole.STUDENT), asyncHandler(showcasePatent));

// ── Assisted filing ──────────────────────────────────────────────────────────
router.post('/requests/submit', authenticate, authorize(UserRole.STUDENT), asyncHandler(createPatentRequest));
router.get('/requests/mine', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMyPatentRequests));
router.get('/requests/:id', authenticate, authorize(UserRole.STUDENT), asyncHandler(getPatentRequest));
router.post('/requests/:id/documents', authenticate, authorize(UserRole.STUDENT), documentUpload.single('file'), asyncHandler(uploadPatentRequestDocumentController));
router.delete('/requests/:id/documents/:documentId', authenticate, authorize(UserRole.STUDENT), asyncHandler(deletePatentRequestDocumentController));

// ── Simple Patent Support Request ───────────────────────────────────────────
router.post('/requests', authenticate, authorize(UserRole.STUDENT), asyncHandler(createSimplePatentSupportRequest));

// ── Patent Conversation (student side) ──────────────────────────────────────
router.get('/requests/:id/messages', authenticate, authorize(UserRole.STUDENT), asyncHandler(listMessagesController));
router.post('/requests/:id/messages', authenticate, authorize(UserRole.STUDENT), asyncHandler(sendMessageController));
router.patch('/requests/:id/messages/read', authenticate, authorize(UserRole.STUDENT), asyncHandler(markReadController));
router.get('/requests/:id/messages/unread', authenticate, authorize(UserRole.STUDENT), asyncHandler(unreadCountController));

export default router;
