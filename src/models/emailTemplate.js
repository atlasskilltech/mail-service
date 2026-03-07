const db = require('../config/database');

class EmailTemplate {
  static async findByName(name) {
    const [rows] = await db.execute(
      'SELECT * FROM email_templates WHERE name = ? AND is_active = 1',
      [name]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM email_templates WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findAll({ activeOnly = false } = {}) {
    const query = activeOnly
      ? 'SELECT id, name, subject, description, variables, is_active, version, created_at, updated_at FROM email_templates WHERE is_active = 1 ORDER BY name'
      : 'SELECT id, name, subject, description, variables, is_active, version, created_at, updated_at FROM email_templates ORDER BY name';
    const [rows] = await db.execute(query);
    return rows;
  }

  static async create({ name, subject, bodyHtml, bodyText = null, variables = null, description = null }) {
    const [result] = await db.execute(
      `INSERT INTO email_templates (name, subject, body_html, body_text, variables, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, subject, bodyHtml, bodyText, variables ? JSON.stringify(variables) : null, description]
    );
    return result.insertId;
  }

  static async update(id, { subject, bodyHtml, bodyText, variables, isActive, description }) {
    const fields = [];
    const values = [];

    if (subject !== undefined) { fields.push('subject = ?'); values.push(subject); }
    if (bodyHtml !== undefined) { fields.push('body_html = ?'); values.push(bodyHtml); }
    if (bodyText !== undefined) { fields.push('body_text = ?'); values.push(bodyText); }
    if (variables !== undefined) { fields.push('variables = ?'); values.push(JSON.stringify(variables)); }
    if (isActive !== undefined) { fields.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }

    if (fields.length === 0) return;

    fields.push('version = version + 1');
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
