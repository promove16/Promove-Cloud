const express = require('express');
const authenticate = require('../../middleware/authenticate');
const asyncHandler = require('../../utils/asyncHandler');
const boardController = require('./board.controller');

const router = express.Router();

router.use(authenticate);
router.get('/project/:projectId', asyncHandler(boardController.getBoardByProject));
router.put('/:id/columns', asyncHandler(boardController.updateColumns));

module.exports = router;
