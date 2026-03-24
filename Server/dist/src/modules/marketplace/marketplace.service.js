"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceUser = exports.listMarketplaceUsers = void 0;
const connectionGuard_1 = require("../../middleware/connectionGuard");
const ApiError_1 = require("../../utils/ApiError");
const user_model_1 = require("../user/user.model");
const mapPublicUser = (user) => ({
    _id: user._id.toString(),
    displayName: user.displayName,
    ...(user.avatar ? { avatar: user.avatar } : {}),
    role: user.role,
    ...(user.domain ? { domain: user.domain } : {}),
    ...(user.bio ? { bio: user.bio } : {}),
});
const listMarketplaceUsers = async (requesterRole, role, domain, page = 1, limit = 20) => {
    if (!(connectionGuard_1.ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(role)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${role}`);
    }
    const users = await user_model_1.User.find({
        role,
        isActive: true,
        ...(domain ? { domain: new RegExp(domain, 'i') } : {}),
    })
        .select('displayName avatar role domain bio lastLogin')
        .sort({ lastLogin: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    return users.map((user) => mapPublicUser(user));
};
exports.listMarketplaceUsers = listMarketplaceUsers;
const getMarketplaceUser = async (requesterRole, userId) => {
    const user = await user_model_1.User.findById(userId)
        .select('displayName avatar role domain bio')
        .lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (!(connectionGuard_1.ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(user.role)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${user.role}`);
    }
    return mapPublicUser(user);
};
exports.getMarketplaceUser = getMarketplaceUser;
