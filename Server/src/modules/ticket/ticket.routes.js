const express = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ENUMS = require('../../constants/enums');
const ticketController = require('./ticket.controller');

const router = express.Router();

const createTicketRules = [
  body('title').notEmpty().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description must be at most 5000 characters'),
  body('priority').optional().isIn(ENUMS.TICKET_PRIORITY).withMessage('Invalid priority'),
  body('storyPoints').optional().isInt({ min: 1, max: 13 }).withMessage('Story points must be between 1 and 13'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be valid'),
  body('assigneeId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Assignee must be valid'),
  body('labels').optional().isArray().withMessage('Labels must be an array'),
  body('labels.*').optional().isString().isLength({ max: 30 }).withMessage('Each label must be 30 characters or fewer'),
];

const updateTicketRules = [
  body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description must be at most 5000 characters'),
  body('priority').optional().isIn(ENUMS.TICKET_PRIORITY).withMessage('Invalid priority'),
  body('storyPoints').optional().isInt({ min: 1, max: 13 }).withMessage('Story points must be between 1 and 13'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be valid'),
  body('assigneeId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Assignee must be valid'),
  body('labels').optional().isArray().withMessage('Labels must be an array'),
  body('labels.*').optional().isString().isLength({ max: 30 }).withMessage('Each label must be 30 characters or fewer'),
];

router.use(authenticate);
router.get('/board/:boardId', asyncHandler(ticketController.getTicketsByBoard));
router.post('/board/:boardId', createTicketRules, validate, asyncHandler(ticketController.createTicket));
router.get('/:id', asyncHandler(ticketController.getTicket));
router.put('/:id', updateTicketRules, validate, asyncHandler(ticketController.updateTicket));
router.delete('/:id', asyncHandler(ticketController.deleteTicket));
router.patch('/:id/status', body('status').isIn(ENUMS.TICKET_STATUS).withMessage('Invalid ticket status'), validate, asyncHandler(ticketController.updateTicketStatus));
router.patch('/:id/order', asyncHandler(ticketController.updateTicketOrder));
router.post('/:id/comments', body('body').notEmpty().isLength({ min: 1, max: 2000 }).withMessage('Comment body is required'), validate, asyncHandler(ticketController.addComment));
router.delete('/:id/comments/:commentId', asyncHandler(ticketController.removeComment));
router.post('/:id/attachments', asyncHandler(ticketController.addAttachment));
router.delete('/:id/attachments/:publicId', asyncHandler(ticketController.removeAttachment));

module.exports = router;
