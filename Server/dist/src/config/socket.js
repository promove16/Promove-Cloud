"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
const env_1 = require("./env");
const scoreSocket_1 = require("../sockets/scoreSocket");
const chatSocket_1 = require("../sockets/chatSocket");
const notificationSocket_1 = require("../sockets/notificationSocket");
const mentorSocket_1 = require("../sockets/mentorSocket");
const dmSocket_1 = require("../sockets/dmSocket");
const initSocket = (httpServer) => {
    exports.io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.env.CLIENT_URL,
            credentials: true,
        },
        pingInterval: 25000,
        pingTimeout: 30000,
    });
    (0, scoreSocket_1.initScoreSocket)(exports.io);
    (0, chatSocket_1.initChatSocket)(exports.io);
    (0, notificationSocket_1.initNotificationSocket)(exports.io);
    (0, mentorSocket_1.initMentorSocket)(exports.io);
    (0, dmSocket_1.initDmSocket)(exports.io);
    return exports.io;
};
exports.initSocket = initSocket;
