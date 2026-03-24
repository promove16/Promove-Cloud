"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCurrentUser = exports.getCurrentUser = exports.toSanitizedUser = exports.updateMeSchema = void 0;
const zod_1 = require("zod");
const user_model_1 = require("./user.model");
const ApiError_1 = require("../../utils/ApiError");
exports.updateMeSchema = zod_1.z
    .object({
    displayName: zod_1.z.string().trim().min(2).max(100).optional(),
    avatar: zod_1.z.string().trim().url().optional().or(zod_1.z.literal('')),
    bio: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal('')),
    domain: zod_1.z.string().trim().max(120).optional().or(zod_1.z.literal('')),
    profileComplete: zod_1.z.boolean().optional(),
    discoverableToRecruiters: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
const toSanitizedUser = (user) => ({
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    ...(user.avatar ? { avatar: user.avatar } : {}),
    ...(user.bio ? { bio: user.bio } : {}),
    ...(user.domain ? { domain: user.domain } : {}),
    profileComplete: user.profileComplete,
    innovationScore: user.innovationScore,
    scoreBreakdown: user.scoreBreakdown,
    accessGrantedBy: user.accessGrantedBy,
    accessExpiresAt: user.accessExpiresAt,
    isActive: user.isActive,
    ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
    discoverableToRecruiters: user.discoverableToRecruiters ?? false,
    ...(user.institutionId ? { institutionId: user.institutionId.toString() } : {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
exports.toSanitizedUser = toSanitizedUser;
const getCurrentUser = async (userId) => {
    const user = await user_model_1.User.findById(userId).lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return (0, exports.toSanitizedUser)(user);
};
exports.getCurrentUser = getCurrentUser;
const updateCurrentUser = async (userId, payload) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (payload.displayName !== undefined) {
        user.displayName = payload.displayName;
    }
    if (payload.avatar !== undefined) {
        user.avatar = payload.avatar || undefined;
    }
    if (payload.bio !== undefined) {
        user.bio = payload.bio || undefined;
    }
    if (payload.domain !== undefined) {
        user.domain = payload.domain || undefined;
    }
    if (payload.profileComplete !== undefined) {
        user.profileComplete = payload.profileComplete;
    }
    if (payload.discoverableToRecruiters !== undefined) {
        user.discoverableToRecruiters = payload.discoverableToRecruiters;
    }
    await user.save();
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.updateCurrentUser = updateCurrentUser;
