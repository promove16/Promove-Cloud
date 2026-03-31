"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatentRequest = exports.listMyPatentRequests = exports.createPatentRequest = exports.listMyPatents = exports.createPatent = void 0;
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
