const nodemailer = require('nodemailer');
const env = require('../config/env');
const settingsService = require('./settingsService');

function getSmtpConfig() {
  return {
    host: settingsService.getSetting('smtp_host', env.smtpHost),
    port: Number(settingsService.getSetting('smtp_port', String(env.smtpPort))),
    secure: settingsService.getSetting('smtp_secure', env.smtpSecure ? 'true' : 'false') === 'true',
    auth: {
      user: settingsService.getSetting('smtp_user', env.smtpUser),
      pass: settingsService.getSetting('smtp_pass', env.smtpPass)
    }
  };
}

async function sendMail({ to, subject, text }) {
  const transporter = nodemailer.createTransport(getSmtpConfig());
  await transporter.sendMail({
    from: env.mailFrom,
    to,
    subject,
    text
  });
}

async function sendVerificationCode(to, code) {
  await sendMail({
    to,
    subject: '[AKBoard] 이메일 인증코드',
    text: `AKBoard 인증코드: ${code}`
  });
}

async function sendPasswordResetCode(to, code) {
  await sendMail({
    to,
    subject: '[AKBoard] 비밀번호 재설정 코드',
    text: `비밀번호 재설정 코드: ${code}`
  });
}

module.exports = { sendVerificationCode, sendPasswordResetCode };
