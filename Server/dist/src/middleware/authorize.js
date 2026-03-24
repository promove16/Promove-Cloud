"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = void 0;
const ApiError_1 = require("../utils/ApiError");
const authorize = (...roles) => (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return next(new ApiError_1.ApiError(403, 'FORBIDDEN', 'You do not have access to this resource'));
    }
    return next();
};
exports.authorize = authorize;
