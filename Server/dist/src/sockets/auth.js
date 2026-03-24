"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySocketToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const verifySocketToken = (socket) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        throw new Error('Unauthorized');
    }
    const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET, {
        algorithms: ['RS256'],
    });
    socket.data.userId = decoded._id;
    socket.data.role = decoded.role;
    socket.data.email = decoded.email;
};
exports.verifySocketToken = verifySocketToken;
