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

export interface TemporaryStudentCredentialsEmailParams {
  toEmail: string;
  studentName: string;
  institutionName: string;
  institutionRole: string;
  temporaryPassword: string;
}

export interface StudentInviteEmailParams {
  toEmail: string;
  studentName: string;
  institutionName: string;
  institutionRole: string;
  institutionToken: string;
}

export interface InstitutionStudentInviteEmailParams {
  toEmail: string;
  studentEmail: string;
  institutionName: string;
  institutionRole: string;
  inviteLink: string;
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildClientUrl = (path: string) => {
  const base = env.CLIENT_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
};

export const sendTemporaryStudentCredentialsEmail = async ({
  toEmail,
  studentName,
  institutionName,
  institutionRole,
  temporaryPassword,
}: TemporaryStudentCredentialsEmailParams): Promise<void> => {
  const loginUrl = buildClientUrl('/login');
  const institutionLabel = institutionRole === 'college' ? 'college' : 'school';

  await sendEmail({
    toEmail,
    subject: 'Your ProMove temporary login',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10213a;">
        <h2>Your ProMove account is ready</h2>
        <p>Hello ${escapeHtml(studentName)},</p>
        <p>${escapeHtml(institutionName)} created your ProMove student account through the ${escapeHtml(institutionLabel)} dashboard.</p>
        <p>Use this temporary password to sign in:</p>
        <p style="display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;font-family:monospace;font-weight:700;">
          ${escapeHtml(temporaryPassword)}
        </p>
        <p>You will be asked to change this password after your first login.</p>
        <p><a href="${escapeHtml(loginUrl)}">Sign in to ProMove</a></p>
      </div>
    `,
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

const buildSignupInviteLink = (params: {
  email: string;
  token: string;
  inviterName: string;
}) => {
  const search = new URLSearchParams({
    inviteRole: 'student',
    inviteeEmail: params.email,
    institutionToken: params.token,
    inviterName: params.inviterName,
  });

  return buildClientUrl(`/signup?${search.toString()}`);
};

export const sendStudentInviteEmail = async ({
  toEmail,
  studentName,
  institutionName,
  institutionRole,
  institutionToken,
}: StudentInviteEmailParams): Promise<void> => {
  const inviteLink = buildSignupInviteLink({
    email: toEmail,
    token: institutionToken,
    inviterName: institutionName,
  });
  const institutionLabel = institutionRole === 'college' ? 'college' : 'school';

  await sendEmail({
    toEmail,
    subject: `${institutionName} invited you to ProMove`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#10213a;">
        <h2>You have been invited to ProMove</h2>
        <p>Hello ${escapeHtml(studentName)},</p>
        <p>${escapeHtml(institutionName)} added you to their ${escapeHtml(institutionLabel)} roster.</p>
        <p>Use the link below to complete your student registration. The institution token is already included.</p>
        <p><a href="${escapeHtml(inviteLink)}">Complete student signup</a></p>
        <p>If you already have a ProMove account with this email, sign in and submit the institution token from the invite.</p>
      </div>
    `,
  });
};

export const sendInstitutionStudentInviteEmail = async ({
  toEmail,
  studentEmail,
  institutionName,
  institutionRole,
  inviteLink,
}: InstitutionStudentInviteEmailParams): Promise<void> => {
  const institutionLabel = institutionRole === 'college' ? 'college' : 'school';

  await sendEmail({
    toEmail,
    subject: `${institutionName} invited you to join ProMove`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #10213a;">
        <h2>Your ProMove student invite is ready</h2>
        <p><strong>${escapeHtml(institutionName)}</strong> added <strong>${escapeHtml(studentEmail)}</strong> to its ProMove ${escapeHtml(institutionLabel)} roster.</p>
        <p>Register with this same email address to claim your student access.</p>
        <p><a href="${inviteLink}">Open your student invite</a></p>
      </div>
    `,
  });
};
