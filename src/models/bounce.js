const db = require('../config/database');

class Bounce {
  static async create({ email, bounceType, bounceSubtype = null, originalMessageId = null, feedback = null }) {
    const [result] = await db.execute(
      `INSERT INTO bounces (email, bounce_type, bounce_subtype, original_message_id, feedback)
       VALUES (?, ?, ?, ?, ?)`,
      [email, bounceType, bounceSubtype, originalMessageId, feedback]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute(
      'SELECT * FROM bounces WHERE email = ? ORDER BY created_at DESC',
      [email]
    );
    return rows;
  }

  static async addToSuppressionList(email, reason) {
    await db.execute(
      'INSERT IGNORE INTO suppression_list (email, reason) VALUES (?, ?)',
      [email, reason]
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
    await db.execute('DELETE FROM suppression_list WHERE email = ?', [email]);
  }

  static async getSuppressionList(limit = 100, offset = 0) {
    const [rows] = await db.execute(
      'SELECT * FROM suppression_list ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }
}

module.exports = Bounce;
