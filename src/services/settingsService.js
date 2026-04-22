const { getDb } = require('../db');

const db = getDb();

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO system_settings(key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, value);
}

function getBooleanSetting(key, fallback = false) {
  const value = getSetting(key);
  if (value === null || value === undefined) {
    return fallback;
  }
  return value === 'true';
}

module.exports = {
  getSetting,
  setSetting,
  getBooleanSetting
};
