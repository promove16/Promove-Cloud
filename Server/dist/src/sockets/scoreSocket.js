"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScoreSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const initScoreSocket = (io) => {
    const score = io.of('/score');
    score.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token)
            return next(new Error('Unauthorized'));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
            socket.data.userId = decoded._id;
            socket.data.role = decoded.role;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    score.on('connection', (socket) => {
        const userId = socket.data.userId;
        socket.join(`user:${userId}`);
        socket.on('disconnect', () => {
            socket.leave(`user:${userId}`);
        });
    });
};
exports.initScoreSocket = initScoreSocket;
