"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCurrentUser = exports.launchCurrentUserToRecruiters = exports.getCurrentUserMentorSessions = exports.getCurrentUser = exports.toSanitizedUser = exports.updateMeSchema = void 0;
const zod_1 = require("zod");
const user_model_1 = require("./user.model");
const ApiError_1 = require("../../utils/ApiError");
const mentorSession_model_1 = require("../mentor/mentorSession.model");
const roles_types_1 = require("../../types/roles.types");
const relevanceBridge_model_1 = require("../recruiter/relevanceBridge.model");
const placementRecord_model_1 = require("../college/placementRecord.model");
const notification_service_1 = require("../notification/notification.service");
const socket_1 = require("../../config/socket");
const recruiter_mappers_1 = require("../recruiter/recruiter.mappers");
exports.updateMeSchema = zod_1.z
    .object({
    displayName: zod_1.z.string().trim().min(2).max(100).optional(),
    avatar: zod_1.z.string().trim().url().optional().or(zod_1.z.literal('')),
    bio: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal('')),
    domain: zod_1.z.string().trim().max(120).optional().or(zod_1.z.literal('')),
    profileComplete: zod_1.z.boolean().optional(),
    discoverableToRecruiters: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
const toSanitizedUser = (user) => ({
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    ...(user.avatar ? { avatar: user.avatar } : {}),
    ...(user.bio ? { bio: user.bio } : {}),
    ...(user.domain ? { domain: user.domain } : {}),
    profileComplete: user.profileComplete,
    innovationScore: user.innovationScore,
    scoreBreakdown: user.scoreBreakdown,
    accessGrantedBy: user.accessGrantedBy,
    accessExpiresAt: user.accessExpiresAt,
    isActive: user.isActive,
    ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
    discoverableToRecruiters: user.discoverableToRecruiters ?? false,
    ...(user.institutionId ? { institutionId: user.institutionId.toString() } : {}),
    ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
    verificationStatus: user.verificationStatus,
    ...(user.verificationRequestedAt ? { verificationRequestedAt: user.verificationRequestedAt } : {}),
    ...(user.verifiedAt ? { verifiedAt: user.verifiedAt } : {}),
    ...(user.verificationRejectedAt ? { verificationRejectedAt: user.verificationRejectedAt } : {}),
    ...(user.verificationRejectedReason
        ? { verificationRejectedReason: user.verificationRejectedReason }
        : {}),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
exports.toSanitizedUser = toSanitizedUser;
const getCurrentUser = async (userId) => {
    const user = await user_model_1.User.findById(userId).lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return (0, exports.toSanitizedUser)(user);
};
exports.getCurrentUser = getCurrentUser;
const getCurrentUserMentorSessions = async (studentId) => {
    const sessions = await mentorSession_model_1.MentorSession.find({ studentId }).sort({ scheduledAt: 1 }).lean();
    const mentorIds = sessions.map((session) => session.mentorId);
    const mentors = mentorIds.length > 0
        ? await user_model_1.User.find({ _id: { $in: mentorIds } }).select('_id displayName avatar').lean()
        : [];
    const mentorMap = new Map(mentors.map((mentor) => [String(mentor._id), mentor]));
    return sessions.map((session) => {
        const mentor = mentorMap.get(String(session.mentorId));
        return {
            _id: String(session._id),
            mentor: {
                _id: String(session.mentorId),
                displayName: mentor?.displayName ?? 'Mentor',
                ...(mentor?.avatar ? { avatar: mentor.avatar } : {}),
            },
            ...(session.workspaceId ? { workspaceId: String(session.workspaceId) } : {}),
            title: session.title,
            scheduledAt: session.scheduledAt,
            durationMinutes: session.durationMinutes,
            ...(session.meetLink ? { meetLink: session.meetLink } : {}),
            status: session.status,
            ...(session.mentorNotes ? { mentorNotes: session.mentorNotes } : {}),
            ...(session.studentFeedback ? { studentFeedback: session.studentFeedback } : {}),
            createdAt: session.createdAt,
        };
    });
};
exports.getCurrentUserMentorSessions = getCurrentUserMentorSessions;
const launchCurrentUserToRecruiters = async (studentId) => {
    const student = await user_model_1.User.findById(studentId).select('_id role institutionId innovationScore displayName').lean();
    if (!student || student.role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    }
    const recruiters = await user_model_1.User.find({ role: roles_types_1.UserRole.RECRUITER, isActive: true })
        .select('_id')
        .lean();
    const collegeId = await (0, recruiter_mappers_1.getStudentCollegeId)(studentId);
    await Promise.all(recruiters.map((recruiter) => relevanceBridge_model_1.RelevanceBridge.updateOne({
        studentId,
        recruiterId: recruiter._id,
    }, {
        studentId,
        recruiterId: recruiter._id,
        bridgeType: 'LAUNCH_TRIGGER',
        isActive: true,
    }, {
        upsert: true,
    })));
    if (collegeId) {
        await Promise.all(recruiters.map((recruiter) => placementRecord_model_1.PlacementRecord.findOneAndUpdate({
            studentId,
            recruiterId: recruiter._id,
            collegeId,
        }, {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
            status: 'Discovered',
            innovationScoreAtTime: student.innovationScore ?? 0,
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        })));
    }
    const notification = await notification_service_1.NotificationService.create({
        userId: studentId,
        type: 'system',
        title: 'Your profile is now visible to all active recruiters',
        body: 'Your profile is now visible to all active recruiters.',
        link: '/dashboard/student/profile',
    });
    if (socket_1.io) {
        socket_1.io.of('/notifications').to(`user:${studentId}`).emit('notification:new', notification);
    }
    return {
        bridgesCreated: recruiters.length,
    };
};
exports.launchCurrentUserToRecruiters = launchCurrentUserToRecruiters;
const updateCurrentUser = async (userId, payload) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (payload.displayName !== undefined) {
        user.displayName = payload.displayName;
    }
    if (payload.avatar !== undefined) {
        user.avatar = payload.avatar || undefined;
    }
    if (payload.bio !== undefined) {
        user.bio = payload.bio || undefined;
    }
    if (payload.domain !== undefined) {
        user.domain = payload.domain || undefined;
    }
    if (payload.profileComplete !== undefined) {
        user.profileComplete = payload.profileComplete;
    }
    if (payload.discoverableToRecruiters !== undefined) {
        user.discoverableToRecruiters = payload.discoverableToRecruiters;
    }
    await user.save();
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.updateCurrentUser = updateCurrentUser;
