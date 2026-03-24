"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const authenticate = (req, _res, next) => {
    const authorization = req.header('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
        return next(new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }
    const token = authorization.replace('Bearer ', '').trim();
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET, {
            algorithms: ['RS256'],
        });
        req.user = {
            _id: decoded._id,
            email: decoded.email,
            role: decoded.role,
        };
        return next();
    }
    catch (_error) {
        return next(new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }
};
exports.authenticate = authenticate;
