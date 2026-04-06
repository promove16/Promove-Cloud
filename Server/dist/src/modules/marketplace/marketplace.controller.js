"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceProfile = exports.getMarketplaceEntityDetail = exports.getMarketplace = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const marketplace_service_1 = require("./marketplace.service");
const ApiError_1 = require("../../utils/ApiError");
const roles_types_1 = require("../../types/roles.types");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const getMarketplace = async (req, res) => {
    const role = (0, marketplace_service_1.normalizeMarketplaceEntityType)(getParam(req.query.role));
    const fallbackRole = req.user.role === roles_types_1.UserRole.RECRUITER ? roles_types_1.UserRole.STUDENT : roles_types_1.UserRole.MENTOR;
    const users = await (0, marketplace_service_1.listMarketplaceUsers)(req.user.role, role ?? fallbackRole, typeof req.query.domain === 'string' ? req.query.domain : undefined, Number(req.query.page ?? 1), Number(req.query.limit ?? 20));
    res.json(new ApiResponse_1.ApiResponse(users));
};
exports.getMarketplace = getMarketplace;
const getMarketplaceEntityDetail = async (req, res) => {
    const entityType = (0, marketplace_service_1.normalizeMarketplaceEntityType)(getParam(req.params.entityType));
    const entityId = getParam(req.params.entityId);
    if (!entityType || !entityId) {
        throw new ApiError_1.ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Marketplace entity type and id are required');
    }
    const entity = await (0, marketplace_service_1.getMarketplaceEntity)(req.user.role, entityType, entityId);
    res.json(new ApiResponse_1.ApiResponse(entity));
};
exports.getMarketplaceEntityDetail = getMarketplaceEntityDetail;
const getMarketplaceProfile = async (req, res) => {
    const userId = getParam(req.params.userId);
    if (!userId) {
        throw new Error('User id is required');
    }
    const user = await (0, marketplace_service_1.getMarketplaceUser)(req.user.role, userId);
    res.json(new ApiResponse_1.ApiResponse(user));
};
exports.getMarketplaceProfile = getMarketplaceProfile;
