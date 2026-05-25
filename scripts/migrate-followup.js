/**
 * Migration: Add follow-up tracking columns to orders table.
 * Run once: node scripts/migrate-followup.js
 */

require('dotenv').config();
const db = require('../src/services/db');

async function migrate() {
  console.log('[Migration] Adding follow_up columns to orders table...');
  try {
    await db.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS follow_up_sent       BOOLEAN   NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS follow_up_sent_at    TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS needs_manual_review  BOOLEAN   NOT NULL DEFAULT FALSE;
    `);

    // Index for the cron query — only pending orders that haven't had follow-up
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_followup
        ON orders (status, follow_up_sent, created_at)
        WHERE status = 'pending';
    `);

    console.log('[Migration] Done. Columns added successfully.');
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
