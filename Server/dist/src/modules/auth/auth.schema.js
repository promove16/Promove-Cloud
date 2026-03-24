"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const roles_types_1 = require("../../types/roles.types");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().trim().min(2).max(100),
    role: zod_1.z.nativeEnum(roles_types_1.UserRole),
    accessCode: zod_1.z.string().trim().min(1),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string().min(1),
    role: zod_1.z.nativeEnum(roles_types_1.UserRole),
});
