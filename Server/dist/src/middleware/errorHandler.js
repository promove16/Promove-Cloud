"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const buildFailure = (code, message, details) => ({
    success: false,
    error: {
        code,
        message,
        ...(details ? { details } : {}),
    },
});
const errorHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError_1.ApiError) {
        return res.status(error.statusCode).json(buildFailure(error.code, error.message, error.details));
    }
    if (error instanceof zod_1.ZodError) {
        return res
            .status(400)
            .json(buildFailure('VALIDATION_ERROR', 'Validation failed', error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }))));
    }
    if (error instanceof mongoose_1.default.Error.ValidationError) {
        return res.status(400).json(buildFailure('VALIDATION_ERROR', 'Validation failed', Object.values(error.errors).map((issue) => ({
            path: issue.path,
            message: issue.message,
        }))));
    }
    if (error instanceof multer_1.default.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'File exceeds the 10MB size limit'
            : error.message;
        return res.status(400).json(buildFailure('UPLOAD_ERROR', message));
    }
    if (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000) {
        return res
            .status(409)
            .json(buildFailure('DUPLICATE_KEY', 'Email already registered'));
    }
    console.error(error);
    const message = env_1.env.NODE_ENV === 'production' ? 'Something went wrong' : 'Internal server error';
    return res.status(500).json(buildFailure('INTERNAL_SERVER_ERROR', message));
};
exports.errorHandler = errorHandler;
