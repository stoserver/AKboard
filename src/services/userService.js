const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const settingsService = require('./settingsService');

const db = getDb();

function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function createUser({ email, phone, studentId, realName, username, nickname, password, termsAgreed, privacyAgreed }) {
  const passwordHash = bcrypt.hashSync(password, 12);

  const stmt = db.prepare(
    `INSERT INTO users(email, phone, student_id, real_name, username, nickname, password_hash, terms_agreed, privacy_agreed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    email ? email.toLowerCase() : null,
    phone || null,
    studentId,
    realName,
    username,
    nickname,
    passwordHash,
    termsAgreed ? 1 : 0,
    privacyAgreed ? 1 : 0
  );

  return { id: result.lastInsertRowid };
}

function createVerificationRequest({ userId, channel, target }) {
  const code = generateCode(8);
  db.prepare(
    `INSERT INTO verification_requests(user_id, channel, target, code, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))`
  ).run(userId, channel, target, code);
  return code;
}

function confirmVerification(userId) {
  db.prepare('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?').run(userId);
  const memberRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('member');
  if (memberRole) {
    db.prepare('INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)').run(userId, memberRole.id);
  }
}

function verifyByCode({ userId, code, channel }) {
  const row = db.prepare(
    `SELECT id FROM verification_requests
     WHERE user_id = ? AND channel = ? AND code = ? AND status = 'pending' AND expires_at >= CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`
  ).get(userId, channel, code);

  if (!row) {
    return false;
  }

  db.prepare("UPDATE verification_requests SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  confirmVerification(userId);
  return true;
}

function markPhoneVerificationComplete(userId, code) {
  const row = db.prepare(
    `SELECT id FROM verification_requests
     WHERE user_id = ? AND channel = 'phone' AND code = ? AND status = 'pending' AND expires_at >= CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`
  ).get(userId, code);

  if (!row) {
    return false;
  }

  db.prepare("UPDATE verification_requests SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  confirmVerification(userId);
  return true;
}

function createLogin2FACode(user) {
  const code = generateCode(6);
  db.prepare(
    `INSERT INTO verification_requests(user_id, channel, target, code, expires_at)
     VALUES (?, 'login_2fa', ?, ?, datetime('now', '+5 minutes'))`
  ).run(user.id, user.email || user.phone || user.username, code);
  return code;
}

function verifyLogin2FA(userId, code) {
  const row = db.prepare(
    `SELECT id FROM verification_requests
     WHERE user_id = ? AND channel = 'login_2fa' AND code = ? AND status = 'pending' AND expires_at >= CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`
  ).get(userId, code);

  if (!row) return false;
  db.prepare("UPDATE verification_requests SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  return true;
}

function authenticateUser(identifier, password) {
  const normalized = identifier.toLowerCase();
  const user = db
    .prepare("SELECT * FROM users WHERE lower(coalesce(email, '')) = ? OR username = ? OR phone = ?")
    .get(normalized, identifier, identifier);

  if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
    return { ok: false, reason: '아이디 또는 비밀번호가 올바르지 않습니다.' };
  }

  if (user.is_blocked) {
    return { ok: false, reason: '차단된 사용자입니다. 관리자에게 문의하세요.' };
  }

  if (!user.is_verified) {
    return { ok: false, reason: '이메일/휴대폰 인증 완료 후 로그인 가능합니다.' };
  }

  const global2FA = settingsService.getBooleanSetting('two_factor_required', false);
  return { ok: true, user, require2FA: global2FA || !!user.two_factor_enabled };
}

function getUserRoles(userId) {
  return db
    .prepare(
      `SELECT r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?`
    )
    .all(userId)
    .map((role) => role.name);
}

function getUserById(userId) {
  const user = db
    .prepare('SELECT id, email, phone, student_id, real_name, username, nickname, terms_agreed, privacy_agreed, two_factor_enabled, is_verified, is_blocked, created_at FROM users WHERE id = ?')
    .get(userId);
  if (!user) return null;
  return {
    ...user,
    roles: getUserRoles(userId)
  };
}

function listUsers() {
  const users = db
    .prepare('SELECT id, email, phone, student_id, real_name, username, nickname, terms_agreed, privacy_agreed, two_factor_enabled, is_verified, is_blocked, created_at FROM users ORDER BY id DESC')
    .all();
  return users.map((user) => ({ ...user, roles: getUserRoles(user.id) }));
}

function setTwoFactor(userId, enabled) {
  db.prepare('UPDATE users SET two_factor_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, userId);
}

function findOrCreateOAuthUser({ provider, providerId, email, username }) {
  let user = db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?').get(provider, providerId);
  if (user) {
    return user;
  }

  if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (user) {
      db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, is_verified = 1 WHERE id = ?').run(provider, providerId, user.id);
      confirmVerification(user.id);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }
  }

  const finalUsername = `${username || provider}_${crypto.randomBytes(3).toString('hex')}`;
  const insert = db.prepare(
    `INSERT INTO users(email, username, nickname, oauth_provider, oauth_id, is_verified, terms_agreed, privacy_agreed)
     VALUES (?, ?, ?, ?, ?, 1, 1, 1)`
  ).run(email ? email.toLowerCase() : null, finalUsername, finalUsername, provider, providerId);

  confirmVerification(insert.lastInsertRowid);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);
}

function getUserByContact(identifier) {
  return db.prepare("SELECT id, email, phone, username FROM users WHERE lower(coalesce(email, '')) = ? OR phone = ? OR username = ?").get(identifier.toLowerCase(), identifier, identifier);
}



function createRecoveryCode({ userId, channel, target }) {
  const code = generateCode(8);
  db.prepare(
    `INSERT INTO verification_requests(user_id, channel, target, code, expires_at)
     VALUES (?, ?, ?, ?, datetime('now', '+10 minutes'))`
  ).run(userId, channel, target, code);
  return code;
}

function verifyRecoveryCode({ userId, channel, code }) {
  const row = db.prepare(
    `SELECT id FROM verification_requests
     WHERE user_id = ? AND channel = ? AND code = ? AND status = 'pending' AND expires_at >= CURRENT_TIMESTAMP
     ORDER BY id DESC LIMIT 1`
  ).get(userId, channel, code);

  if (!row) return false;
  db.prepare("UPDATE verification_requests SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
  return true;
}

function findUserByEmailOrPhone(identifier) {
  return db.prepare("SELECT * FROM users WHERE lower(coalesce(email, '')) = ? OR phone = ?").get(identifier.toLowerCase(), identifier);
}

function findUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

function updatePassword(userId, password) {
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

module.exports = {
  createUser,
  createVerificationRequest,
  verifyByCode,
  markPhoneVerificationComplete,
  createLogin2FACode,
  verifyLogin2FA,
  authenticateUser,
  getUserRoles,
  getUserById,
  listUsers,
  setTwoFactor,
  findOrCreateOAuthUser,
  getUserByContact,
  createRecoveryCode,
  verifyRecoveryCode,
  findUserByEmailOrPhone,
  findUserByPhone,
  updatePassword
};
