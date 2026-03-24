"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const notificationWorker_1 = require("./jobs/notificationWorker");
const scoreRecalcWorker_1 = require("./jobs/scoreRecalcWorker");
const problem_service_1 = require("./modules/problemBank/problem.service");
const socket_1 = require("./config/socket");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const startServer = async () => {
    await (0, db_1.connectDB)();
    await (0, problem_service_1.seedProblemsIfEmpty)();
    const httpServer = http_1.default.createServer(app_1.default);
    (0, socket_1.initSocket)(httpServer);
    if (env_1.env.NODE_ENV !== 'test') {
        (0, scoreRecalcWorker_1.startScoreWorker)();
        (0, notificationWorker_1.startNotificationWorker)();
    }
    httpServer.listen(env_1.env.PORT, () => {
        console.log(`Server listening on port ${env_1.env.PORT}`);
    });
};
process.on('uncaughtException', (error) => {
    console.error('uncaughtException', error);
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
void startServer();
