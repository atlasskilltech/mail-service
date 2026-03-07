const db = require('../config/database');

class EmailLog {
  static async create({ sender, recipient, subject, template, status = 'pending', metadata = null }) {
    const [result] = await db.execute(
      `INSERT INTO email_logs (sender, recipient, subject, template, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sender || null, recipient, subject, template || null, status, metadata ? JSON.stringify(metadata) : null]
    );
    return result.insertId;
  }

  static async updateStatus(id, status, { messageId = null, errorMessage = null } = {}) {
    const fields = ['status = ?'];
    const values = [status];

    if (messageId) {
      fields.push('message_id = ?');
      values.push(messageId);
    }
    if (errorMessage) {
      fields.push('error_message = ?');
      values.push(errorMessage);
    }
    if (status === 'sent') {
      fields.push('sent_at = NOW()');
    }

    values.push(id);
    await db.execute(
      `UPDATE email_logs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async incrementRetry(id) {
    await db.execute(
      'UPDATE email_logs SET retry_count = retry_count + 1 WHERE id = ?',
      [id]
    );
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM email_logs WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByMessageId(messageId) {
    const [rows] = await db.execute('SELECT * FROM email_logs WHERE message_id = ?', [messageId]);
    return rows[0] || null;
  }

  static async findByRecipient(recipient, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.execute(
      'SELECT * FROM email_logs WHERE recipient = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [recipient, limit, offset]
    );
    return rows;
  }

  static async findByStatus(status, limit = 100) {
    const [rows] = await db.execute(
      'SELECT * FROM email_logs WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      [status, limit]
    );
    return rows;
  }

  static async getStats(startDate, endDate) {
    const [rows] = await db.execute(
      `SELECT status, COUNT(*) as count
       FROM email_logs
       WHERE created_at BETWEEN ? AND ?
       GROUP BY status`,
      [startDate, endDate]
    );

    const [totalRow] = await db.execute(
      `SELECT COUNT(*) as total FROM email_logs WHERE created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    return {
      breakdown: rows,
      total: totalRow[0].total
    };
  }

  static async deleteOlderThan(days) {
    const [result] = await db.execute(
      'DELETE FROM email_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = EmailLog;
