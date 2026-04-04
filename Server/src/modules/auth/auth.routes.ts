import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { authLimiter, withRateLimit } from '../../middleware/rateLimiter';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { UserRole } from '../../types/roles.types';
import {
  changePasswordController,
  login,
  logout,
  refresh,
  register,
  registerRequest,
  submitInstitutionTokenAfterRegister,
} from './auth.controller';

const router = Router();
const pdfFileNamePattern = /\.pdf$/i;
const institutionDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 12,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' || pdfFileNamePattern.test(file.originalname);
    const isImage = file.mimetype.startsWith('image/');

    if (!isPdf && !isImage) {
      cb(new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or image files are allowed'));
      return;
    }

    cb(null, true);
  },
});

router.post('/register', asyncHandler(register));
router.post('/register-request', institutionDocumentUpload.any(), asyncHandler(registerRequest));
router.post('/login', withRateLimit(authLimiter), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', authenticate, asyncHandler(logout));
router.put('/change-password', authenticate, asyncHandler(changePasswordController));
router.post(
  '/submit-institution-token',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(submitInstitutionTokenAfterRegister),
);

export default router;
