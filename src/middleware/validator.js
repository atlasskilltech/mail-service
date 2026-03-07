const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

function validateSendEmail(req, res, next) {
  const { to, subject, template, html, text, from, replyTo } = req.body;

  const errors = [];

  if (!to) {
    errors.push('Recipient (to) is required');
  } else if (typeof to === 'string' && !validateEmail(to)) {
    errors.push('Invalid recipient email address');
  } else if (Array.isArray(to)) {
    if (to.length === 0) {
      errors.push('Recipients array must not be empty');
    }
    const invalid = to.filter((e) => !validateEmail(e));
    if (invalid.length > 0) {
      errors.push(`Invalid email addresses: ${invalid.join(', ')}`);
    }
  }

  if (from && !validateEmail(from)) {
    errors.push('Invalid sender (from) email address');
  }

  if (replyTo) {
    const replyAddresses = Array.isArray(replyTo) ? replyTo : [replyTo];
    const invalidReply = replyAddresses.filter((e) => !validateEmail(e));
    if (invalidReply.length > 0) {
      errors.push(`Invalid replyTo email addresses: ${invalidReply.join(', ')}`);
    }
  }

  if (!template && !html && !text) {
    errors.push('Either template, html, or text content is required');
  }

  if (!template && !subject) {
    errors.push('Subject is required when not using a template');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateBulkSend(req, res, next) {
  const { recipients, template } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Recipients array is required and must not be empty' });
  }

  if (recipients.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 recipients per bulk request' });
  }

  if (!template) {
    return res.status(400).json({ error: 'Template is required for bulk send' });
  }

  for (const r of recipients) {
    if (!r.to || !validateEmail(r.to)) {
      return res.status(400).json({ error: `Invalid email: ${r.to}` });
    }
  }

  next();
}

function validateTemplate(req, res, next) {
  const { name, subject, bodyHtml } = req.body;

  const errors = [];
  if (!name) {
    errors.push('Template name is required');
  } else if (!TEMPLATE_NAME_REGEX.test(name)) {
    errors.push('Template name can only contain letters, numbers, hyphens, and underscores');
  }
  if (!subject) errors.push('Subject is required');
  if (!bodyHtml) errors.push('HTML body is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateSuppressionAdd(req, res, next) {
  const { email, reason } = req.body;

  const errors = [];
  if (!email || !validateEmail(email)) {
    errors.push('Valid email address is required');
  }
  if (reason && !['hard_bounce', 'complaint', 'manual'].includes(reason)) {
    errors.push('Reason must be one of: hard_bounce, complaint, manual');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

module.exports = { validateSendEmail, validateBulkSend, validateTemplate, validateSuppressionAdd };
