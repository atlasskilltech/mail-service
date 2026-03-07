const db = require('../config/database');

class Contact {
  // Create a single contact
  static async create({ email, firstName, lastName, phone, city, country, company, customFields, tags, source }) {
    const [result] = await db.execute(
      `INSERT INTO contacts (email, first_name, last_name, phone, city, country, company, custom_fields, tags, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, firstName || null, lastName || null, phone || null, city || null, country || null,
       company || null, customFields ? JSON.stringify(customFields) : null,
       tags ? JSON.stringify(tags) : null, source || 'manual']
    );
    return result.insertId;
  }

  // Update contact
  static async update(id, fields) {
    const allowed = ['first_name', 'last_name', 'phone', 'city', 'country', 'company', 'status', 'custom_fields', 'tags'];
    const fieldMap = {
      firstName: 'first_name', lastName: 'last_name', phone: 'phone',
      city: 'city', country: 'country', company: 'company', status: 'status',
      customFields: 'custom_fields', tags: 'tags'
    };

    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      const col = fieldMap[key] || key;
      if (!allowed.includes(col)) continue;
      sets.push(`${col} = ?`);
      values.push((col === 'custom_fields' || col === 'tags') ? JSON.stringify(val) : val);
    }
    if (sets.length === 0) return false;
    values.push(id);
    const [result] = await db.execute(`UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, values);
    return result.affectedRows > 0;
  }

  // Find by ID
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM contacts WHERE id = ?', [id]);
    return rows[0] || null;
  }

  // Find by email
  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM contacts WHERE email = ?', [email]);
    return rows[0] || null;
  }

  // Delete
  static async delete(id) {
    await db.execute('DELETE FROM list_members WHERE contact_id = ?', [id]);
    const [result] = await db.execute('DELETE FROM contacts WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // List with search, filter, pagination
  static async findAll({ search, status, city, source, tags, listId, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    let where = '1=1';
    const params = [];

    if (search) {
      where += ' AND (c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) { where += ' AND c.status = ?'; params.push(status); }
    if (city) { where += ' AND c.city = ?'; params.push(city); }
    if (source) { where += ' AND c.source = ?'; params.push(source); }
    if (tags) { where += ' AND JSON_CONTAINS(c.tags, ?)'; params.push(JSON.stringify(tags)); }

    let join = '';
    if (listId) {
      join = 'INNER JOIN list_members lm ON c.id = lm.contact_id AND lm.list_id = ?';
      params.unshift(listId);
    }

    const allowedSort = ['created_at', 'email', 'first_name', 'last_name', 'city', 'status'];
    const col = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countParams = [...params];
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT c.* FROM contacts c ${join} WHERE ${where} ORDER BY c.${col} ${order} LIMIT ? OFFSET ?`, params
    );
    const [countRow] = await db.execute(
      `SELECT COUNT(*) as total FROM contacts c ${join} WHERE ${where}`, countParams
    );

    return { contacts: rows, total: countRow[0].total };
  }

  // Bulk create (CSV import)
  static async bulkCreate(contacts, source = 'csv_import') {
    if (!contacts.length) return { imported: 0, skipped: 0 };
    let imported = 0, skipped = 0;

    for (const c of contacts) {
      try {
        await db.execute(
          `INSERT INTO contacts (email, first_name, last_name, phone, city, country, company, custom_fields, tags, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             first_name = COALESCE(VALUES(first_name), first_name),
             last_name = COALESCE(VALUES(last_name), last_name),
             phone = COALESCE(VALUES(phone), phone),
             city = COALESCE(VALUES(city), city),
             country = COALESCE(VALUES(country), country),
             company = COALESCE(VALUES(company), company),
             custom_fields = COALESCE(VALUES(custom_fields), custom_fields)`,
          [c.email, c.firstName || c.first_name || null, c.lastName || c.last_name || null,
           c.phone || null, c.city || null, c.country || null, c.company || null,
           c.customFields || c.custom_fields ? JSON.stringify(c.customFields || c.custom_fields) : null,
           c.tags ? JSON.stringify(c.tags) : null, source]
        );
        imported++;
      } catch (err) {
        skipped++;
      }
    }
    return { imported, skipped };
  }

  // Get aggregate stats
  static async getStats() {
    const [statusRows] = await db.execute(
      'SELECT status, COUNT(*) as count FROM contacts GROUP BY status'
    );
    const [sourceRows] = await db.execute(
      'SELECT source, COUNT(*) as count FROM contacts GROUP BY source ORDER BY count DESC LIMIT 10'
    );
    const [cityRows] = await db.execute(
      'SELECT city, COUNT(*) as count FROM contacts WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 10'
    );
    const [totalRow] = await db.execute('SELECT COUNT(*) as total FROM contacts');
    const [recentRow] = await db.execute(
      'SELECT COUNT(*) as count FROM contacts WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );

    return {
      total: totalRow[0].total,
      last30Days: recentRow[0].count,
      byStatus: statusRows,
      bySource: sourceRows,
      byCity: cityRows
    };
  }

  // Update status (subscribe/unsubscribe)
  static async updateStatus(email, status) {
    const [result] = await db.execute('UPDATE contacts SET status = ? WHERE email = ?', [status, email]);
    return result.affectedRows > 0;
  }

  // Get distinct values for filters
  static async getFilterOptions() {
    const [cities] = await db.execute(
      'SELECT DISTINCT city FROM contacts WHERE city IS NOT NULL ORDER BY city LIMIT 100'
    );
    const [sources] = await db.execute(
      'SELECT DISTINCT source FROM contacts ORDER BY source'
    );
    return {
      cities: cities.map(r => r.city),
      sources: sources.map(r => r.source)
    };
  }

  // Tag operations
  static async addTag(id, tag) {
    await db.execute(
      `UPDATE contacts SET tags = JSON_ARRAY_APPEND(COALESCE(tags, '[]'), '$', ?) WHERE id = ?`,
      [tag, id]
    );
  }

  static async removeTag(id, tag) {
    const contact = await Contact.findById(id);
    if (!contact || !contact.tags) return;
    const tags = (typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags).filter(t => t !== tag);
    await db.execute('UPDATE contacts SET tags = ? WHERE id = ?', [JSON.stringify(tags), id]);
  }
}

module.exports = Contact;
