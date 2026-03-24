"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScoreWorker = void 0;
const bullmq_1 = require("bullmq");
const bullmq_2 = require("../config/bullmq");
const scoreEngine_1 = require("../services/scoreEngine");
const startScoreWorker = () => {
    const worker = new bullmq_1.Worker('score-recalc', async (job) => {
        await (0, scoreEngine_1.applyScore)(job.data);
    }, {
        connection: bullmq_2.bullmqConnection,
        concurrency: 10,
    });
    worker.on('failed', (job, err) => {
        console.error(`Score job ${job?.id} failed:`, err.message);
    });
    return worker;
};
exports.startScoreWorker = startScoreWorker;
