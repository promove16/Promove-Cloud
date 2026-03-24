"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchMe = exports.getMe = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const ApiError_1 = require("../../utils/ApiError");
const user_service_1 = require("./user.service");
const getMe = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const user = await (0, user_service_1.getCurrentUser)(req.user._id);
    res.status(200).json(new ApiResponse_1.ApiResponse(user));
};
exports.getMe = getMe;
const patchMe = async (req, res) => {
    if (!req.user) {
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const payload = user_service_1.updateMeSchema.parse(req.body);
    const user = await (0, user_service_1.updateCurrentUser)(req.user._id, payload);
    res.status(200).json(new ApiResponse_1.ApiResponse(user));
};
exports.patchMe = patchMe;
