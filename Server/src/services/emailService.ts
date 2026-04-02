import nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface TeamInviteEmailParams {
  toEmail: string;
  inviterName: string;
  workspaceTitle: string;
  inviteLink: string;
}

export interface SendEmailParams {
  toEmail: string;
  subject: string;
  html: string;
}

const smtpUser = env.EMAIL_USER ?? env.SMTP_USER;
const smtpPass = env.EMAIL_PASS ?? env.SMTP_PASS;
const smtpHost = env.SMTP_HOST ?? (smtpUser ? 'smtp.gmail.com' : undefined);
const smtpPort = env.SMTP_HOST ? env.SMTP_PORT : smtpUser ? 587 : env.SMTP_PORT;
const smtpSecure = env.SMTP_HOST ? env.SMTP_SECURE : false;

const transporter = smtpHost
  ? nodemailer.createTransport({
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
  : nodemailer.createTransport({ jsonTransport: true });

export const sendEmail = async ({ toEmail, subject, html }: SendEmailParams): Promise<void> => {
  await transporter.sendMail({
    from: env.FROM_EMAIL || smtpUser,
    to: toEmail,
    subject,
    html,
  });
};

export const sendTeamInviteEmail = async ({
  toEmail,
  inviterName,
  workspaceTitle,
  inviteLink,
}: TeamInviteEmailParams): Promise<void> => {
  await sendEmail({
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
