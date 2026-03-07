const db = require('../config/database');

class ContactList {
  // --- Lists CRUD ---
  static async create({ name, description, color }) {
    const [result] = await db.execute(
      'INSERT INTO contact_lists (name, description, color) VALUES (?, ?, ?)',
      [name, description || null, color || '#3b82f6']
    );
    return result.insertId;
  }

  static async update(id, { name, description, color, isActive }) {
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
    if (isActive !== undefined) { sets.push('is_active = ?'); vals.push(isActive ? 1 : 0); }
    if (!sets.length) return false;
    vals.push(id);
    const [result] = await db.execute(`UPDATE contact_lists SET ${sets.join(', ')} WHERE id = ?`, vals);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    await db.execute('DELETE FROM list_members WHERE list_id = ?', [id]);
    const [result] = await db.execute('DELETE FROM contact_lists WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async findAll() {
    const [rows] = await db.execute(
      `SELECT cl.*, (SELECT COUNT(*) FROM list_members WHERE list_id = cl.id) as member_count
       FROM contact_lists cl ORDER BY cl.name ASC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT cl.*, (SELECT COUNT(*) FROM list_members WHERE list_id = cl.id) as member_count
       FROM contact_lists cl WHERE cl.id = ?`, [id]
    );
    return rows[0] || null;
  }

  // --- Members ---
  static async addMembers(listId, contactIds) {
    if (!contactIds.length) return 0;
    let added = 0;
    for (const cid of contactIds) {
      try {
        await db.execute('INSERT IGNORE INTO list_members (list_id, contact_id) VALUES (?, ?)', [listId, cid]);
        added++;
      } catch (_) { /* duplicate */ }
    }
    return added;
  }

  static async removeMember(listId, contactId) {
    const [result] = await db.execute(
      'DELETE FROM list_members WHERE list_id = ? AND contact_id = ?', [listId, contactId]
    );
    return result.affectedRows > 0;
  }

  static async getMembers(listId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.execute(
      `SELECT c.* FROM contacts c
       INNER JOIN list_members lm ON c.id = lm.contact_id
       WHERE lm.list_id = ? ORDER BY lm.added_at DESC LIMIT ? OFFSET ?`,
      [listId, limit, offset]
    );
    const [countRow] = await db.execute(
      'SELECT COUNT(*) as total FROM list_members WHERE list_id = ?', [listId]
    );
    return { contacts: rows, total: countRow[0].total };
  }

  static async getListsForContact(contactId) {
    const [rows] = await db.execute(
      `SELECT cl.* FROM contact_lists cl
       INNER JOIN list_members lm ON cl.id = lm.list_id
       WHERE lm.contact_id = ?`, [contactId]
    );
    return rows;
  }

  // --- Segments ---
  static async createSegment({ name, description, conditions }) {
    const [result] = await db.execute(
      'INSERT INTO segments (name, description, conditions) VALUES (?, ?, ?)',
      [name, description || null, JSON.stringify(conditions)]
    );
    return result.insertId;
  }

  static async updateSegment(id, { name, description, conditions }) {
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (conditions !== undefined) { sets.push('conditions = ?'); vals.push(JSON.stringify(conditions)); }
    if (!sets.length) return false;
    vals.push(id);
    const [result] = await db.execute(`UPDATE segments SET ${sets.join(', ')} WHERE id = ?`, vals);
    return result.affectedRows > 0;
  }

  static async deleteSegment(id) {
    const [result] = await db.execute('DELETE FROM segments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getSegments() {
    const [rows] = await db.execute('SELECT * FROM segments ORDER BY name ASC');
    return rows;
  }

  static async getSegmentById(id) {
    const [rows] = await db.execute('SELECT * FROM segments WHERE id = ?', [id]);
    return rows[0] || null;
  }

  // Query contacts matching segment conditions
  static async querySegment(conditions, { limit = 50, offset = 0 } = {}) {
    let where = '1=1';
    const params = [];

    for (const cond of conditions) {
      const { field, operator, value } = cond;
      const fieldMap = {
        email: 'email', first_name: 'first_name', last_name: 'last_name',
        city: 'city', country: 'country', company: 'company',
        status: 'status', source: 'source', phone: 'phone'
      };

      const col = fieldMap[field];
      if (!col) continue;

      switch (operator) {
        case 'equals': where += ` AND ${col} = ?`; params.push(value); break;
        case 'not_equals': where += ` AND ${col} != ?`; params.push(value); break;
        case 'contains': where += ` AND ${col} LIKE ?`; params.push(`%${value}%`); break;
        case 'starts_with': where += ` AND ${col} LIKE ?`; params.push(`${value}%`); break;
        case 'ends_with': where += ` AND ${col} LIKE ?`; params.push(`%${value}`); break;
        case 'is_empty': where += ` AND (${col} IS NULL OR ${col} = '')`; break;
        case 'is_not_empty': where += ` AND ${col} IS NOT NULL AND ${col} != ''`; break;
        case 'created_before': where += ' AND created_at < ?'; params.push(value); break;
        case 'created_after': where += ' AND created_at > ?'; params.push(value); break;
      }
    }

    const countParams = [...params];
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT * FROM contacts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params
    );
    const [countRow] = await db.execute(
      `SELECT COUNT(*) as total FROM contacts WHERE ${where}`, countParams
    );

    return { contacts: rows, total: countRow[0].total };
  }
}

module.exports = ContactList;
