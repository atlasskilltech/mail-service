const db = require('../config/database');

class Bounce {
  static async create({ email, bounceType, bounceSubtype = null, originalMessageId = null, diagnosticCode = null, feedback = null }) {
    const [result] = await db.execute(
      `INSERT INTO bounces (email, bounce_type, bounce_subtype, original_message_id, diagnostic_code, feedback)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, bounceType, bounceSubtype, originalMessageId, diagnosticCode, feedback]
    );
    return result.insertId;
  }

  static async findByEmail(email, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.execute(
      'SELECT * FROM bounces WHERE email = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [email, limit, offset]
    );
    return rows;
  }

  static async getStats(startDate, endDate) {
    const [rows] = await db.execute(
      `SELECT bounce_type, COUNT(*) as count
       FROM bounces
       WHERE created_at BETWEEN ? AND ?
       GROUP BY bounce_type`,
      [startDate, endDate]
    );
    return rows;
  }

  static async addToSuppressionList(email, reason, notes = null) {
    await db.execute(
      'INSERT IGNORE INTO suppression_list (email, reason, notes) VALUES (?, ?, ?)',
      [email, reason, notes]
    );
  }

  static async isEmailSuppressed(email) {
    const [rows] = await db.execute(
      'SELECT id FROM suppression_list WHERE email = ?',
      [email]
    );
    return rows.length > 0;
  }

  static async removeFromSuppressionList(email) {
    const [result] = await db.execute('DELETE FROM suppression_list WHERE email = ?', [email]);
    return result.affectedRows > 0;
  }

  static async getSuppressionList(limit = 100, offset = 0) {
    const [rows] = await db.execute(
      'SELECT * FROM suppression_list ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [countRow] = await db.execute('SELECT COUNT(*) as total FROM suppression_list');
    return { items: rows, total: countRow[0].total };
  }
}

module.exports = Bounce;
