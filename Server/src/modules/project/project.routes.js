const express = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ENUMS = require('../../constants/enums');
const projectController = require('./project.controller');

const router = express.Router();

const projectRules = [
  body('title')
    .notEmpty()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isString()
    .isLength({ max: 30 })
    .withMessage('Each tag must be 30 characters or fewer'),
  body('techStack')
    .optional()
    .isArray()
    .withMessage('Tech stack must be an array'),
  body('techStack.*')
    .optional()
    .isString()
    .isLength({ max: 30 })
    .withMessage('Each tech stack item must be 30 characters or fewer'),
];

const projectUpdateRules = [
  ...projectRules.map((rule, index) => (index === 0 ? body('title').optional().trim().isLength({ min: 3, max: 200 }) : rule)),
  body('status')
    .optional()
    .isIn(ENUMS.PROJECT_STATUS)
    .withMessage('Invalid project status'),
];

router.get('/marketplace', asyncHandler(projectController.getMarketplaceListings));
router.use(authenticate);
router.get('/', requirePermission('project:read'), asyncHandler(projectController.getProjects));
router.post('/', requirePermission('project:create'), projectRules, validate, asyncHandler(projectController.createProject));
router.get('/my', asyncHandler(projectController.getMyProjects));
router.get('/:id', requirePermission('project:read'), asyncHandler(projectController.getProject));
router.put('/:id', projectUpdateRules, validate, asyncHandler(projectController.updateProject));
router.delete('/:id', asyncHandler(projectController.deleteProject));
router.post('/:id/files', asyncHandler(projectController.addFiles));
router.delete('/:id/files/:publicId', asyncHandler(projectController.removeFile));
router.put('/:id/marketplace', asyncHandler(projectController.updateMarketplaceListing));
router.put('/:id/visibility', asyncHandler(projectController.toggleVisibility));

module.exports = router;
