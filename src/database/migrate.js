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

  // Seed default templates
  `INSERT IGNORE INTO email_templates (name, subject, body_html, body_text, variables, description) VALUES
  ('welcome', 'Welcome {{name}}', '<h1>Welcome {{name}}</h1><p>Thank you for joining us.</p>', 'Welcome {{name}}\\nThank you for joining us.', '["name"]', 'Welcome email for new users'),
  ('admission_confirmation', 'Admission Confirmed - {{course}}', '<h1>Hello {{name}}</h1><p>Your admission for <strong>{{course}}</strong> is confirmed.</p><p>Regards,<br>Admissions Team</p>', 'Hello {{name}},\\nYour admission for {{course}} is confirmed.\\nRegards, Admissions Team', '["name", "course"]', 'Admission confirmation email'),
  ('payment_receipt', 'Payment Receipt - {{amount}}', '<h1>Payment Received</h1><p>Dear {{name}},</p><p>We received your payment of <strong>{{amount}}</strong>.</p><p>Transaction ID: {{transaction_id}}</p>', 'Payment Received\\nDear {{name}},\\nWe received your payment of {{amount}}.\\nTransaction ID: {{transaction_id}}', '["name", "amount", "transaction_id"]', 'Payment receipt email'),
  ('password_reset', 'Reset Your Password', '<h1>Password Reset</h1><p>Hi {{name}},</p><p>Click <a href="{{reset_link}}">here</a> to reset your password. This link expires in {{expiry_time}}.</p>', 'Hi {{name}},\\nReset your password: {{reset_link}}\\nThis link expires in {{expiry_time}}.', '["name", "reset_link", "expiry_time"]', 'Password reset email'),
  ('otp_verification', 'Your OTP Code - {{otp}}', '<h1>Verification Code</h1><p>Hi {{name}},</p><p>Your OTP code is: <strong>{{otp}}</strong></p><p>This code expires in {{expiry_time}}.</p>', 'Hi {{name}},\\nYour OTP code is: {{otp}}\\nThis code expires in {{expiry_time}}.', '["name", "otp", "expiry_time"]', 'OTP verification email')`
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
