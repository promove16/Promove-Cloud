"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionGuard = exports.ALLOWED_CONNECTIONS = void 0;
const roles_types_1 = require("../types/roles.types");
const ApiError_1 = require("../utils/ApiError");
exports.ALLOWED_CONNECTIONS = {
    [roles_types_1.UserRole.STUDENT]: [roles_types_1.UserRole.MENTOR, roles_types_1.UserRole.INVESTOR, roles_types_1.UserRole.RECRUITER],
    [roles_types_1.UserRole.SCHOOL]: [roles_types_1.UserRole.MENTOR, roles_types_1.UserRole.INVESTOR],
    [roles_types_1.UserRole.COLLEGE]: [
        roles_types_1.UserRole.MENTOR,
        roles_types_1.UserRole.INVESTOR,
        roles_types_1.UserRole.RECRUITER,
        roles_types_1.UserRole.STUDENT,
    ],
    [roles_types_1.UserRole.MENTOR]: [roles_types_1.UserRole.STUDENT],
    [roles_types_1.UserRole.INVESTOR]: [roles_types_1.UserRole.STUDENT, roles_types_1.UserRole.SCHOOL, roles_types_1.UserRole.COLLEGE],
    [roles_types_1.UserRole.RECRUITER]: [roles_types_1.UserRole.STUDENT, roles_types_1.UserRole.COLLEGE],
    [roles_types_1.UserRole.ADMIN]: [
        roles_types_1.UserRole.STUDENT,
        roles_types_1.UserRole.SCHOOL,
        roles_types_1.UserRole.COLLEGE,
        roles_types_1.UserRole.MENTOR,
        roles_types_1.UserRole.INVESTOR,
        roles_types_1.UserRole.RECRUITER,
        roles_types_1.UserRole.ADMIN,
    ],
};
const connectionGuard = (targetRole) => (req, _res, next) => {
    if (!req.user) {
        return next(new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }
    const allowed = exports.ALLOWED_CONNECTIONS[req.user.role] ?? [];
    if (!allowed.includes(targetRole)) {
        return next(new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${targetRole}`));
    }
    return next();
};
exports.connectionGuard = connectionGuard;
