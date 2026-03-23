const ROLES = require('../constants/roles');
const PERMISSION_MAP = require('../constants/permissions');
const ApiError = require('../utils/ApiError');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== ROLES.SUPERADMIN)) {
      return next(ApiError.forbidden());
    }

    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const permissions = PERMISSION_MAP[req.user?.role] || [];

    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    return next(ApiError.forbidden('Insufficient permissions'));
  };
}

module.exports = {
  requireRole,
  requirePermission,
};
