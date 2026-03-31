"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatentRequest = exports.listMyPatentRequests = exports.createPatentRequest = exports.listShowcasedPatents = exports.showcasePatent = exports.listMyPatents = exports.createPatent = void 0;
const ApiError_1 = require("../../utils/ApiError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const patent_service_1 = require("./patent.service");
const patentRequest_service_1 = require("./patentRequest.service");
// ─── Self-filing ──────────────────────────────────────────────────────────────
const createPatent = async (req, res) => {
    const patent = await (0, patent_service_1.submitPatent)(req.user._id, patent_service_1.patentSubmissionSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(patent));
};
exports.createPatent = createPatent;
const listMyPatents = async (req, res) => {
    const patents = await (0, patent_service_1.getMyPatents)(req.user._id);
    res.json(new ApiResponse_1.ApiResponse(patents));
};
exports.listMyPatents = listMyPatents;
const showcasePatent = async (req, res) => {
    if (!req.user)
        throw new ApiError_1.ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    const result = await (0, patent_service_1.togglePatentShowcase)(req.user._id, String(req.params.id));
    res.json(new ApiResponse_1.ApiResponse(result));
};
exports.showcasePatent = showcasePatent;
const listShowcasedPatents = async (_req, res) => {
    res.json(new ApiResponse_1.ApiResponse(await (0, patent_service_1.getShowcasedPatents)()));
};
exports.listShowcasedPatents = listShowcasedPatents;
// ─── Assisted filing ──────────────────────────────────────────────────────────
const createPatentRequest = async (req, res) => {
    const request = await (0, patentRequest_service_1.submitPatentRequest)(req.user._id, patentRequest_service_1.patentRequestSubmissionSchema.parse(req.body));
    res.status(201).json(new ApiResponse_1.ApiResponse(request));
};
exports.createPatentRequest = createPatentRequest;
const listMyPatentRequests = async (req, res) => {
    const requests = await (0, patentRequest_service_1.getMyPatentRequests)(req.user._id);
    res.json(new ApiResponse_1.ApiResponse(requests));
};
exports.listMyPatentRequests = listMyPatentRequests;
const getPatentRequest = async (req, res) => {
    const request = await (0, patentRequest_service_1.getPatentRequestById)(req.user._id, String(req.params.id));
    res.json(new ApiResponse_1.ApiResponse(request));
};
exports.getPatentRequest = getPatentRequest;
