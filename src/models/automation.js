const db = require('../config/database');

class Automation {
  // --- Automation CRUD ---
  static async create({ name, description, triggerType, triggerConfig }) {
    const [result] = await db.execute(
      'INSERT INTO automations (name, description, trigger_type, trigger_config) VALUES (?, ?, ?, ?)',
      [name, description || null, triggerType, triggerConfig ? JSON.stringify(triggerConfig) : null]
    );
    return result.insertId;
  }

  static async update(id, fields) {
    const sets = [];
    const vals = [];
    if (fields.name !== undefined) { sets.push('name = ?'); vals.push(fields.name); }
    if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description); }
    if (fields.triggerType !== undefined) { sets.push('trigger_type = ?'); vals.push(fields.triggerType); }
    if (fields.triggerConfig !== undefined) { sets.push('trigger_config = ?'); vals.push(JSON.stringify(fields.triggerConfig)); }
    if (fields.isActive !== undefined) { sets.push('is_active = ?'); vals.push(fields.isActive ? 1 : 0); }
    if (!sets.length) return false;
    vals.push(id);
    const [result] = await db.execute(`UPDATE automations SET ${sets.join(', ')} WHERE id = ?`, vals);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    await db.execute('DELETE FROM automation_enrollments WHERE automation_id = ?', [id]);
    await db.execute('DELETE FROM automation_steps WHERE automation_id = ?', [id]);
    const [result] = await db.execute('DELETE FROM automations WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM automations WHERE id = ?', [id]);
    const automation = rows[0] || null;
    if (automation && typeof automation.trigger_config === 'string') {
      automation.trigger_config = JSON.parse(automation.trigger_config);
    }
    return automation;
  }

  static async findAll({ isActive } = {}) {
    let where = '1=1';
    const params = [];
    if (isActive !== undefined) { where += ' AND is_active = ?'; params.push(isActive ? 1 : 0); }
    const [rows] = await db.execute(`SELECT * FROM automations WHERE ${where} ORDER BY created_at DESC`, params);
    return rows;
  }

  static async findByTrigger(triggerType) {
    const [rows] = await db.execute(
      'SELECT * FROM automations WHERE trigger_type = ? AND is_active = 1', [triggerType]
    );
    return rows;
  }

  // --- Steps ---
  static async addStep(automationId, { stepOrder, actionType, config }) {
    const [result] = await db.execute(
      'INSERT INTO automation_steps (automation_id, step_order, action_type, config) VALUES (?, ?, ?, ?)',
      [automationId, stepOrder, actionType, JSON.stringify(config)]
    );
    return result.insertId;
  }

  static async updateStep(stepId, { actionType, config }) {
    const sets = [];
    const vals = [];
    if (actionType !== undefined) { sets.push('action_type = ?'); vals.push(actionType); }
    if (config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(config)); }
    if (!sets.length) return false;
    vals.push(stepId);
    const [result] = await db.execute(`UPDATE automation_steps SET ${sets.join(', ')} WHERE id = ?`, vals);
    return result.affectedRows > 0;
  }

  static async deleteStep(stepId) {
    const [result] = await db.execute('DELETE FROM automation_steps WHERE id = ?', [stepId]);
    return result.affectedRows > 0;
  }

  static async getSteps(automationId) {
    const [rows] = await db.execute(
      'SELECT * FROM automation_steps WHERE automation_id = ? ORDER BY step_order ASC', [automationId]
    );
    return rows.map(row => {
      if (typeof row.config === 'string') row.config = JSON.parse(row.config);
      return row;
    });
  }

  static async getStepByOrder(automationId, stepOrder) {
    const [rows] = await db.execute(
      'SELECT * FROM automation_steps WHERE automation_id = ? AND step_order = ?', [automationId, stepOrder]
    );
    const step = rows[0] || null;
    if (step && typeof step.config === 'string') step.config = JSON.parse(step.config);
    return step;
  }

  // --- Enrollments ---
  static async enrollContact(automationId, contactId) {
    try {
      const [result] = await db.execute(
        'INSERT INTO automation_enrollments (automation_id, contact_id, current_step, status, next_action_at) VALUES (?, ?, 1, ?, NOW())',
        [automationId, contactId, 'active']
      );
      await db.execute('UPDATE automations SET total_entered = total_entered + 1 WHERE id = ?', [automationId]);
      return result.insertId;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return null;
      throw err;
    }
  }

  static async getEnrollment(automationId, contactId) {
    const [rows] = await db.execute(
      'SELECT * FROM automation_enrollments WHERE automation_id = ? AND contact_id = ?',
      [automationId, contactId]
    );
    return rows[0] || null;
  }

  static async getActiveEnrollments({ limit = 100 } = {}) {
    const [rows] = await db.execute(
      `SELECT ae.*, a.name as automation_name FROM automation_enrollments ae
       JOIN automations a ON ae.automation_id = a.id
       WHERE ae.status = 'active' AND ae.next_action_at <= NOW() AND a.is_active = 1
       ORDER BY ae.next_action_at ASC LIMIT ?`,
      [limit]
    );
    return rows;
  }

  static async advanceEnrollment(enrollmentId, nextStep, nextActionAt) {
    await db.execute(
      'UPDATE automation_enrollments SET current_step = ?, next_action_at = ? WHERE id = ?',
      [nextStep, nextActionAt, enrollmentId]
    );
  }

  static async completeEnrollment(enrollmentId, automationId) {
    await db.execute(
      "UPDATE automation_enrollments SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [enrollmentId]
    );
    await db.execute('UPDATE automations SET total_completed = total_completed + 1 WHERE id = ?', [automationId]);
  }

  static async failEnrollment(enrollmentId) {
    await db.execute(
      "UPDATE automation_enrollments SET status = 'failed' WHERE id = ?",
      [enrollmentId]
    );
  }

  static async getEnrollments(automationId, { status, limit = 50, offset = 0 } = {}) {
    let where = 'ae.automation_id = ?';
    const params = [automationId];
    if (status) { where += ' AND ae.status = ?'; params.push(status); }
    params.push(limit, offset);

    const [rows] = await db.execute(
      `SELECT ae.*, c.email, c.first_name, c.last_name FROM automation_enrollments ae
       LEFT JOIN contacts c ON ae.contact_id = c.id
       WHERE ${where} ORDER BY ae.created_at DESC LIMIT ? OFFSET ?`, params
    );
    return rows;
  }
}

module.exports = Automation;
