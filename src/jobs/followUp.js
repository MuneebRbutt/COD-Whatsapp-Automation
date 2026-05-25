/**
 * Follow-Up Job — src/jobs/followUp.js
 *
 * Runs every 30 minutes via node-cron.
 *
 * Pass 1 — "3-hour check":
 *   Finds pending orders where the initial message was sent > 3 hours ago
 *   and no follow-up has been sent yet.  Sends one Urdu follow-up message
 *   and stamps follow_up_sent / follow_up_sent_at on the orders row.
 *
 * Pass 2 — "6-hour check":
 *   Finds orders where follow-up was already sent > 3 hours ago (so 6+ hours
 *   since creation total) and the order is still pending.
 *   Marks status = 'no_response', needs_manual_review = true,
 *   conversation state = 'no_response'.
 */

const cron = require('node-cron');
const db   = require('../services/db');
const whatsappService = require('../services/whatsapp');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format JSONB order_items into a short readable list.
 * e.g. "2x Blue Shirt, 1x Black Jeans"
 */
function formatItems(orderItems) {
  try {
    const items = Array.isArray(orderItems)
      ? orderItems
      : JSON.parse(orderItems || '[]');

    if (!items.length) return 'aapka order';

    return items
      .map(i => `${i.quantity || 1}x ${i.title || i.name || 'item'}`)
      .join(', ');
  } catch {
    return 'aapka order';
  }
}

// ─── Pass 1: Send follow-up after 3 hours ────────────────────────────────────

async function sendFollowUps() {
  console.log('[FollowUpJob] Pass 1 — checking for orders needing follow-up...');

  const query = `
    SELECT o.id, o.customer_name, o.customer_phone, o.order_items
    FROM orders o
    WHERE
      o.status          = 'pending'
      AND o.follow_up_sent = FALSE
      AND o.created_at  <= NOW() - INTERVAL '3 hours'
    ORDER BY o.created_at ASC
  `;

  let rows;
  try {
    const result = await db.query(query);
    rows = result.rows;
  } catch (err) {
    console.error('[FollowUpJob] DB error fetching follow-up candidates:', err.message);
    return;
  }

  if (!rows.length) {
    console.log('[FollowUpJob] No orders need a follow-up right now.');
    return;
  }

  console.log(`[FollowUpJob] ${rows.length} order(s) will receive a follow-up message.`);

  for (const order of rows) {
    const itemsText = formatItems(order.order_items);
    const name      = order.customer_name ? order.customer_name.split(' ')[0] : 'Sahab';

    const message =
      `${name} bhai, aapka order abhi bhi confirm nahi hua.\n` +
      `Kya aap confirm karna chahte hain? HAAN ya NAHI reply karein.\n` +
      `Order: ${itemsText}`;

    try {
      await whatsappService.sendMessage(order.customer_phone, message);

      // Mark follow-up as sent
      await db.query(
        `UPDATE orders
         SET follow_up_sent = TRUE, follow_up_sent_at = NOW()
         WHERE id = $1`,
        [order.id]
      );

      // Append follow-up log to conversation
      await db.query(
        `UPDATE conversations
         SET
           messages     = messages || $1::jsonb,
           current_state = 'follow_up_sent',
           last_updated  = NOW()
         WHERE order_id = $2`,
        [
          JSON.stringify([{
            role:      'assistant',
            text:      message,
            timestamp: new Date().toISOString(),
            type:      'follow_up'
          }]),
          order.id
        ]
      );

      console.log(`[FollowUpJob] Follow-up sent for order ${order.id} (${order.customer_phone})`);
    } catch (err) {
      console.error(`[FollowUpJob] Failed to send follow-up for order ${order.id}:`, err.message);
      // Non-fatal — continue with next order
    }
  }
}

// ─── Pass 2: Mark as no_response after 6 hours ───────────────────────────────

async function expireStaleOrders() {
  console.log('[FollowUpJob] Pass 2 — checking for orders to expire...');

  const query = `
    SELECT o.id
    FROM orders o
    WHERE
      o.status           = 'pending'
      AND o.follow_up_sent = TRUE
      AND o.follow_up_sent_at <= NOW() - INTERVAL '3 hours'
    ORDER BY o.follow_up_sent_at ASC
  `;

  let rows;
  try {
    const result = await db.query(query);
    rows = result.rows;
  } catch (err) {
    console.error('[FollowUpJob] DB error fetching stale orders:', err.message);
    return;
  }

  if (!rows.length) {
    console.log('[FollowUpJob] No stale orders to expire.');
    return;
  }

  console.log(`[FollowUpJob] ${rows.length} order(s) will be marked as no_response.`);

  for (const order of rows) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update order: no_response + flag for manual review
      await client.query(
        `UPDATE orders
         SET
           status              = 'no_response',
           needs_manual_review = TRUE
         WHERE id = $1`,
        [order.id]
      );

      // Update conversation state + append expiry log
      await client.query(
        `UPDATE conversations
         SET
           messages      = messages || $1::jsonb,
           current_state = 'no_response',
           last_updated   = NOW()
         WHERE order_id  = $2`,
        [
          JSON.stringify([{
            role:      'system',
            text:      'Conversation expired — no customer response after 6 hours. Flagged for manual review.',
            timestamp: new Date().toISOString(),
            type:      'expired'
          }]),
          order.id
        ]
      );

      await client.query('COMMIT');
      console.log(`[FollowUpJob] Order ${order.id} marked as no_response and flagged for review.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[FollowUpJob] Failed to expire order ${order.id}:`, err.message);
    } finally {
      client.release();
    }
  }
}

// ─── Cron runner ─────────────────────────────────────────────────────────────

/**
 * Starts the follow-up cron job.
 * Runs every 30 minutes.  Both passes execute in sequence so DB load is minimal.
 */
function startFollowUpJob() {
  console.log('[FollowUpJob] Scheduling follow-up job — runs every 30 minutes.');

  // Run immediately on startup so we don't wait 30 min after a server restart
  runJob();

  // Then every 30 minutes
  cron.schedule('*/30 * * * *', runJob, {
    timezone: 'Asia/Karachi'
  });
}

async function runJob() {
  console.log(`\n[FollowUpJob] ===== Job triggered at ${new Date().toISOString()} =====`);
  try {
    await sendFollowUps();
    await expireStaleOrders();
  } catch (err) {
    console.error('[FollowUpJob] Unexpected error in job run:', err.message);
  }
  console.log('[FollowUpJob] ===== Job complete =====\n');
}

module.exports = { startFollowUpJob };
