const { getDb } = require('../db');

const db = getDb();

function logEvent({ actorUserId = null, action, targetType = null, targetId = null, metadata = null, ipAddress = null }) {
  db.prepare(
    `INSERT INTO audit_logs(actor_user_id, action, target_type, target_id, metadata, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(actorUserId, action, targetType, targetId, metadata ? JSON.stringify(metadata) : null, ipAddress);
}

function listRecent(limit = 200) {
  return db
    .prepare(
      `SELECT id, actor_user_id, action, target_type, target_id, metadata, ip_address, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit)
    .map((row) => ({ ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null }));
}

module.exports = {
  logEvent,
  listRecent
};
