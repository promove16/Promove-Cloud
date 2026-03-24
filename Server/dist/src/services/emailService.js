"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTeamInviteEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const client_ses_1 = require("@aws-sdk/client-ses");
const env_1 = require("../config/env");
const sesClient = env_1.env.AWS_ACCESS_KEY_ID && env_1.env.AWS_SECRET_ACCESS_KEY
    ? new client_ses_1.SESClient({
        region: env_1.env.AWS_REGION,
        credentials: {
            accessKeyId: env_1.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env_1.env.AWS_SECRET_ACCESS_KEY,
        },
    })
    : null;
const transporter = sesClient
    ? nodemailer_1.default.createTransport({
        SES: {
            ses: sesClient,
            aws: { SendRawEmailCommand: client_ses_1.SendRawEmailCommand },
        },
    })
    : nodemailer_1.default.createTransport({ jsonTransport: true });
const sendTeamInviteEmail = async ({ toEmail, inviterName, workspaceTitle, inviteLink, }) => {
    await transporter.sendMail({
        from: env_1.env.FROM_EMAIL,
        to: toEmail,
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
