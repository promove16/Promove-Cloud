"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const authorize_1 = require("../../middleware/authorize");
const roles_types_1 = require("../../types/roles.types");
const asyncHandler_1 = require("../../utils/asyncHandler");
const patent_controller_1 = require("./patent.controller");
const router = (0, express_1.Router)();
// ── Public showcase (any authenticated user) ─────────────────────────────────
router.get('/showcased', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(patent_controller_1.listShowcasedPatents));
// ── Self-filing ──────────────────────────────────────────────────────────────
router.post('/submit', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.createPatent));
router.get('/mine', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.listMyPatents));
router.patch('/:id/showcase', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.showcasePatent));
// ── Assisted filing ──────────────────────────────────────────────────────────
router.post('/requests/submit', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.createPatentRequest));
router.get('/requests/mine', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.listMyPatentRequests));
router.get('/requests/:id', authenticate_1.authenticate, (0, authorize_1.authorize)(roles_types_1.UserRole.STUDENT), (0, asyncHandler_1.asyncHandler)(patent_controller_1.getPatentRequest));
exports.default = router;
