import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env';
import { logger } from '../config/logger';

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

type MailTransport = 'json' | 'ses' | 'smtp';

const resolveMailTransport = (): MailTransport => {
  if (env.MAIL_TRANSPORT === 'json') {
    return 'json';
  }

  if (env.MAIL_TRANSPORT === 'smtp') {
    if (!smtpHost) {
      throw new Error('MAIL_TRANSPORT=smtp requires SMTP_HOST or EMAIL_USER.');
    }

    return 'smtp';
  }

  if (env.MAIL_TRANSPORT === 'ses') {
    if (!env.AWS_REGION) {
      throw new Error('MAIL_TRANSPORT=ses requires AWS_REGION.');
    }

    return 'ses';
  }

  if (smtpHost) {
    return 'smtp';
  }

  if (env.NODE_ENV === 'production') {
    if (!env.AWS_REGION) {
      throw new Error('Production email requires SMTP_* credentials or AWS_REGION for SES.');
    }

    return 'ses';
  }

  return 'json';
};

const mailTransport = resolveMailTransport();

const smtpTransporter =
  mailTransport === 'smtp'
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
    : null;

const jsonTransporter =
  mailTransport === 'json' ? nodemailer.createTransport({ jsonTransport: true }) : null;

const sesClient = mailTransport === 'ses' ? new SESClient({ region: env.AWS_REGION }) : null;

// In development, set DEV_EMAIL_REDIRECT in .env to a real inbox you control.
// All outgoing emails are then delivered there instead of the (possibly dummy)
// recipient address, so you can verify templates without needing real user emails.
const devRedirect =
  env.NODE_ENV === 'development' ? (env.DEV_EMAIL_REDIRECT ?? null) : null;

export const sendEmail = async ({ toEmail, subject, html }: SendEmailParams): Promise<void> => {
  const recipient = devRedirect ?? toEmail;
  const resolvedSubject = devRedirect ? `[DEV -> ${toEmail}] ${subject}` : subject;

  if (devRedirect) {
    logger.info(`[EMAIL DEV] Redirecting email originally for <${toEmail}> -> <${devRedirect}> | Subject: ${subject}`);
  }

  if (sesClient) {
    await sesClient.send(
      new SendEmailCommand({
        Source: env.FROM_EMAIL,
        Destination: {
          ToAddresses: [recipient],
        },
        Message: {
          Subject: {
            Charset: 'UTF-8',
            Data: resolvedSubject,
          },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: html,
            },
          },
        },
      }),
    );
    return;
  }

  const transporter = smtpTransporter ?? jsonTransporter;
  if (!transporter) {
    throw new Error('Email transport is not configured.');
  }

  await transporter.sendMail({
    from: env.FROM_EMAIL || smtpUser,
    to: recipient,
    subject: resolvedSubject,
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
        <p><strong>${escapeHtml(inviterName)}</strong> has invited you to collaborate on <strong>${escapeHtml(workspaceTitle)}</strong>.</p>
        <p>Open your invite here:</p>
        <p><a href="${escapeHtml(inviteLink)}">${escapeHtml(inviteLink)}</a></p>
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
        <p><a href="${escapeHtml(inviteLink)}">Open your student invite</a></p>
      </div>
    `,
  });
};
