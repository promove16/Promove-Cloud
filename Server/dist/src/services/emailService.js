"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTeamInviteEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const smtpUser = env_1.env.EMAIL_USER ?? env_1.env.SMTP_USER;
const smtpPass = env_1.env.EMAIL_PASS ?? env_1.env.SMTP_PASS;
const smtpHost = env_1.env.SMTP_HOST ?? (smtpUser ? 'smtp.gmail.com' : undefined);
const smtpPort = env_1.env.SMTP_HOST ? env_1.env.SMTP_PORT : smtpUser ? 587 : env_1.env.SMTP_PORT;
const smtpSecure = env_1.env.SMTP_HOST ? env_1.env.SMTP_SECURE : false;
const transporter = smtpHost
    ? nodemailer_1.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        ...(smtpUser && smtpPass
            ? {
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            }
            : {}),
    })
    : nodemailer_1.default.createTransport({ jsonTransport: true });
const sendEmail = async ({ toEmail, subject, html }) => {
    await transporter.sendMail({
        from: env_1.env.FROM_EMAIL || smtpUser,
        to: toEmail,
        subject,
        html,
    });
};
exports.sendEmail = sendEmail;
const sendTeamInviteEmail = async ({ toEmail, inviterName, workspaceTitle, inviteLink, }) => {
    await (0, exports.sendEmail)({
        toEmail,
        subject: `${inviterName} invited you to collaborate on ProMove`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>You're invited to collaborate on ProMove Innovation Cloud</h2>
        <p><strong>${inviterName}</strong> has invited you to collaborate on <strong>${workspaceTitle}</strong>.</p>
        <p>Open your invite here:</p>
        <p><a href="${inviteLink}">${inviteLink}</a></p>
      </div>
    `,
    });
};
exports.sendTeamInviteEmail = sendTeamInviteEmail;
