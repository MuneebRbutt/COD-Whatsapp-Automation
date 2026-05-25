/**
 * Orders Router
 * Handles all order-related operations for the dashboard and API.
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const db = require('../services/db');
const authenticateToken = require('../middleware/auth');

const conversationManager = require('../services/conversationManager');

const router = express.Router();

// Helper middleware to handle express-validator validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * GET /api/orders
 * Returns list of orders for the authenticated business.
 */
router.get(
  '/',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'no_response']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      let queryParams = [businessId];
      let filterClauses = '';

      if (status) {
        queryParams.push(status);
        filterClauses += ` AND status = $${queryParams.length}`;
      }

      // Count query
      const countRes = await db.query(
        `SELECT COUNT(*) FROM orders WHERE business_id = $1 ${filterClauses}`,
        queryParams
      );
      const totalCount = parseInt(countRes.rows[0].count, 10);

      // Orders query
      queryParams.push(limit, offset);
      const ordersRes = await db.query(
        `SELECT * FROM orders WHERE business_id = $1 ${filterClauses} 
         ORDER BY created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      res.status(200).json({
        orders: ordersRes.rows,
        meta: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('[Orders API] GET / failed:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * GET /api/orders/:id
 * Retrieve a specific order by ID.
 */
router.get(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID().withMessage('Invalid order ID format.'),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const orderId = req.params.id;

    try {
      const result = await db.query(
        `SELECT o.*, c.messages, c.current_state as conversation_state 
         FROM orders o 
         LEFT JOIN conversations c ON o.id = c.order_id 
         WHERE o.id = $1 AND o.business_id = $2`,
        [orderId, businessId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error(`[Orders API] GET /${orderId} failed:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * POST /api/orders
 * Manually create an order (e.g. for non-Shopify orders).
 */
router.post(
  '/',
  authenticateToken,
  [
    body('customer_name').trim().notEmpty(),
    body('customer_phone').trim().notEmpty(),
    body('delivery_address').trim().notEmpty(),
    body('order_items').isArray().notEmpty(),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const { customer_name, customer_phone, delivery_address, order_items } = req.body;

    try {
      const insertQuery = `
        INSERT INTO orders (business_id, customer_name, customer_phone, delivery_address, order_items, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *;
      `;
      const result = await db.query(insertQuery, [
        businessId, customer_name, customer_phone, delivery_address, JSON.stringify(order_items), 'pending'
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[Orders API] POST / failed:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * PUT /api/orders/:id
 * Update an existing order (status or address).
 */
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID(),
    body('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'no_response']),
    body('delivery_address').optional().trim().notEmpty(),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const orderId = req.params.id;
    const { status, delivery_address } = req.body;

    try {
      // 1. Verify order belongs to the business
      const verifyRes = await db.query(
        'SELECT id FROM orders WHERE id = $1 AND business_id = $2',
        [orderId, businessId]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found or unauthorized.' });
      }

      // 2. If status is confirmed or cancelled, use conversationManager for consistency
      if (status === 'confirmed' || status === 'cancelled') {
        const manualNote = [{
          role: 'system',
          text: `Manual dashboard override applied. Status changed to: ${status}`,
          timestamp: new Date().toISOString()
        }];
        await conversationManager.finalizeOrder(orderId, status, delivery_address, manualNote);
      } else {
        // Simple update for other statuses or just address
        let updateFields = [];
        let queryParams = [orderId, businessId];

        if (status) {
          queryParams.push(status);
          updateFields.push(`status = $${queryParams.length}`);
        }
        if (delivery_address) {
          queryParams.push(delivery_address);
          updateFields.push(`delivery_address = $${queryParams.length}`);
        }

        if (updateFields.length > 0) {
          const updateQuery = `
            UPDATE orders 
            SET ${updateFields.join(', ')} 
            WHERE id = $1 AND business_id = $2 
            RETURNING *;
          `;
          await db.query(updateQuery, queryParams);
        }
      }

      // Fetch the updated order to return
      const finalRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      res.status(200).json(finalRes.rows[0]);
    } catch (error) {
      console.error(`[Orders API] PUT /${orderId} failed:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * DELETE /api/orders/:id
 * Delete an order.
 */
router.delete(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID(),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const orderId = req.params.id;

    try {
      const result = await db.query(
        'DELETE FROM orders WHERE id = $1 AND business_id = $2 RETURNING id',
        [orderId, businessId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found or unauthorized.' });
      }

      res.status(200).json({ message: 'Order deleted successfully.', id: orderId });
    } catch (error) {
      console.error(`[Orders API] DELETE /${orderId} failed:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
