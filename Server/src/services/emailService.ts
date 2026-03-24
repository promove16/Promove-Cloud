import nodemailer from 'nodemailer';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../config/env';

export interface TeamInviteEmailParams {
  toEmail: string;
  inviterName: string;
  workspaceTitle: string;
  inviteLink: string;
}

const sesClient =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? new SESClient({
        region: env.AWS_REGION,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      })
    : null;

const transporter = sesClient
  ? nodemailer.createTransport({
      SES: {
        ses: sesClient,
        aws: { SendRawEmailCommand },
      },
    })
  : nodemailer.createTransport({ jsonTransport: true });

export const sendTeamInviteEmail = async ({
  toEmail,
  inviterName,
  workspaceTitle,
  inviteLink,
}: TeamInviteEmailParams): Promise<void> => {
  await transporter.sendMail({
    from: env.FROM_EMAIL,
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
