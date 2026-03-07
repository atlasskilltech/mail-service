const ContactList = require('../models/contactList');

// --- Lists CRUD ---
exports.listAll = async (req, res) => {
  try {
    const lists = await ContactList.findAll();
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getList = async (req, res) => {
  try {
    const list = await ContactList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createList = async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = await ContactList.create({ name, description, color });
    const list = await ContactList.findById(id);
    res.status(201).json(list);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'List name already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.updateList = async (req, res) => {
  try {
    const updated = await ContactList.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'List not found' });
    const list = await ContactList.findById(req.params.id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteList = async (req, res) => {
  try {
    const deleted = await ContactList.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'List not found' });
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Members ---
exports.getMembers = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await ContactList.getMembers(req.params.id, {
      limit: parseInt(limit), offset: parseInt(offset)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMembers = async (req, res) => {
  try {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || !contactIds.length) {
      return res.status(400).json({ error: 'contactIds array is required' });
    }
    const added = await ContactList.addMembers(req.params.id, contactIds);
    res.json({ added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const removed = await ContactList.removeMember(req.params.id, req.params.contactId);
    if (!removed) return res.status(404).json({ error: 'Member not found in list' });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Segments ---
exports.listSegments = async (req, res) => {
  try {
    const segments = await ContactList.getSegments();
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSegment = async (req, res) => {
  try {
    const { name, description, conditions } = req.body;
    if (!name || !conditions) return res.status(400).json({ error: 'Name and conditions are required' });
    const id = await ContactList.createSegment({ name, description, conditions });
    const segment = await ContactList.getSegmentById(id);
    res.status(201).json(segment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSegment = async (req, res) => {
  try {
    const updated = await ContactList.updateSegment(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Segment not found' });
    const segment = await ContactList.getSegmentById(req.params.id);
    res.json(segment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSegment = async (req, res) => {
  try {
    const deleted = await ContactList.deleteSegment(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Segment not found' });
    res.json({ message: 'Segment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.querySegment = async (req, res) => {
  try {
    const segment = await ContactList.getSegmentById(req.params.id);
    if (!segment) return res.status(404).json({ error: 'Segment not found' });
    const conditions = typeof segment.conditions === 'string' ? JSON.parse(segment.conditions) : segment.conditions;
    const { limit = 50, offset = 0 } = req.query;
    const result = await ContactList.querySegment(conditions, { limit: parseInt(limit), offset: parseInt(offset) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.previewSegment = async (req, res) => {
  try {
    const { conditions } = req.body;
    if (!conditions) return res.status(400).json({ error: 'Conditions are required' });
    const { limit = 20, offset = 0 } = req.query;
    const result = await ContactList.querySegment(conditions, { limit: parseInt(limit), offset: parseInt(offset) });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
