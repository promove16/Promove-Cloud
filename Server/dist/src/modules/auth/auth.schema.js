"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const roles_types_1 = require("../../types/roles.types");
const optionalProfileString = (max) => zod_1.z
    .union([zod_1.z.string().trim().max(max), zod_1.z.literal('')])
    .optional()
    .transform((value) => {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
});
const institutionProfileInputSchema = zod_1.z.object({
    institutionName: zod_1.z.string().trim().min(2).max(160),
    location: zod_1.z.string().trim().min(2).max(160),
    totalStudentsEnrolled: zod_1.z.coerce.number().int().min(1),
    academicYear: zod_1.z.string().trim().min(4).max(20),
    iicStarRating: zod_1.z.coerce.number().min(0).max(5).default(0),
});
exports.registerSchema = zod_1.z
    .object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().trim().min(2).max(100),
    role: zod_1.z.nativeEnum(roles_types_1.UserRole),
    institutionToken: zod_1.z.string().trim().min(1).optional(),
    accessCode: zod_1.z.string().trim().min(1).optional(),
    domain: optionalProfileString(120),
    bio: optionalProfileString(500),
    institutionProfile: institutionProfileInputSchema.optional(),
})
    .superRefine((value, ctx) => {
    if (value.role === roles_types_1.UserRole.STUDENT && !(value.institutionToken || value.accessCode)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['institutionToken'],
            message: 'Institution token is required for student registrations',
        });
    }
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string().min(1),
    role: zod_1.z.nativeEnum(roles_types_1.UserRole),
});
