const { getDb } = require('../db');

const db = getDb();

function listRoles() {
  return db.prepare('SELECT id, name, description FROM roles ORDER BY id ASC').all();
}

function setUserBlocked(userId, blocked) {
  db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, userId);
}

function assignRole(userId, roleName) {
  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
  if (!role) {
    throw new Error('존재하지 않는 역할입니다.');
  }
  db.prepare('INSERT OR IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)').run(userId, role.id);
}

function revokeRole(userId, roleName) {
  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
  if (!role) {
    throw new Error('존재하지 않는 역할입니다.');
  }
  db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(userId, role.id);
}

function listBlockedIps() {
  return db.prepare('SELECT * FROM blocked_ips ORDER BY id DESC').all();
}

function addBlockedIp(ipAddress, reason) {
  db.prepare('INSERT INTO blocked_ips(ip_address, reason) VALUES (?, ?)').run(ipAddress, reason || null);
}

function removeBlockedIp(ipAddress) {
  db.prepare('DELETE FROM blocked_ips WHERE ip_address = ?').run(ipAddress);
}

function isIpBlocked(ipAddress) {
  return !!db.prepare('SELECT id FROM blocked_ips WHERE ip_address = ?').get(ipAddress);
}

module.exports = {
  listRoles,
  setUserBlocked,
  assignRole,
  revokeRole,
  listBlockedIps,
  addBlockedIp,
  removeBlockedIp,
  isIpBlocked
};
