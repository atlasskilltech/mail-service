const dns = require('dns');
const logger = require('../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'trashmail.com', 'fakeinbox.com', 'maildrop.cc',
  'temp-mail.org', 'getairmail.com', 'mohmal.com'
]);

class EmailVerifyService {
  /**
   * Verify a single email address
   * Returns: { email, valid, reason, details: { format, domain, mx, disposable } }
   */
  async verifyEmail(email) {
    const result = {
      email,
      valid: false,
      reason: '',
      details: {
        format: false,
        domain: false,
        mx: false,
        disposable: false
      }
    };

    // 1. Format check
    if (!email || typeof email !== 'string') {
      result.reason = 'Invalid email format';
      return result;
    }

    email = email.trim().toLowerCase();
    result.email = email;

    if (!EMAIL_REGEX.test(email)) {
      result.reason = 'Invalid email format';
      return result;
    }
    result.details.format = true;

    // 2. Extract domain
    const domain = email.split('@')[1];

    // 3. Check disposable
    if (DISPOSABLE_DOMAINS.has(domain)) {
      result.details.disposable = true;
      result.reason = 'Disposable email address';
      return result;
    }

    // 4. DNS / MX check
    try {
      const mxRecords = await this.lookupMX(domain);
      if (mxRecords && mxRecords.length > 0) {
        result.details.domain = true;
        result.details.mx = true;
        result.valid = true;
        result.reason = 'Valid email address';
      } else {
        // Fallback: check A record
        const hasA = await this.lookupA(domain);
        if (hasA) {
          result.details.domain = true;
          result.valid = true;
          result.reason = 'Valid (no MX record, but domain exists)';
        } else {
          result.reason = 'Domain has no mail server (no MX/A records)';
        }
      }
    } catch (err) {
      logger.warn(`DNS lookup failed for ${domain}: ${err.message}`);
      result.reason = 'Domain does not exist';
    }

    return result;
  }

  /**
   * Verify multiple emails at once
   */
  async verifyEmails(emails) {
    const results = [];
    for (const email of emails) {
      const result = await this.verifyEmail(email);
      results.push(result);
    }
    return {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      results
    };
  }

  lookupMX(domain) {
    return new Promise((resolve, reject) => {
      dns.resolveMx(domain, (err, addresses) => {
        if (err) {
          if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
            resolve([]);
          } else {
            reject(err);
          }
        } else {
          resolve(addresses.sort((a, b) => a.priority - b.priority));
        }
      });
    });
  }

  lookupA(domain) {
    return new Promise((resolve) => {
      dns.resolve4(domain, (err, addresses) => {
        resolve(!err && addresses && addresses.length > 0);
      });
    });
  }
}

module.exports = new EmailVerifyService();
