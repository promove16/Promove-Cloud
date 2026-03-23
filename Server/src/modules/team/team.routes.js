const express = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ENUMS = require('../../constants/enums');
const teamController = require('./team.controller');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Team name must be between 2 and 100 characters'),
  validate,
  asyncHandler(teamController.createTeam)
);
router.get('/:id', asyncHandler(teamController.getTeam));
router.put(
  '/:id/members/:uid',
  body('role').isIn(ENUMS.TEAM_MEMBER_ROLE).withMessage('Invalid team role'),
  validate,
  asyncHandler(teamController.updateMemberRole)
);
router.delete('/:id/members/:uid', asyncHandler(teamController.removeMember));
router.post(
  '/:id/invite',
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('role').isIn(ENUMS.TEAM_MEMBER_ROLE).withMessage('Invalid team role'),
  validate,
  asyncHandler(teamController.inviteByEmail)
);
router.get('/invite/:token', asyncHandler(teamController.acceptInvitation));
router.post('/invite/:token/decline', asyncHandler(teamController.declineInvitation));

module.exports = router;
