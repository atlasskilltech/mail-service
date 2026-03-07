const db = require('../config/database');

class Webhook {
  static async create({ url, events, secret, isActive = true }) {
    const [result] = await db.execute(
      'INSERT INTO webhooks (url, events, secret, is_active) VALUES (?, ?, ?, ?)',
      [url, JSON.stringify(events), secret || null, isActive ? 1 : 0]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM webhooks WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    const webhook = rows[0];
    webhook.events = typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events;
    return webhook;
  }

  static async findAll({ activeOnly = false } = {}) {
    const query = activeOnly
      ? 'SELECT * FROM webhooks WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM webhooks ORDER BY created_at DESC';
    const [rows] = await db.execute(query);
    return rows.map(w => ({
      ...w,
      events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events
    }));
  }

  static async findByEvent(event) {
    const [rows] = await db.execute(
      'SELECT * FROM webhooks WHERE is_active = 1 AND JSON_CONTAINS(events, ?)',
      [JSON.stringify(event)]
    );
    return rows.map(w => ({
      ...w,
      events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events
    }));
  }

  static async update(id, { url, events, secret, isActive }) {
    const fields = [];
    const values = [];

    if (url !== undefined) { fields.push('url = ?'); values.push(url); }
    if (events !== undefined) { fields.push('events = ?'); values.push(JSON.stringify(events)); }
    if (secret !== undefined) { fields.push('secret = ?'); values.push(secret); }
    if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }

    if (fields.length === 0) return false;

    values.push(id);
    const [result] = await db.execute(
      `UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const [result] = await db.execute('DELETE FROM webhooks WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async recordFailure(id) {
    await db.execute(
      'UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?',
      [id]
    );
  }

  static async recordSuccess(id) {
    await db.execute(
      'UPDATE webhooks SET failure_count = 0, last_triggered_at = NOW() WHERE id = ?',
      [id]
    );
  }
}

module.exports = Webhook;
