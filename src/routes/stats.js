/**
 * Stats Router
 * Handles business performance metrics.
 */

const express = require('express');
const db = require('../services/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/stats
 * Returns monthly summary stats for the business.
 */
router.get('/', authenticateToken, async (req, res) => {
  const businessId = req.business.id;

  try {
    const countQuery = `
      SELECT 
        COUNT(*)::integer AS total_orders,
        COUNT(*) FILTER (WHERE status = 'confirmed')::integer AS confirmed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')::integer AS cancelled_count,
        COUNT(*) FILTER (WHERE status = 'no_response')::integer AS no_response_count
      FROM orders
      WHERE business_id = $1 AND created_at >= date_trunc('month', NOW());
    `;
    const countRes = await db.query(countQuery, [businessId]);
    const stats = countRes.rows[0];

    const total = stats.total_orders;
    const confirmedCount = stats.confirmed_count;
    const confirmedPercentage = total > 0 ? parseFloat(((confirmedCount / total) * 100).toFixed(2)) : 0;

    const timeQuery = `
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (c.last_updated - o.created_at)) / 60), 0)::float AS avg_time_mins
      FROM orders o
      JOIN conversations c ON o.id = c.order_id
      WHERE o.business_id = $1 
        AND o.status = 'confirmed' 
        AND c.current_state = 'completed'
        AND o.created_at >= date_trunc('month', NOW());
    `;
    const timeRes = await db.query(timeQuery, [businessId]);
    const averageTime = parseFloat(timeRes.rows[0].avg_time_mins.toFixed(2));

    res.status(200).json({
      total_orders: total,
      confirmed_orders: confirmedCount,
      confirmed_percentage: confirmedPercentage,
      cancelled_orders: stats.cancelled_count,
      no_response: stats.no_response_count,
      average_confirmation_time: averageTime
    });
  } catch (error) {
    console.error('[Stats API] GET / failed:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
