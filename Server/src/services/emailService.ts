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

const renderEmailShell = ({
  preheader,
  title,
  intro,
  body,
  ctaLabel,
  ctaUrl,
  footer,
}: {
  preheader: string;
  title: string;
  intro?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;background:#f3f6fb;color:#10213a;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(preheader)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:#0b2f6b;padding:24px 28px;">
                  <div style="font-size:22px;line-height:1.2;font-weight:700;color:#ffffff;">ProMove</div>
                  <div style="margin-top:4px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#b9d2ff;">Innovation Cloud</div>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;">
                  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#07142b;">${escapeHtml(title)}</h1>
                  ${
                    intro
                      ? `<p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#334155;">${escapeHtml(intro)}</p>`
                      : ''
                  }
                  <div style="font-size:15px;line-height:1.7;color:#334155;">
                    ${body}
                  </div>
                  ${
                    ctaLabel && ctaUrl
                      ? `
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 18px;">
                          <tr>
                            <td style="border-radius:10px;background:#2563eb;">
                              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                                ${escapeHtml(ctaLabel)}
                              </a>
                            </td>
                          </tr>
                        </table>
                      `
                      : ''
                  }
                  ${
                    ctaUrl
                      ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:<br /><a href="${escapeHtml(ctaUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>`
                      : ''
                  }
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #e2e8f0;padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
                  ${escapeHtml(footer ?? `This email was sent by ProMove Innovation Cloud. Need help? Contact ${env.SUPPORT_EMAIL}.`)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

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
    html: renderEmailShell({
      preheader: `${institutionName} created your ProMove student account.`,
      title: 'Your ProMove account is ready',
      intro: `Hello ${studentName}, ${institutionName} created your student account through the ${institutionLabel} dashboard.`,
      body: `
        <p style="margin:0 0 14px;">Use this temporary password to sign in:</p>
        <p style="display:inline-block;margin:0 0 16px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;color:#0f172a;">
          ${escapeHtml(temporaryPassword)}
        </p>
        <p style="margin:0;">You will be asked to change this password after your first login.</p>
      `,
      ctaLabel: 'Sign in to ProMove',
      ctaUrl: loginUrl,
    }),
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
    html: renderEmailShell({
      preheader: `${inviterName} invited you to collaborate on ${workspaceTitle}.`,
      title: 'You are invited to collaborate',
      intro: `${inviterName} invited you to collaborate on ${workspaceTitle}.`,
      body: '<p style="margin:0;">Open the invite to join the workspace and continue building with your team.</p>',
      ctaLabel: 'Open workspace invite',
      ctaUrl: inviteLink,
    }),
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
    html: renderEmailShell({
      preheader: `${institutionName} added you to its ProMove ${institutionLabel} roster.`,
      title: 'Complete your ProMove student signup',
      intro: `Hello ${studentName}, ${institutionName} added you to its ProMove ${institutionLabel} roster.`,
      body: `
        <p style="margin:0 0 14px;">Use the button below to complete your student registration. The institution token is already included in the invite link.</p>
        <p style="margin:0;">Please register using this email address: <strong>${escapeHtml(toEmail)}</strong>.</p>
      `,
      ctaLabel: 'Complete student signup',
      ctaUrl: inviteLink,
    }),
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
    html: renderEmailShell({
      preheader: `${institutionName} invited you to activate your ProMove student access.`,
      title: 'Your ProMove student invite is ready',
      intro: `${institutionName} added you to its ProMove ${institutionLabel} roster.`,
      body: `
        <p style="margin:0 0 14px;">To activate your student dashboard, open the invite and complete registration.</p>
        <p style="margin:0 0 14px;">Use this exact email address during signup:</p>
        <p style="display:inline-block;margin:0;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px;font-weight:700;color:#0f172a;">
          ${escapeHtml(studentEmail)}
        </p>
      `,
      ctaLabel: 'Open student invite',
      ctaUrl: inviteLink,
      footer: `This invite was sent by ${institutionName} through ProMove Innovation Cloud. Need help? Contact ${env.SUPPORT_EMAIL}.`,
    }),
  });
};
