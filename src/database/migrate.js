const mysql = require('mysql2/promise');
require('dotenv').config();

const migrations = [
  // Email logs table
  `CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    message_id VARCHAR(255) DEFAULT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    template VARCHAR(255) DEFAULT NULL,
    status ENUM('pending', 'queued', 'sent', 'failed', 'bounced') NOT NULL DEFAULT 'pending',
    retry_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_recipient (recipient),
    INDEX idx_status (status),
    INDEX idx_message_id (message_id),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Email templates table
  `CREATE TABLE IF NOT EXISTS email_templates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT DEFAULT NULL,
    variables JSON DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
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
    feedback TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_bounce_type (bounce_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Suppression list (emails that should not receive further messages)
  `CREATE TABLE IF NOT EXISTS suppression_list (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    reason ENUM('hard_bounce', 'complaint', 'manual') NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_api_key (api_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Seed default templates
  `INSERT IGNORE INTO email_templates (name, subject, body_html, body_text, variables) VALUES
  ('welcome', 'Welcome {{name}}', '<h1>Welcome {{name}}</h1><p>Thank you for joining us.</p>', 'Welcome {{name}}\\nThank you for joining us.', '["name"]'),
  ('admission_confirmation', 'Admission Confirmed - {{course}}', '<h1>Hello {{name}}</h1><p>Your admission for <strong>{{course}}</strong> is confirmed.</p><p>Regards,<br>Admissions Team</p>', 'Hello {{name}},\\nYour admission for {{course}} is confirmed.\\nRegards, Admissions Team', '["name", "course"]'),
  ('payment_receipt', 'Payment Receipt - {{amount}}', '<h1>Payment Received</h1><p>Dear {{name}},</p><p>We received your payment of <strong>{{amount}}</strong>.</p><p>Transaction ID: {{transaction_id}}</p>', 'Payment Received\\nDear {{name}},\\nWe received your payment of {{amount}}.\\nTransaction ID: {{transaction_id}}', '["name", "amount", "transaction_id"]')`
];

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    // Create database if not exists
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'mail_service'}\``
    );
    await connection.query(`USE \`${process.env.DB_NAME || 'mail_service'}\``);

    for (const sql of migrations) {
      await connection.query(sql);
    }

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
