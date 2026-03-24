"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const winston_1 = __importDefault(require("winston"));
const env_1 = require("./env");
const logger = winston_1.default.createLogger({
    level: env_1.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.printf(({ level, message, timestamp, stack }) => `${timestamp} [${level}] ${stack ?? message}`)),
    transports: [new winston_1.default.transports.Console()],
});
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let listenersRegistered = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const registerConnectionListeners = () => {
    if (listenersRegistered) {
        return;
    }
    mongoose_1.default.connection.on('error', (error) => {
        logger.error(`MongoDB connection error: ${error.message}`);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
    });
    listenersRegistered = true;
};
const connectDB = async () => {
    registerConnectionListeners();
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})`);
            await mongoose_1.default.connect(env_1.env.MONGODB_URI);
            logger.info('MongoDB connected');
            return;
        }
        catch (error) {
            logger.error(`MongoDB connection attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            if (attempt === MAX_RETRIES) {
                throw error;
            }
            await delay(RETRY_DELAY_MS);
        }
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    if (mongoose_1.default.connection.readyState !== 0) {
        await mongoose_1.default.disconnect();
    }
};
exports.disconnectDB = disconnectDB;
