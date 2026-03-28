const nodemailer = require('nodemailer');
const config = require('../config/env');

const transporter = config.NODE_ENV === 'production'
  ? nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER && config.SMTP_PASS
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined,
  })
  : nodemailer.createTransport({ jsonTransport: true });

async function sendMail(message) {
  const info = await transporter.sendMail({
    from: 'no-reply@promove.local',
    ...message,
  });

  return info;
}

function sendVerificationEmail(to, name, token) {
  return sendMail({
    to,
    subject: 'Verify your ProMove account',
    text: `Hello ${name},\n\nVerify your account here:\n${config.CLIENT_URL}/verify-email?token=${token}`,
  });
}

function sendPasswordResetEmail(to, name, token) {
  return sendMail({
    to,
    subject: 'Reset your ProMove password',
    text: `Hello ${name},\n\nReset your password here:\n${config.CLIENT_URL}/reset-password?token=${token}`,
  });
}

function sendTeamInvitationEmail(to, inviterName, token) {
  return sendMail({
    to,
    subject: 'You have been invited to a ProMove team',
    text: `Hello,\n\n${inviterName} invited you to join a team on ProMove.\n${config.CLIENT_URL}/team-invite/${token}`,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTeamInvitationEmail,
};
