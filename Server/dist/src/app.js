"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const chat_routes_1 = __importDefault(require("./modules/chat/chat.routes"));
const marketplace_routes_1 = __importDefault(require("./modules/marketplace/marketplace.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const patent_routes_1 = __importDefault(require("./modules/patent/patent.routes"));
const problem_routes_1 = __importDefault(require("./modules/problemBank/problem.routes"));
const score_routes_1 = __importDefault(require("./modules/innovationScore/score.routes"));
const startup_routes_1 = __importDefault(require("./modules/startup/startup.routes"));
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const workspace_routes_1 = __importDefault(require("./modules/workspace/workspace.routes"));
const ApiError_1 = require("./utils/ApiError");
const createApp = () => {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.CLIENT_URL,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '10kb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    app.use('/api', (0, rateLimiter_1.withRateLimit)(rateLimiter_1.apiLimiter));
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/score', score_routes_1.default);
    app.use('/api/problems', problem_routes_1.default);
    app.use('/api/workspace', workspace_routes_1.default);
    app.use('/api/chat', chat_routes_1.default);
    app.use('/api/patents', patent_routes_1.default);
    app.use('/api/startup', startup_routes_1.default);
    app.use('/api/marketplace', marketplace_routes_1.default);
    app.use('/api/notifications', notification_routes_1.default);
    app.get('/api/health', (_req, res) => {
        res.status(200).json({ success: true, data: { status: 'ok' } });
    });
    app.use((_req, _res, next) => {
        next(new ApiError_1.ApiError(404, 'NOT_FOUND', 'Route not found'));
    });
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
const app = (0, exports.createApp)();
exports.default = app;
