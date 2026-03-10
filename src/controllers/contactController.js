const Contact = require('../models/contact');
const ContactList = require('../models/contactList');
const emailVerifyService = require('../services/emailVerifyService');

// --- Contacts CRUD ---
exports.listContacts = async (req, res) => {
  try {
    const { search, status, city, source, listId, limit = 50, offset = 0, sortBy, sortOrder } = req.query;
    const result = await Contact.findAll({
      search, status, city, source,
      listId: listId ? parseInt(listId) : undefined,
      limit: parseInt(limit), offset: parseInt(offset), sortBy, sortOrder
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    const lists = await ContactList.getListsForContact(contact.id);
    res.json({ ...contact, lists });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const { email, firstName, lastName, phone, city, country, company, customFields, tags, source } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existing = await Contact.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Contact with this email already exists' });

    const id = await Contact.create({ email, firstName, lastName, phone, city, country, company, customFields, tags, source });
    const contact = await Contact.findById(id);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const updated = await Contact.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Contact not found or no changes' });
    const contact = await Contact.findById(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const deleted = await Contact.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Bulk Import ---
exports.bulkImport = async (req, res) => {
  try {
    const { contacts, source = 'api_import', listId } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts array is required' });
    }
    if (contacts.length > 5000) {
      return res.status(400).json({ error: 'Max 5000 contacts per import' });
    }

    const result = await Contact.bulkCreate(contacts, source);

    // Add to list if specified
    if (listId) {
      const emails = contacts.map(c => c.email).filter(Boolean);
      const db = require('../config/database');
      const [rows] = await db.execute(
        `SELECT id FROM contacts WHERE email IN (${emails.map(() => '?').join(',')})`, emails
      );
      if (rows.length) {
        await ContactList.addMembers(parseInt(listId), rows.map(r => r.id));
      }
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- CSV Import ---
exports.csvImport = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

    const csvData = req.file.buffer.toString('utf-8');
    const lines = csvData.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + data rows' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const contacts = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || null; });

      if (!obj.email) continue;
      contacts.push({
        email: obj.email,
        firstName: obj.first_name || obj.firstname || obj.name || null,
        lastName: obj.last_name || obj.lastname || null,
        phone: obj.phone || obj.mobile || null,
        city: obj.city || null,
        country: obj.country || null,
        company: obj.company || obj.organization || null
      });
    }

    // Verify emails if requested
    const shouldVerify = req.body.verify === 'true' || req.body.verify === true;
    let verifyResults = null;
    let validContacts = contacts;

    if (shouldVerify) {
      const emails = contacts.map(c => c.email);
      verifyResults = await emailVerifyService.verifyEmails(emails);
      validContacts = contacts.filter(c => {
        const vr = verifyResults.results.find(r => r.email === c.email.trim().toLowerCase());
        return vr && vr.valid;
      });
    }

    const result = await Contact.bulkCreate(validContacts, 'csv_import');

    if (req.body.listId) {
      const db = require('../config/database');
      const emails = validContacts.map(c => c.email);
      if (emails.length) {
        const [rows] = await db.execute(
          `SELECT id FROM contacts WHERE email IN (${emails.map(() => '?').join(',')})`, emails
        );
        if (rows.length) await ContactList.addMembers(parseInt(req.body.listId), rows.map(r => r.id));
      }
    }

    const response = { ...result, total: contacts.length };
    if (verifyResults) {
      response.verification = {
        total: verifyResults.total,
        valid: verifyResults.valid,
        invalid: verifyResults.invalid,
        free: verifyResults.free,
        business: verifyResults.business,
        skippedInvalid: contacts.length - validContacts.length
      };
    }
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Stats & Filters ---
exports.getStats = async (req, res) => {
  try {
    const stats = await Contact.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFilterOptions = async (req, res) => {
  try {
    const options = await Contact.getFilterOptions();
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Subscription ---
exports.unsubscribe = async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await Contact.updateStatus(email, 'unsubscribed');
    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resubscribe = async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await Contact.updateStatus(email, 'subscribed');
    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Resubscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Tags ---
exports.addTag = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ error: 'Tag is required' });
    await Contact.addTag(req.params.id, tag);
    const contact = await Contact.findById(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeTag = async (req, res) => {
  try {
    await Contact.removeTag(req.params.id, req.params.tag);
    const contact = await Contact.findById(req.params.id);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
