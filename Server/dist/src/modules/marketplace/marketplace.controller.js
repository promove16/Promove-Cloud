"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceProfile = exports.getMarketplaceEntityDetail = exports.getMarketplace = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const marketplace_service_1 = require("./marketplace.service");
const roles_types_1 = require("../../types/roles.types");
const getParam = (value) => Array.isArray(value) ? value[0] : value;
const getMarketplace = async (req, res) => {
    const role = getParam(req.query.role);
    const users = await (0, marketplace_service_1.listMarketplaceUsers)(req.user.role, role ?? roles_types_1.UserRole.MENTOR, typeof req.query.domain === 'string' ? req.query.domain : undefined, Number(req.query.page ?? 1), Number(req.query.limit ?? 20));
    res.json(new ApiResponse_1.ApiResponse(users));
};
exports.getMarketplace = getMarketplace;
const getMarketplaceEntityDetail = async (req, res) => {
    const entityType = getParam(req.params.entityType);
    const entityId = getParam(req.params.entityId);
    if (!entityType || !entityId) {
        throw new Error('Marketplace entity type and id are required');
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
