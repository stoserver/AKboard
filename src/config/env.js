const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'akboard.db'),
  trustProxy: process.env.TRUST_PROXY === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'change-session-secret',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  oauthGoogleClientId: process.env.OAUTH_GOOGLE_CLIENT_ID || '',
  oauthGoogleClientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || '',
  oauthGithubClientId: process.env.OAUTH_GITHUB_CLIENT_ID || '',
  oauthGithubClientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || '',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || 'auth@parvia.kr',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'auth@parvia.kr',
  octomoApiKey: process.env.OCTOMO_API_KEY || '',
  octomoVerifyUrl: process.env.OCTOMO_VERIFY_URL || 'https://octomo.octoverse.kr/api/v1/messages/verify',
  octomoSendUrl: process.env.OCTOMO_SEND_URL || 'https://octomo.octoverse.kr/api/v1/messages/send'
};
