"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScoreSocket = void 0;
const auth_1 = require("./auth");
const initScoreSocket = (io) => {
    const score = io.of('/score');
    score.use((socket, next) => {
        try {
            (0, auth_1.verifySocketToken)(socket);
            next();
        }
        catch (error) {
            next(error);
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
