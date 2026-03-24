import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { UserRole } from '../../types/roles.types';
import { asyncHandler } from '../../utils/asyncHandler';
import { claimProblemController, getProblem, getProblems } from './problem.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.STUDENT));
router.get('/', asyncHandler(getProblems));
router.get('/:id', asyncHandler(getProblem));
router.post('/:id/claim', asyncHandler(claimProblemController));

export default router;
