"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    data;
    meta;
    success = true;
    constructor(data, meta) {
        this.data = data;
        this.meta = meta;
    }
}
exports.ApiResponse = ApiResponse;
