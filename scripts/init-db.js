/**
 * Database Initialization Script.
 * Reads schema.sql and runs it against the configured PostgreSQL database.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/services/db');

async function initializeDatabase() {
  console.log('Starting database initialization...');
  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema statements
    await query(schemaSql);
    console.log('Database tables and indexes created successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err.message || err);
    process.exit(1);
  } finally {
    // Close the connection pool
    await pool.end();
    console.log('Database connection pool closed.');
  }
}

initializeDatabase();
