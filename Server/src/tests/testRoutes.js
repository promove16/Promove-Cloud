const express = require('express');
const authenticate = require('../middleware/authenticate');
const { requireRole, requirePermission } = require('../middleware/authorize');
const ROLES = require('../constants/roles');

const router = express.Router();

router.get('/student-only', authenticate, requireRole(ROLES.STUDENT), (req, res) => {
  res.json({ success: true });
});

router.get('/project-create', authenticate, requirePermission('project:create'), (req, res) => {
  res.json({ success: true });
});

module.exports = router;
