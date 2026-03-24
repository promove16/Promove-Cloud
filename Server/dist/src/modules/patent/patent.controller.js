"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMyPatents = exports.createPatent = void 0;
const ApiResponse_1 = require("../../utils/ApiResponse");
const patent_service_1 = require("./patent.service");
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
