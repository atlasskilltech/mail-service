const db = require('../config/database');

class ApiKey {
  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, key_name, api_key, is_active, rate_limit, last_used_at, expires_at, created_at FROM api_keys ORDER BY created_at DESC'
    );
    return rows.map(r => ({
      ...r,
      api_key: r.api_key.substring(0, 8) + '...' + r.api_key.substring(r.api_key.length - 4)
    }));
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, key_name, is_active, rate_limit, last_used_at, expires_at, created_at FROM api_keys WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  static async create({ keyName, rateLimit = 100, expiresAt = null }) {
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');
    const apiKey = `ms_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = await bcrypt.hash(apiKey, 10);

    const [result] = await db.execute(
      'INSERT INTO api_keys (key_name, api_key, hashed_key, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?)',
      [keyName, apiKey, hashedKey, rateLimit, expiresAt]
    );

    return { id: result.insertId, apiKey, keyName };
  }

  static async update(id, { keyName, rateLimit, isActive, expiresAt }) {
    const fields = [];
    const values = [];

    if (keyName !== undefined) { fields.push('key_name = ?'); values.push(keyName); }
    if (rateLimit !== undefined) { fields.push('rate_limit = ?'); values.push(rateLimit); }
    if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(expiresAt); }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await db.execute(
      `UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async revoke(id) {
    const [result] = await db.execute('UPDATE api_keys SET is_active = 0 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.execute('DELETE FROM api_keys WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = ApiKey;
