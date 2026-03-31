"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const chat_routes_1 = __importDefault(require("./modules/chat/chat.routes"));
const college_routes_1 = __importDefault(require("./modules/college/college.routes"));
const deal_routes_1 = __importStar(require("./modules/deal/deal.routes"));
const event_routes_1 = __importDefault(require("./modules/event/event.routes"));
const investor_routes_1 = __importDefault(require("./modules/investor/investor.routes"));
const marketplace_routes_1 = __importDefault(require("./modules/marketplace/marketplace.routes"));
const notification_routes_1 = __importDefault(require("./modules/notification/notification.routes"));
const patent_routes_1 = __importDefault(require("./modules/patent/patent.routes"));
const problem_routes_1 = __importDefault(require("./modules/problemBank/problem.routes"));
const recruiter_routes_1 = __importDefault(require("./modules/recruiter/recruiter.routes"));
const school_routes_1 = __importDefault(require("./modules/school/school.routes"));
const score_routes_1 = __importDefault(require("./modules/innovationScore/score.routes"));
const mentor_routes_1 = __importDefault(require("./modules/mentor/mentor.routes"));
const startup_routes_1 = __importDefault(require("./modules/startup/startup.routes"));
const user_routes_1 = __importDefault(require("./modules/user/user.routes"));
const workspace_routes_1 = __importDefault(require("./modules/workspace/workspace.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const dm_routes_1 = __importDefault(require("./modules/dm/dm.routes"));
const report_routes_1 = __importDefault(require("./modules/report/report.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const ApiError_1 = require("./utils/ApiError");
const createApp = () => {
    const app = (0, express_1.default)();
    const clientBuildPath = path_1.default.resolve(__dirname, '../../public');
    const hasClientBuild = (0, fs_1.existsSync)(clientBuildPath);
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.CLIENT_URL,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '10kb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
        stream: logger_1.httpLogStream,
    }));
    app.use('/api', (0, rateLimiter_1.withRateLimit)(rateLimiter_1.apiLimiter));
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/users', user_routes_1.default);
    app.use('/api/score', score_routes_1.default);
    app.use('/api/problems', problem_routes_1.default);
    app.use('/api/workspace', workspace_routes_1.default);
    app.use('/api/chat', chat_routes_1.default);
    app.use('/api/patents', patent_routes_1.default);
    app.use('/api/startup', startup_routes_1.default);
    app.use('/api/investor', investor_routes_1.default);
    app.use('/api/marketplace', marketplace_routes_1.default);
    app.use('/api/notifications', notification_routes_1.default);
    app.use('/api/deals', deal_routes_1.default);
    app.use('/api/startups', deal_routes_1.startupsInvestmentRouter);
    app.use('/api/recruiter', recruiter_routes_1.default);
    app.use('/api/mentor', mentor_routes_1.default);
    app.use('/api/school', school_routes_1.default);
    app.use('/api/college', college_routes_1.default);
    app.use('/api/events', event_routes_1.default);
    app.use('/api/admin', admin_routes_1.default);
    app.use('/api/dm', dm_routes_1.default);
    app.use('/api/report', report_routes_1.default);
    app.use('/api/settings', settings_routes_1.default);
    app.get('/api/health', (_req, res) => {
        res.status(200).json({ success: true, data: { status: 'ok' } });
    });
    if (hasClientBuild) {
        app.use(express_1.default.static(clientBuildPath));
        app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
            res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
        });
    }
    app.use((_req, _res, next) => {
        next(new ApiError_1.ApiError(404, 'NOT_FOUND', 'Route not found'));
    });
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
const app = (0, exports.createApp)();
exports.default = app;
