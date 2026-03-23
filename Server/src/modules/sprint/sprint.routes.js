const express = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const sprintController = require('./sprint.controller');

const router = express.Router();

const createSprintRules = [
  body('name').notEmpty().trim().isLength({ min: 2, max: 100 }).withMessage('Sprint name must be between 2 and 100 characters'),
  body('goal').optional().isLength({ max: 500 }).withMessage('Sprint goal must be at most 500 characters'),
  body('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid'),
];

const updateSprintRules = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Sprint name must be between 2 and 100 characters'),
  body('goal').optional().isLength({ max: 500 }).withMessage('Sprint goal must be at most 500 characters'),
  body('startDate').optional().isISO8601().withMessage('Start date must be valid'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid'),
];

router.use(authenticate);
router.get('/board/:boardId', asyncHandler(sprintController.getSprintsByBoard));
router.post('/board/:boardId', createSprintRules, validate, asyncHandler(sprintController.createSprint));
router.get('/:id', asyncHandler(sprintController.getSprint));
router.put('/:id', updateSprintRules, validate, asyncHandler(sprintController.updateSprint));
router.post('/:id/start', asyncHandler(sprintController.startSprint));
router.post('/:id/complete', asyncHandler(sprintController.completeSprint));
router.post('/:id/tickets', body('ticketId').isMongoId().withMessage('A valid ticket id is required'), validate, asyncHandler(sprintController.addTicketToSprint));
router.delete('/:id/tickets/:ticketId', asyncHandler(sprintController.removeTicketFromSprint));
router.get('/:id/burndown', asyncHandler(sprintController.getBurndownData));

module.exports = router;
