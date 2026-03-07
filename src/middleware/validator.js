const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSendEmail(req, res, next) {
  const { to, subject, template, html, text } = req.body;

  const errors = [];

  if (!to) {
    errors.push('Recipient (to) is required');
  } else if (typeof to === 'string' && !EMAIL_REGEX.test(to)) {
    errors.push('Invalid recipient email address');
  } else if (Array.isArray(to)) {
    const invalid = to.filter((e) => !EMAIL_REGEX.test(e));
    if (invalid.length > 0) {
      errors.push(`Invalid email addresses: ${invalid.join(', ')}`);
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
  const { recipients } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Recipients array is required and must not be empty' });
  }

  if (recipients.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 recipients per bulk request' });
  }

  for (const r of recipients) {
    if (!r.to || !EMAIL_REGEX.test(r.to)) {
      return res.status(400).json({ error: `Invalid email: ${r.to}` });
    }
  }

  next();
}

function validateTemplate(req, res, next) {
  const { name, subject, bodyHtml } = req.body;

  const errors = [];
  if (!name) errors.push('Template name is required');
  if (!subject) errors.push('Subject is required');
  if (!bodyHtml) errors.push('HTML body is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

module.exports = { validateSendEmail, validateBulkSend, validateTemplate };
