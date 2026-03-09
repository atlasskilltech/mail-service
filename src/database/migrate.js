const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const migrations = [
  // Email logs table
  `CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id VARCHAR(255) DEFAULT NULL,
    sender VARCHAR(255) DEFAULT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    template VARCHAR(255) DEFAULT NULL,
    status ENUM('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced') NOT NULL DEFAULT 'pending',
    retry_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_retries INT UNSIGNED NOT NULL DEFAULT 3,
    error_message TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_recipient (recipient),
    INDEX idx_status (status),
    INDEX idx_message_id (message_id),
    INDEX idx_created_at (created_at),
    INDEX idx_template (template),
    INDEX idx_status_created (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Email templates table
  `CREATE TABLE IF NOT EXISTS email_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT DEFAULT NULL,
    variables JSON DEFAULT NULL,
    description VARCHAR(500) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Bounce records table
  `CREATE TABLE IF NOT EXISTS bounces (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    bounce_type ENUM('hard', 'soft', 'complaint') NOT NULL,
    bounce_subtype VARCHAR(100) DEFAULT NULL,
    original_message_id VARCHAR(255) DEFAULT NULL,
    diagnostic_code VARCHAR(500) DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_bounce_type (bounce_type),
    INDEX idx_created_at (created_at),
    INDEX idx_message_id (original_message_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Suppression list
  `CREATE TABLE IF NOT EXISTS suppression_list (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    reason ENUM('hard_bounce', 'complaint', 'manual') NOT NULL,
    notes VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // API keys table
  `CREATE TABLE IF NOT EXISTS api_keys (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    hashed_key VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    rate_limit INT UNSIGNED NOT NULL DEFAULT 100,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_api_key (api_key),
    INDEX idx_is_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Webhooks table for event notifications
  `CREATE TABLE IF NOT EXISTS webhooks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(2048) NOT NULL,
    events JSON NOT NULL,
    secret VARCHAR(255) DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failure_count INT UNSIGNED NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Contacts table
  `CREATE TABLE IF NOT EXISTS contacts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) DEFAULT NULL,
    last_name VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    city VARCHAR(255) DEFAULT NULL,
    country VARCHAR(255) DEFAULT NULL,
    company VARCHAR(255) DEFAULT NULL,
    status ENUM('subscribed', 'unsubscribed', 'bounced', 'complained') NOT NULL DEFAULT 'subscribed',
    custom_fields JSON DEFAULT NULL,
    tags JSON DEFAULT NULL,
    source VARCHAR(100) DEFAULT 'manual',
    last_emailed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_city (city),
    INDEX idx_source (source),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Contact Lists table
  `CREATE TABLE IF NOT EXISTS contact_lists (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(500) DEFAULT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // List Members (many-to-many: contacts <-> lists)
  `CREATE TABLE IF NOT EXISTS list_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    list_id INT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_list_contact (list_id, contact_id),
    INDEX idx_list_id (list_id),
    INDEX idx_contact_id (contact_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Segments table (saved filters)
  `CREATE TABLE IF NOT EXISTS segments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    conditions JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Campaigns table
  `CREATE TABLE IF NOT EXISTS campaigns (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    template_id INT UNSIGNED DEFAULT NULL,
    list_id INT UNSIGNED DEFAULT NULL,
    segment_id INT UNSIGNED DEFAULT NULL,
    sender_email VARCHAR(255) DEFAULT NULL,
    reply_to VARCHAR(255) DEFAULT NULL,
    template_data JSON DEFAULT NULL,
    status ENUM('draft', 'scheduled', 'sending', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMP NULL DEFAULT NULL,
    started_at TIMESTAMP NULL DEFAULT NULL,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    total_recipients INT UNSIGNED NOT NULL DEFAULT 0,
    sent_count INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count INT UNSIGNED NOT NULL DEFAULT 0,
    open_count INT UNSIGNED NOT NULL DEFAULT 0,
    click_count INT UNSIGNED NOT NULL DEFAULT 0,
    bounce_count INT UNSIGNED NOT NULL DEFAULT 0,
    unsubscribe_count INT UNSIGNED NOT NULL DEFAULT 0,
    tags JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_list_id (list_id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Campaign recipients tracking
  `CREATE TABLE IF NOT EXISTS campaign_recipients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    campaign_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_log_id BIGINT UNSIGNED DEFAULT NULL,
    status ENUM('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'skipped') NOT NULL DEFAULT 'pending',
    opened_at TIMESTAMP NULL DEFAULT NULL,
    clicked_at TIMESTAMP NULL DEFAULT NULL,
    open_count INT UNSIGNED NOT NULL DEFAULT 0,
    click_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message TEXT DEFAULT NULL,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_contact_id (contact_id),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_campaign_status (campaign_id, status),
    UNIQUE KEY uk_campaign_contact (campaign_id, contact_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Email tracking events (opens & clicks)
  `CREATE TABLE IF NOT EXISTS tracking_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tracking_id VARCHAR(64) NOT NULL,
    campaign_id BIGINT UNSIGNED DEFAULT NULL,
    campaign_recipient_id BIGINT UNSIGNED DEFAULT NULL,
    email_log_id BIGINT UNSIGNED DEFAULT NULL,
    email VARCHAR(255) NOT NULL,
    event_type ENUM('open', 'click') NOT NULL,
    link_url TEXT DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tracking_id (tracking_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_email (email),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Automation workflows
  `CREATE TABLE IF NOT EXISTS automations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    trigger_type ENUM('signup', 'tag_added', 'list_added', 'date_field', 'manual') NOT NULL,
    trigger_config JSON DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    total_entered INT UNSIGNED NOT NULL DEFAULT 0,
    total_completed INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trigger_type (trigger_type),
    INDEX idx_is_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Automation steps
  `CREATE TABLE IF NOT EXISTS automation_steps (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    automation_id INT UNSIGNED NOT NULL,
    step_order INT UNSIGNED NOT NULL,
    action_type ENUM('send_email', 'wait', 'condition', 'add_tag', 'remove_tag', 'move_to_list') NOT NULL,
    config JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_automation_id (automation_id),
    UNIQUE KEY uk_automation_step (automation_id, step_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Automation enrollments (contacts in automation)
  `CREATE TABLE IF NOT EXISTS automation_enrollments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    automation_id INT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    current_step INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('active', 'completed', 'paused', 'failed') NOT NULL DEFAULT 'active',
    next_action_at TIMESTAMP NULL DEFAULT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_automation_id (automation_id),
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status),
    INDEX idx_next_action (next_action_at),
    UNIQUE KEY uk_automation_contact (automation_id, contact_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Seed default templates
  `INSERT IGNORE INTO email_templates (name, subject, body_html, body_text, variables, description) VALUES
  ('welcome', 'Welcome {{name}}', '<h1>Welcome {{name}}</h1><p>Thank you for joining us.</p>', 'Welcome {{name}}\\nThank you for joining us.', '["name"]', 'Welcome email for new users'),
  ('admission_confirmation', 'Admission Confirmed - {{course}}', '<h1>Hello {{name}}</h1><p>Your admission for <strong>{{course}}</strong> is confirmed.</p><p>Regards,<br>Admissions Team</p>', 'Hello {{name}},\\nYour admission for {{course}} is confirmed.\\nRegards, Admissions Team', '["name", "course"]', 'Admission confirmation email'),
  ('payment_receipt', 'Payment Receipt - {{amount}}', '<h1>Payment Received</h1><p>Dear {{name}},</p><p>We received your payment of <strong>{{amount}}</strong>.</p><p>Transaction ID: {{transaction_id}}</p>', 'Payment Received\\nDear {{name}},\\nWe received your payment of {{amount}}.\\nTransaction ID: {{transaction_id}}', '["name", "amount", "transaction_id"]', 'Payment receipt email'),
  ('password_reset', 'Reset Your Password', '<h1>Password Reset</h1><p>Hi {{name}},</p><p>Click <a href="{{reset_link}}">here</a> to reset your password. This link expires in {{expiry_time}}.</p>', 'Hi {{name}},\\nReset your password: {{reset_link}}\\nThis link expires in {{expiry_time}}.', '["name", "reset_link", "expiry_time"]', 'Password reset email'),
  ('otp_verification', 'Your OTP Code - {{otp}}', '<h1>Verification Code</h1><p>Hi {{name}},</p><p>Your OTP code is: <strong>{{otp}}</strong></p><p>This code expires in {{expiry_time}}.</p>', 'Hi {{name}},\\nYour OTP code is: {{otp}}\\nThis code expires in {{expiry_time}}.', '["name", "otp", "expiry_time"]', 'OTP verification email'),
  ('campaign_product_launch', '🚀 Introducing {{product_name}} — Built for You', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:48px 40px;text-align:center;\"><h1 style=\"color:#ffffff;font-size:32px;margin:0 0 12px 0;font-weight:700;\">Introducing {{product_name}}</h1><p style=\"color:rgba(255,255,255,0.9);font-size:18px;margin:0;line-height:1.5;\">{{tagline}}</p></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">{{intro_text}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0;\"><tr><td style=\"background-color:#f8f9fc;border-radius:8px;padding:24px;\"><table role=\"presentation\" width=\"100%\"><tr><td style=\"padding:8px 0;border-bottom:1px solid #e8ebf0;\"><span style=\"color:#667eea;font-weight:600;\">✓</span> <span style=\"color:#333;font-size:15px;\">{{feature_1}}</span></td></tr><tr><td style=\"padding:8px 0;border-bottom:1px solid #e8ebf0;\"><span style=\"color:#667eea;font-weight:600;\">✓</span> <span style=\"color:#333;font-size:15px;\">{{feature_2}}</span></td></tr><tr><td style=\"padding:8px 0;\"><span style=\"color:#667eea;font-weight:600;\">✓</span> <span style=\"color:#333;font-size:15px;\">{{feature_3}}</span></td></tr></table></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:32px auto;\"><tr><td style=\"background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px;\"><a href=\"{{cta_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">{{cta_text}}</a></td></tr></table><p style=\"color:#8e8ea0;font-size:14px;line-height:1.6;margin:24px 0 0 0;text-align:center;\">Questions? Just reply to this email — we''d love to help.</p></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nWe''re excited to introduce {{product_name}} — {{tagline}}.\\n\\n{{intro_text}}\\n\\nKey Features:\\n• {{feature_1}}\\n• {{feature_2}}\\n• {{feature_3}}\\n\\n{{cta_text}}: {{cta_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"product_name\", \"tagline\", \"intro_text\", \"feature_1\", \"feature_2\", \"feature_3\", \"cta_url\", \"cta_text\", \"company_name\", \"unsubscribe_url\"]', 'Product launch announcement campaign'),
  ('campaign_promotional_offer', '🎉 {{discount_amount}} Off — Exclusive Deal for You, {{name}}!', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:48px 40px;text-align:center;\"><p style=\"color:rgba(255,255,255,0.9);font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;font-weight:600;\">Limited Time Offer</p><h1 style=\"color:#ffffff;font-size:48px;margin:0 0 8px 0;font-weight:800;\">{{discount_amount}} OFF</h1><p style=\"color:rgba(255,255,255,0.85);font-size:16px;margin:0;\">Use code: <span style=\"background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:4px;font-family:monospace;font-weight:700;letter-spacing:1px;\">{{promo_code}}</span></p></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">{{offer_description}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0;background-color:#fff8f0;border-radius:8px;border:2px dashed #f5576c;padding:20px;\"><tr><td style=\"text-align:center;\"><p style=\"color:#f5576c;font-size:14px;font-weight:600;margin:0 0 4px 0;\">⏰ Offer expires</p><p style=\"color:#333;font-size:20px;font-weight:700;margin:0;\">{{expiry_date}}</p></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:32px auto;\"><tr><td style=\"background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:8px;\"><a href=\"{{cta_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">Shop Now →</a></td></tr></table></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\n{{discount_amount}} OFF — Use code: {{promo_code}}\\n\\n{{offer_description}}\\n\\nOffer expires: {{expiry_date}}\\n\\nShop now: {{cta_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"discount_amount\", \"promo_code\", \"offer_description\", \"expiry_date\", \"cta_url\", \"company_name\", \"unsubscribe_url\"]', 'Promotional discount/sale campaign email'),
  ('campaign_newsletter', '📬 {{newsletter_title}} — {{edition}}', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background-color:#1a1a2e;padding:32px 40px;text-align:center;\"><h1 style=\"color:#ffffff;font-size:24px;margin:0;font-weight:700;\">{{newsletter_title}}</h1><p style=\"color:#a0a0b8;font-size:13px;margin:8px 0 0 0;\">{{edition}}</p></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 32px 0;\">{{intro_text}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td style=\"border-left:4px solid #667eea;padding:16px 20px;background-color:#f8f9fc;border-radius:0 8px 8px 0;\"><h3 style=\"color:#333;font-size:18px;margin:0 0 8px 0;\">{{article_1_title}}</h3><p style=\"color:#51545e;font-size:14px;line-height:1.5;margin:0 0 12px 0;\">{{article_1_summary}}</p><a href=\"{{article_1_url}}\" style=\"color:#667eea;font-size:14px;font-weight:600;text-decoration:none;\">Read more →</a></td></tr></table><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td style=\"border-left:4px solid #f5576c;padding:16px 20px;background-color:#f8f9fc;border-radius:0 8px 8px 0;\"><h3 style=\"color:#333;font-size:18px;margin:0 0 8px 0;\">{{article_2_title}}</h3><p style=\"color:#51545e;font-size:14px;line-height:1.5;margin:0 0 12px 0;\">{{article_2_summary}}</p><a href=\"{{article_2_url}}\" style=\"color:#f5576c;font-size:14px;font-weight:600;text-decoration:none;\">Read more →</a></td></tr></table><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td style=\"border-left:4px solid #43b581;padding:16px 20px;background-color:#f8f9fc;border-radius:0 8px 8px 0;\"><h3 style=\"color:#333;font-size:18px;margin:0 0 8px 0;\">{{article_3_title}}</h3><p style=\"color:#51545e;font-size:14px;line-height:1.5;margin:0 0 12px 0;\">{{article_3_summary}}</p><a href=\"{{article_3_url}}\" style=\"color:#43b581;font-size:14px;font-weight:600;text-decoration:none;\">Read more →</a></td></tr></table></td></tr><tr><td style=\"background-color:#1a1a2e;padding:24px 40px;text-align:center;\"><p style=\"color:#a0a0b8;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#a0a0b8;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\n{{newsletter_title}} — {{edition}}\\n\\n{{intro_text}}\\n\\n---\\n{{article_1_title}}\\n{{article_1_summary}}\\nRead more: {{article_1_url}}\\n\\n---\\n{{article_2_title}}\\n{{article_2_summary}}\\nRead more: {{article_2_url}}\\n\\n---\\n{{article_3_title}}\\n{{article_3_summary}}\\nRead more: {{article_3_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"newsletter_title\", \"edition\", \"intro_text\", \"article_1_title\", \"article_1_summary\", \"article_1_url\", \"article_2_title\", \"article_2_summary\", \"article_2_url\", \"article_3_title\", \"article_3_summary\", \"article_3_url\", \"company_name\", \"unsubscribe_url\"]', 'Newsletter with 3 featured articles'),
  ('campaign_event_invitation', '📅 You''re Invited: {{event_name}}', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#0061ff 0%,#60efff 100%);padding:48px 40px;text-align:center;\"><p style=\"color:rgba(255,255,255,0.85);font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;font-weight:600;\">You''re Invited</p><h1 style=\"color:#ffffff;font-size:32px;margin:0 0 16px 0;font-weight:700;\">{{event_name}}</h1><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto;\"><tr><td style=\"background:rgba(255,255,255,0.2);border-radius:8px;padding:12px 24px;\"><p style=\"color:#ffffff;font-size:15px;margin:0;\">📅 {{event_date}} · 🕐 {{event_time}} · 📍 {{event_location}}</p></td></tr></table></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">{{event_description}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0;\"><tr><td width=\"50%\" style=\"padding:16px;background-color:#f0f7ff;border-radius:8px 0 0 8px;text-align:center;border-right:1px solid #e0edff;\"><p style=\"color:#0061ff;font-size:13px;font-weight:600;margin:0 0 4px 0;\">SPEAKER</p><p style=\"color:#333;font-size:15px;margin:0;font-weight:600;\">{{speaker_name}}</p><p style=\"color:#666;font-size:13px;margin:2px 0 0 0;\">{{speaker_title}}</p></td><td width=\"50%\" style=\"padding:16px;background-color:#f0f7ff;border-radius:0 8px 8px 0;text-align:center;\"><p style=\"color:#0061ff;font-size:13px;font-weight:600;margin:0 0 4px 0;\">SEATS LEFT</p><p style=\"color:#333;font-size:24px;margin:0;font-weight:700;\">{{seats_left}}</p></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:32px auto;\"><tr><td style=\"background:linear-gradient(135deg,#0061ff 0%,#60efff 100%);border-radius:8px;\"><a href=\"{{rsvp_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">Reserve My Spot →</a></td></tr></table></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nYou''re Invited: {{event_name}}\\n\\n📅 {{event_date}} · 🕐 {{event_time}} · 📍 {{event_location}}\\n\\n{{event_description}}\\n\\nSpeaker: {{speaker_name}} — {{speaker_title}}\\nSeats Left: {{seats_left}}\\n\\nRSVP: {{rsvp_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"event_name\", \"event_date\", \"event_time\", \"event_location\", \"event_description\", \"speaker_name\", \"speaker_title\", \"seats_left\", \"rsvp_url\", \"company_name\", \"unsubscribe_url\"]', 'Event/webinar invitation campaign'),
  ('campaign_abandoned_cart', '{{name}}, you left something behind 🛒', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#ff9a56 0%,#ff6a88 100%);padding:40px;text-align:center;\"><p style=\"font-size:64px;margin:0;\">🛒</p><h1 style=\"color:#ffffff;font-size:28px;margin:16px 0 0 0;font-weight:700;\">You Left Something Behind</h1></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 28px 0;\">Looks like you left some items in your cart. We''ve saved them for you — but they won''t wait forever!</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;\"><tr style=\"background-color:#f8f9fc;\"><td style=\"padding:12px 16px;font-weight:600;color:#333;font-size:14px;\">Item</td><td style=\"padding:12px 16px;font-weight:600;color:#333;font-size:14px;text-align:right;\">Price</td></tr><tr><td style=\"padding:12px 16px;color:#51545e;font-size:14px;border-top:1px solid #eee;\">{{item_1_name}}</td><td style=\"padding:12px 16px;color:#51545e;font-size:14px;border-top:1px solid #eee;text-align:right;\">{{item_1_price}}</td></tr><tr><td style=\"padding:12px 16px;color:#51545e;font-size:14px;border-top:1px solid #eee;\">{{item_2_name}}</td><td style=\"padding:12px 16px;color:#51545e;font-size:14px;border-top:1px solid #eee;text-align:right;\">{{item_2_price}}</td></tr><tr style=\"background-color:#f8f9fc;\"><td style=\"padding:12px 16px;font-weight:700;color:#333;font-size:15px;border-top:2px solid #ddd;\">Total</td><td style=\"padding:12px 16px;font-weight:700;color:#ff6a88;font-size:18px;border-top:2px solid #ddd;text-align:right;\">{{cart_total}}</td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:32px auto;\"><tr><td style=\"background:linear-gradient(135deg,#ff9a56 0%,#ff6a88 100%);border-radius:8px;\"><a href=\"{{cart_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">Complete My Order →</a></td></tr></table><p style=\"color:#8e8ea0;font-size:13px;line-height:1.6;margin:20px 0 0 0;text-align:center;\">Your cart will be saved for {{cart_expiry}}.</p></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nYou left items in your cart!\\n\\n{{item_1_name}} — {{item_1_price}}\\n{{item_2_name}} — {{item_2_price}}\\nTotal: {{cart_total}}\\n\\nComplete your order: {{cart_url}}\\nCart saved for {{cart_expiry}}.\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"item_1_name\", \"item_1_price\", \"item_2_name\", \"item_2_price\", \"cart_total\", \"cart_url\", \"cart_expiry\", \"company_name\", \"unsubscribe_url\"]', 'Abandoned cart recovery campaign'),
  ('campaign_re_engagement', 'We Miss You, {{name}} 💙', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%);padding:48px 40px;text-align:center;\"><p style=\"font-size:56px;margin:0 0 12px 0;\">👋</p><h1 style=\"color:#ffffff;font-size:28px;margin:0;font-weight:700;\">We Miss You!</h1></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">It''s been a while since we last saw you, and a lot has changed! Here''s what you''ve been missing:</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td style=\"padding:16px;background-color:#f8f0ff;border-radius:8px;margin-bottom:12px;\"><h4 style=\"color:#7c3aed;margin:0 0 6px 0;font-size:15px;\">🆕 {{update_1_title}}</h4><p style=\"color:#51545e;font-size:14px;line-height:1.5;margin:0;\">{{update_1_description}}</p></td></tr></table><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td style=\"padding:16px;background-color:#f0f7ff;border-radius:8px;\"><h4 style=\"color:#2563eb;margin:0 0 6px 0;font-size:15px;\">⭐ {{update_2_title}}</h4><p style=\"color:#51545e;font-size:14px;line-height:1.5;margin:0;\">{{update_2_description}}</p></td></tr></table><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 32px 0;\"><tr><td style=\"background-color:#fff8e1;border-radius:8px;padding:20px;text-align:center;\"><p style=\"color:#f59e0b;font-weight:700;font-size:14px;margin:0 0 4px 0;\">Welcome Back Offer</p><p style=\"color:#333;font-size:20px;font-weight:700;margin:0;\">{{incentive_text}}</p></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto 24px auto;\"><tr><td style=\"background:linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%);border-radius:8px;\"><a href=\"{{cta_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">Come Back & Explore →</a></td></tr></table></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nWe miss you! Here''s what you''ve been missing:\\n\\n🆕 {{update_1_title}}\\n{{update_1_description}}\\n\\n⭐ {{update_2_title}}\\n{{update_2_description}}\\n\\nWelcome Back Offer: {{incentive_text}}\\n\\n{{cta_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"update_1_title\", \"update_1_description\", \"update_2_title\", \"update_2_description\", \"incentive_text\", \"cta_url\", \"company_name\", \"unsubscribe_url\"]', 'Win-back campaign for inactive users'),
  ('campaign_feedback_request', '{{name}}, your opinion matters to us ⭐', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);padding:48px 40px;text-align:center;\"><h1 style=\"color:#ffffff;font-size:28px;margin:0 0 12px 0;font-weight:700;\">How Did We Do?</h1><p style=\"color:rgba(255,255,255,0.9);font-size:16px;margin:0;\">Your feedback helps us improve</p></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 28px 0;\">{{feedback_intro}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 28px 0;\"><tr><td style=\"text-align:center;\"><p style=\"color:#333;font-size:14px;font-weight:600;margin:0 0 16px 0;\">Rate your experience</p><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto;\"><tr><td style=\"padding:0 4px;\"><a href=\"{{rating_1_url}}\" style=\"text-decoration:none;font-size:36px;\">😡</a></td><td style=\"padding:0 4px;\"><a href=\"{{rating_2_url}}\" style=\"text-decoration:none;font-size:36px;\">😕</a></td><td style=\"padding:0 4px;\"><a href=\"{{rating_3_url}}\" style=\"text-decoration:none;font-size:36px;\">😐</a></td><td style=\"padding:0 4px;\"><a href=\"{{rating_4_url}}\" style=\"text-decoration:none;font-size:36px;\">😊</a></td><td style=\"padding:0 4px;\"><a href=\"{{rating_5_url}}\" style=\"text-decoration:none;font-size:36px;\">🤩</a></td></tr></table></td></tr></table><p style=\"color:#51545e;font-size:14px;line-height:1.6;text-align:center;margin:0 0 28px 0;\">Or share detailed feedback:</p><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto;\"><tr><td style=\"background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);border-radius:8px;\"><a href=\"{{survey_url}}\" style=\"display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;\">Take Quick Survey (2 min) →</a></td></tr></table><p style=\"color:#8e8ea0;font-size:13px;text-align:center;margin:24px 0 0 0;\">{{reward_text}}</p></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\n{{feedback_intro}}\\n\\nRate your experience (1-5):\\n1: {{rating_1_url}}\\n2: {{rating_2_url}}\\n3: {{rating_3_url}}\\n4: {{rating_4_url}}\\n5: {{rating_5_url}}\\n\\nOr take our survey: {{survey_url}}\\n\\n{{reward_text}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"feedback_intro\", \"rating_1_url\", \"rating_2_url\", \"rating_3_url\", \"rating_4_url\", \"rating_5_url\", \"survey_url\", \"reward_text\", \"company_name\", \"unsubscribe_url\"]', 'Customer feedback/NPS survey campaign'),
  ('campaign_onboarding_series', 'Step {{step_number}}: {{step_title}} — Getting Started with {{product_name}}', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#2196F3 0%,#21CBF3 100%);padding:40px;text-align:center;\"><p style=\"color:rgba(255,255,255,0.85);font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;font-weight:600;\">Getting Started — Step {{step_number}} of {{total_steps}}</p><h1 style=\"color:#ffffff;font-size:28px;margin:0;font-weight:700;\">{{step_title}}</h1><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:20px 0 0 0;\"><tr><td style=\"padding:0 4px;\"><div style=\"height:4px;background:rgba(255,255,255,0.3);border-radius:2px;\"><div style=\"height:4px;background:#ffffff;border-radius:2px;width:{{progress_percent}}%;\"></div></div></td></tr></table></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 24px 0;\">{{step_description}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px 0;\"><tr><td style=\"background-color:#e3f2fd;border-radius:8px;padding:24px;\"><h4 style=\"color:#1976d2;margin:0 0 12px 0;\">📋 What to do:</h4><table role=\"presentation\" width=\"100%\"><tr><td style=\"padding:6px 0;color:#333;font-size:14px;\"><span style=\"color:#2196F3;font-weight:700;margin-right:8px;\">1.</span> {{action_1}}</td></tr><tr><td style=\"padding:6px 0;color:#333;font-size:14px;\"><span style=\"color:#2196F3;font-weight:700;margin-right:8px;\">2.</span> {{action_2}}</td></tr><tr><td style=\"padding:6px 0;color:#333;font-size:14px;\"><span style=\"color:#2196F3;font-weight:700;margin-right:8px;\">3.</span> {{action_3}}</td></tr></table></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:32px auto;\"><tr><td style=\"background:linear-gradient(135deg,#2196F3 0%,#21CBF3 100%);border-radius:8px;\"><a href=\"{{cta_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">{{cta_text}} →</a></td></tr></table><p style=\"color:#8e8ea0;font-size:13px;text-align:center;margin:20px 0 0 0;\">Need help? Reply to this email or visit our <a href=\"{{help_url}}\" style=\"color:#2196F3;text-decoration:none;\">Help Center</a>.</p></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nGetting Started — Step {{step_number}} of {{total_steps}}: {{step_title}}\\n\\n{{step_description}}\\n\\nWhat to do:\\n1. {{action_1}}\\n2. {{action_2}}\\n3. {{action_3}}\\n\\n{{cta_text}}: {{cta_url}}\\nNeed help? {{help_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"product_name\", \"step_number\", \"total_steps\", \"progress_percent\", \"step_title\", \"step_description\", \"action_1\", \"action_2\", \"action_3\", \"cta_url\", \"cta_text\", \"help_url\", \"company_name\", \"unsubscribe_url\"]', 'Drip onboarding series with progress bar'),
  ('campaign_referral', 'Give {{referral_reward}}, Get {{referral_reward}} 🎁', '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"></head><body style=\"margin:0;padding:0;background-color:#f4f4f7;font-family:Helvetica,Arial,sans-serif;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f7;\"><tr><td align=\"center\" style=\"padding:40px 20px;\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\"><tr><td style=\"background:linear-gradient(135deg,#f7971e 0%,#ffd200 100%);padding:48px 40px;text-align:center;\"><p style=\"font-size:48px;margin:0 0 12px 0;\">🎁</p><h1 style=\"color:#ffffff;font-size:28px;margin:0 0 8px 0;font-weight:700;\">Refer a Friend</h1><p style=\"color:rgba(255,255,255,0.9);font-size:18px;margin:0;\">Give {{referral_reward}}. Get {{referral_reward}}.</p></td></tr><tr><td style=\"padding:40px;\"><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 20px 0;\">Hi {{name}},</p><p style=\"color:#51545e;font-size:16px;line-height:1.6;margin:0 0 28px 0;\">Love {{product_name}}? Share it with friends and you both win! For every friend that signs up, you''ll both get <strong>{{referral_reward}}</strong>.</p><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 28px 0;background:#fffbeb;border:2px solid #ffd200;border-radius:8px;padding:20px;\"><tr><td style=\"text-align:center;\"><p style=\"color:#92400e;font-size:13px;font-weight:600;margin:0 0 8px 0;\">YOUR REFERRAL CODE</p><p style=\"color:#333;font-size:28px;font-weight:800;letter-spacing:3px;margin:0;font-family:monospace;\">{{referral_code}}</p></td></tr></table><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 24px 0;\"><tr><td width=\"33%\" style=\"text-align:center;padding:12px;\"><p style=\"color:#f7971e;font-size:24px;margin:0;\">1️⃣</p><p style=\"color:#333;font-size:13px;font-weight:600;margin:4px 0 0 0;\">Share your code</p></td><td width=\"33%\" style=\"text-align:center;padding:12px;\"><p style=\"color:#f7971e;font-size:24px;margin:0;\">2️⃣</p><p style=\"color:#333;font-size:13px;font-weight:600;margin:4px 0 0 0;\">Friend signs up</p></td><td width=\"33%\" style=\"text-align:center;padding:12px;\"><p style=\"color:#f7971e;font-size:24px;margin:0;\">3️⃣</p><p style=\"color:#333;font-size:13px;font-weight:600;margin:4px 0 0 0;\">You both get {{referral_reward}}</p></td></tr></table><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:24px auto;\"><tr><td style=\"background:linear-gradient(135deg,#f7971e 0%,#ffd200 100%);border-radius:8px;\"><a href=\"{{referral_url}}\" style=\"display:inline-block;padding:16px 40px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;\">Share & Earn →</a></td></tr></table></td></tr><tr><td style=\"background-color:#f8f9fc;padding:24px 40px;text-align:center;border-top:1px solid #eee;\"><p style=\"color:#b5b5c3;font-size:12px;margin:0;\">© {{currentYear}} {{company_name}} · <a href=\"{{unsubscribe_url}}\" style=\"color:#b5b5c3;\">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>', 'Hi {{name}},\\n\\nRefer a friend to {{product_name}} and you both get {{referral_reward}}!\\n\\nYour referral code: {{referral_code}}\\n\\n1. Share your code\\n2. Friend signs up\\n3. You both get {{referral_reward}}\\n\\nShare now: {{referral_url}}\\n\\n© {{company_name}}\\nUnsubscribe: {{unsubscribe_url}}', '[\"name\", \"product_name\", \"referral_reward\", \"referral_code\", \"referral_url\", \"company_name\", \"unsubscribe_url\"]', 'Referral/invite-a-friend campaign')`
];

async function seedDefaultApiKey(connection) {
  const [existing] = await connection.execute('SELECT COUNT(*) as count FROM api_keys');
  if (existing[0].count > 0) {
    console.log('API key(s) already exist, skipping seed');
    return;
  }

  const apiKey = `ms_${uuidv4().replace(/-/g, '')}`;
  const hashedKey = await bcrypt.hash(apiKey, 10);

  await connection.execute(
    'INSERT INTO api_keys (key_name, api_key, hashed_key, rate_limit) VALUES (?, ?, ?, ?)',
    ['Default Admin Key', apiKey, hashedKey, 1000]
  );

  console.log('\n  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║           Default API Key Created!                       ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log(`  ║  API Key: ${apiKey.padEnd(46)}║`);
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log('  ║  Paste this in the "API Key" field on the dashboard.    ║');
  console.log('  ║  Save it now — it won\'t be shown again!                 ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝\n');
}

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const dbName = process.env.DB_NAME || 'mail_service';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    for (const sql of migrations) {
      await connection.query(sql);
    }

    console.log('Migrations completed successfully');

    // Auto-seed first API key
    await seedDefaultApiKey(connection);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
