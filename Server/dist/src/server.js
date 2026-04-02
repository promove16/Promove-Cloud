"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const activityWorker_1 = require("./jobs/activityWorker");
const notificationWorker_1 = require("./jobs/notificationWorker");
const retentionEmailWorker_1 = require("./jobs/retentionEmailWorker");
const scoreRecalcWorker_1 = require("./jobs/scoreRecalcWorker");
const institutionVerifyWorker_1 = require("./workers/institutionVerifyWorker");
const problem_service_1 = require("./modules/problemBank/problem.service");
const socket_1 = require("./config/socket");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const startServer = async () => {
    await (0, db_1.connectDB)();
    await (0, problem_service_1.seedProblemsIfEmpty)();
    const httpServer = http_1.default.createServer(app_1.default);
    (0, socket_1.initSocket)(httpServer);
    if (env_1.env.NODE_ENV !== 'test') {
        (0, activityWorker_1.startActivityWorker)();
        (0, scoreRecalcWorker_1.startScoreWorker)();
        (0, notificationWorker_1.startNotificationWorker)();
        (0, retentionEmailWorker_1.startRetentionEmailWorker)();
        (0, institutionVerifyWorker_1.startInstitutionVerifyWorker)();
        await (0, retentionEmailWorker_1.scheduleWeeklyProgressSummaryJob)();
    }
    httpServer.listen(env_1.env.PORT, () => {
        logger_1.logger.info(`Server listening on port ${env_1.env.PORT}. Writing logs to ${logger_1.logFile}`);
    });
};
const shutdownWithLoggedError = (type, error) => {
    (0, logger_1.logError)(type, error);
    setTimeout(() => process.exit(1), 100);
};
process.on('uncaughtException', (error) => {
    shutdownWithLoggedError('uncaughtException', error);
});
process.on('unhandledRejection', (error) => {
    shutdownWithLoggedError('unhandledRejection', error);
});
void startServer().catch((error) => {
    shutdownWithLoggedError('Server startup failed', error);
});
