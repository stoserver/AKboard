const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const settingsService = require('./settingsService');

const db = getDb();

function isInstalled() {
  return settingsService.getBooleanSetting('setup_completed', false);
}

function completeInstallation({ siteName, databaseName, adminUsername, adminPassword, oauthGoogleClientId, oauthGoogleClientSecret, oauthGithubClientId, oauthGithubClientSecret, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, octomoApiKey, octomoVerifyUrl, octomoSendUrl, termsLabel, privacyLabel, twoFactorRequired }) {
  if (isInstalled()) {
    throw new Error('이미 설치가 완료되었습니다.');
  }

  const tx = db.transaction(() => {
    const roleStmt = db.prepare('INSERT OR IGNORE INTO roles(name, description) VALUES (?, ?)');
    roleStmt.run('admin', 'System administrator');
    roleStmt.run('member', 'Default verified member');
    roleStmt.run('moderator', 'Can oversee content and users');
    roleStmt.run('vip', 'Access to premium/private boards');

    const boardStmt = db.prepare('INSERT OR IGNORE INTO boards(slug, title, description, required_role) VALUES (?, ?, ?, ?)');
    boardStmt.run('notice', '공지사항', '운영진 공지 전용 게시판', null);
    boardStmt.run('free', '자유게시판', '회원 자유 토론 게시판', 'member');
    boardStmt.run('vip-lounge', 'VIP 라운지', '특별 역할 사용자 전용 게시판', 'vip');

    const passwordHash = bcrypt.hashSync(adminPassword, 12);
    const adminResult = db.prepare(
      `INSERT INTO users(username, nickname, password_hash, is_verified, terms_agreed, privacy_agreed, two_factor_enabled)
       VALUES (?, ?, ?, 1, 1, 1, ?)`
    ).run(adminUsername, adminUsername, passwordHash, twoFactorRequired ? 1 : 0);

    const adminRoleId = db.prepare('SELECT id FROM roles WHERE name = ?').get('admin').id;
    const memberRoleId = db.prepare('SELECT id FROM roles WHERE name = ?').get('member').id;
    db.prepare('INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)').run(adminResult.lastInsertRowid, adminRoleId);
    db.prepare('INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)').run(adminResult.lastInsertRowid, memberRoleId);

    settingsService.setSetting('setup_completed', 'true');
    settingsService.setSetting('site_name', siteName || 'AKBoard 1');
    settingsService.setSetting('database_name', databaseName || 'akboard');
    settingsService.setSetting('oauth_google_client_id', oauthGoogleClientId || '');
    settingsService.setSetting('oauth_google_client_secret', oauthGoogleClientSecret || '');
    settingsService.setSetting('oauth_github_client_id', oauthGithubClientId || '');
    settingsService.setSetting('oauth_github_client_secret', oauthGithubClientSecret || '');
    settingsService.setSetting('smtp_host', smtpHost || 'smtp.gmail.com');
    settingsService.setSetting('smtp_port', String(smtpPort || 587));
    settingsService.setSetting('smtp_secure', smtpSecure ? 'true' : 'false');
    settingsService.setSetting('smtp_user', smtpUser || '');
    settingsService.setSetting('smtp_pass', smtpPass || '');
    settingsService.setSetting('octomo_api_key', octomoApiKey || '');
    settingsService.setSetting('octomo_verify_url', octomoVerifyUrl || 'https://octomo.octoverse.kr/api/v1/messages/verify');
    settingsService.setSetting('octomo_send_url', octomoSendUrl || 'https://octomo.octoverse.kr/api/v1/messages/send');
    settingsService.setSetting('terms_label', termsLabel || '{사이트이름} 이용약관에 동의합니다');
    settingsService.setSetting('privacy_label', privacyLabel || '개인정보 처리방침에 동의합니다.');
    settingsService.setSetting('two_factor_required', twoFactorRequired ? 'true' : 'false');
  });

  tx();
}

module.exports = {
  isInstalled,
  completeInstallation
};
