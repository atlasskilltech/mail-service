#!/usr/bin/env node
/**
 * Generate the first API key for the Mail Service.
 *
 * Usage:
 *   node src/database/seed-api-key.js
 *   node src/database/seed-api-key.js "My Key Name"
 *
 * This creates an API key directly in the database.
 * Use this for initial setup when no API key exists yet.
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedApiKey() {
  const keyName = process.argv[2] || 'Default Admin Key';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mail_service'
  });

  try {
    // Check if any API keys exist
    const [existing] = await connection.execute('SELECT COUNT(*) as count FROM api_keys');
    if (existing[0].count > 0) {
      console.log(`\n  There are already ${existing[0].count} API key(s) in the database.`);
      const answer = process.argv[3];
      if (answer !== '--force') {
        console.log('  Use --force as third argument to create another one anyway.');
        console.log(`  Example: node src/database/seed-api-key.js "${keyName}" --force\n`);
        process.exit(0);
      }
    }

    // Generate API key
    const apiKey = `ms_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = await bcrypt.hash(apiKey, 10);

    await connection.execute(
      'INSERT INTO api_keys (key_name, api_key, hashed_key, rate_limit) VALUES (?, ?, ?, ?)',
      [keyName, apiKey, hashedKey, 1000]
    );

    console.log('\n  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║           API Key Generated Successfully!                ║');
    console.log('  ╠══════════════════════════════════════════════════════════╣');
    console.log(`  ║  Key Name:  ${keyName.padEnd(44)}║`);
    console.log(`  ║  API Key:   ${apiKey.padEnd(44)}║`);
    console.log('  ╠══════════════════════════════════════════════════════════╣');
    console.log('  ║  Save this key! It cannot be retrieved later.           ║');
    console.log('  ║  Paste it in the "API Key" field on the dashboard.      ║');
    console.log('  ╚══════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Failed to create API key:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedApiKey();
