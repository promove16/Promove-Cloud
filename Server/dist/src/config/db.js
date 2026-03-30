"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const logger_1 = require("./logger");
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let listenersRegistered = false;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const registerConnectionListeners = () => {
    if (listenersRegistered) {
        return;
    }
    mongoose_1.default.connection.on('error', (error) => {
        (0, logger_1.logError)('MongoDB connection error', error);
    });
    mongoose_1.default.connection.on('disconnected', () => {
        logger_1.logger.warn('MongoDB disconnected');
    });
    listenersRegistered = true;
};
const connectDB = async () => {
    registerConnectionListeners();
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            logger_1.logger.info(`Connecting to MongoDB (attempt ${attempt}/${MAX_RETRIES})`);
            await mongoose_1.default.connect(env_1.env.MONGODB_URI);
            logger_1.logger.info('MongoDB connected');
            return;
        }
        catch (error) {
            (0, logger_1.logError)(`MongoDB connection attempt ${attempt} failed`, error);
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
