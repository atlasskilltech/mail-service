const db = require('../config/database');

class EmailTemplate {
  static async findByName(name) {
    const [rows] = await db.execute(
      'SELECT * FROM email_templates WHERE name = ? AND is_active = 1',
      [name]
    );
    return rows[0] || null;
  }

  static async findAll() {
    const [rows] = await db.execute(
      'SELECT id, name, subject, variables, is_active, created_at, updated_at FROM email_templates ORDER BY name'
    );
    return rows;
  }

  static async create({ name, subject, bodyHtml, bodyText = null, variables = null }) {
    const [result] = await db.execute(
      `INSERT INTO email_templates (name, subject, body_html, body_text, variables)
       VALUES (?, ?, ?, ?, ?)`,
      [name, subject, bodyHtml, bodyText, variables ? JSON.stringify(variables) : null]
    );
    return result.insertId;
  }

  static async update(id, { subject, bodyHtml, bodyText, variables, isActive }) {
    const fields = [];
    const values = [];

    if (subject !== undefined) { fields.push('subject = ?'); values.push(subject); }
    if (bodyHtml !== undefined) { fields.push('body_html = ?'); values.push(bodyHtml); }
    if (bodyText !== undefined) { fields.push('body_text = ?'); values.push(bodyText); }
    if (variables !== undefined) { fields.push('variables = ?'); values.push(JSON.stringify(variables)); }
    if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }

    if (fields.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE email_templates SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async delete(id) {
    await db.execute('DELETE FROM email_templates WHERE id = ?', [id]);
  }
}

module.exports = EmailTemplate;
