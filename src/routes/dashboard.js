/**
 * Dashboard Router
 * Handles merchant authentication, order lists, stats, individual order details,
 * and manual confirmation overrides.
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../services/db');
const authenticateToken = require('../middleware/auth');
const conversationManager = require('../services/conversationManager');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper middleware to handle express-validator validation results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * POST /auth/signup
 * Register a new business account. Generates a unique API key.
 */
router.post(
  '/auth/signup',
  [
    body('name').trim().notEmpty().withMessage('Business name is required.'),
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('whatsapp_number').trim().notEmpty().withMessage('WhatsApp number is required.'),
    validateRequest
  ],
  async (req, res) => {
    const { name, email, password, whatsapp_number } = req.body;
    console.log(`[Dashboard Auth] Signup attempt for email: ${email}`);

    try {
      // 1. Check if email is already registered
      const checkRes = await db.query('SELECT id FROM businesses WHERE email = $1', [email]);
      if (checkRes.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered.' });
      }

      // 2. Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Insert new business record
      const insertQuery = `
        INSERT INTO businesses (name, email, password_hash, whatsapp_number, language_preference)
        VALUES ($1, $2, $3, $4, 'both')
        RETURNING id, name, email, api_key, whatsapp_number;
      `;
      const result = await db.query(insertQuery, [name, email, hashedPassword, whatsapp_number]);
      const business = result.rows[0];

      // 4. Generate JWT Access Token
      const token = jwt.sign(
        { id: business.id, email: business.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`[Dashboard Auth] Business successfully registered: ${business.name} (ID: ${business.id})`);
      res.status(201).json({
        token,
        business: {
          id: business.id,
          name: business.name,
          email: business.email,
          api_key: business.api_key,
          whatsapp_number: business.whatsapp_number
        }
      });

    } catch (error) {
      console.error('[Dashboard Auth] Signup failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * POST /auth/login
 * Business dashboard login endpoint. Returns JWT token on success.
 */
router.post(
  '/auth/login',
  [
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
    validateRequest
  ],
  async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Dashboard Auth] Login attempt for email: ${email}`);

    try {
      // 1. Check if business exists
      const result = await db.query('SELECT * FROM businesses WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }
      const business = result.rows[0];

      // 2. Validate password
      const isMatch = await bcrypt.compare(password, business.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      // 3. Generate JWT Token
      const token = jwt.sign(
        { id: business.id, email: business.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`[Dashboard Auth] User successfully logged in: ${business.name}`);
      res.status(200).json({
        token,
        business: {
          id: business.id,
          name: business.name,
          email: business.email,
          api_key: business.api_key,
          whatsapp_number: business.whatsapp_number
        }
      });

    } catch (error) {
      console.error('[Dashboard Auth] Login failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * GET /dashboard/orders
 * Returns list of orders for the authenticated business, with conversation details.
 * Supports filters and pagination.
 */
router.get(
  '/dashboard/orders',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'confirmed', 'cancelled', 'no_response']),
    query('date_from').optional().isISO8601().withMessage('date_from must be a valid ISO8601 date.'),
    query('date_to').optional().isISO8601().withMessage('date_to must be a valid ISO8601 date.'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const { status, date_from, date_to, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      let queryParams = [businessId];
      let paramCount = 1;
      let filterClauses = '';

      // Apply status filter
      if (status) {
        queryParams.push(status);
        paramCount++;
        filterClauses += ` AND o.status = $${paramCount}`;
      }

      // Apply date filters
      if (date_from) {
        queryParams.push(date_from);
        paramCount++;
        filterClauses += ` AND o.created_at >= $${paramCount}`;
      }
      if (date_to) {
        queryParams.push(date_to);
        paramCount++;
        filterClauses += ` AND o.created_at <= $${paramCount}`;
      }

      // 1. Get total matching count
      const countQuery = `
        SELECT COUNT(*) 
        FROM orders o 
        WHERE o.business_id = $1 ${filterClauses}
      `;
      const countRes = await db.query(countQuery, queryParams);
      const totalCount = parseInt(countRes.rows[0].count, 10);

      // 2. Fetch paginated orders with conversation status
      // We push limit and offset variables to parameter array
      queryParams.push(limit);
      const limitParamIndex = paramCount + 1;
      
      queryParams.push(offset);
      const offsetParamIndex = paramCount + 2;

      const ordersQuery = `
        SELECT 
          o.id, o.shopify_order_id, o.customer_name, o.customer_phone, 
          o.order_items, o.delivery_address, o.status, o.created_at,
          o.follow_up_sent, o.follow_up_sent_at, o.needs_manual_review,
          c.current_state as conversation_state, c.last_updated as conversation_last_updated
        FROM orders o
        LEFT JOIN conversations c ON o.id = c.order_id
        WHERE o.business_id = $1 ${filterClauses}
        ORDER BY o.created_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;

      const ordersRes = await db.query(ordersQuery, queryParams);

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
      console.error('[Dashboard API] GET /orders failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * GET /dashboard/stats
 * Returns monthly summary stats for the business: total, confirmed (count & %), cancelled, no_response,
 * and average confirmation time in minutes.
 */
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  const businessId = req.business.id;
  console.log(`[Dashboard API] GET /stats requested by business: ${businessId}`);

  try {
    // 1. Fetch count metrics for current month
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

    // 2. Fetch average confirmation time (minutes) for this month's confirmed orders
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
    console.error('[Dashboard API] GET /stats failed:', error.stack || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /dashboard/orders/:orderId
 * Retrieve a specific order with its messages conversation history.
 */
router.get(
  '/dashboard/orders/:orderId',
  authenticateToken,
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const orderId = req.params.orderId;
    console.log(`[Dashboard API] GET /orders/${orderId} requested by business: ${businessId}`);

    try {
      const orderQuery = `
        SELECT 
          o.id, o.shopify_order_id, o.customer_name, o.customer_phone, 
          o.order_items, o.delivery_address, o.status, o.created_at,
          o.follow_up_sent, o.follow_up_sent_at, o.needs_manual_review,
          c.messages, c.current_state as conversation_state, c.last_updated as conversation_last_updated
        FROM orders o
        LEFT JOIN conversations c ON o.id = c.order_id
        WHERE o.id = $1 AND o.business_id = $2;
      `;
      const result = await db.query(orderQuery, [orderId, businessId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      res.status(200).json(result.rows[0]);

    } catch (error) {
      console.error(`[Dashboard API] GET /orders/${orderId} failed:`, error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * PUT /dashboard/orders/:orderId/override
 * Allows manual human intervention to force confirm or cancel a customer's order.
 */
router.put(
  '/dashboard/orders/:orderId/override',
  authenticateToken,
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
    body('status').isIn(['confirmed', 'cancelled']).withMessage('Status must be confirmed or cancelled.'),
    body('delivery_address').optional().trim().notEmpty().withMessage('Delivery address cannot be empty.'),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const orderId = req.params.orderId;
    const { status, delivery_address } = req.body;
    console.log(`[Dashboard API] PUT /orders/${orderId}/override forced to: ${status} by business: ${businessId}`);

    try {
      // 1. Verify order belongs to the business
      const verifyRes = await db.query(
        'SELECT id FROM orders WHERE id = $1 AND business_id = $2',
        [orderId, businessId]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      // 2. Finalize order using conversationManager to maintain consistency
      // Add custom manual override note in history
      const manualNote = [{
        role: 'system',
        text: `Manual dashboard override applied by merchant. Force changed status to: ${status}`,
        timestamp: new Date().toISOString()
      }];

      await conversationManager.finalizeOrder(orderId, status, delivery_address, manualNote);

      res.status(200).json({
        status: 'success',
        message: `Order status successfully overridden to ${status}.`
      });

    } catch (error) {
      console.error(`[Dashboard API] PUT /orders/${orderId}/override failed:`, error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * GET /dashboard/profile
 * Returns the authenticated business's full profile including api_key.
 */
router.get('/dashboard/profile', authenticateToken, async (req, res) => {
  const businessId = req.business.id;
  try {
    const result = await db.query(
      'SELECT id, name, email, api_key, whatsapp_number, language_preference, created_at FROM businesses WHERE id = $1',
      [businessId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found.' });
    }
    res.status(200).json({ business: result.rows[0] });
  } catch (error) {
    console.error('[Dashboard API] GET /profile failed:', error.stack || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * PUT /dashboard/settings
 * Update business settings (currently language_preference).
 */
router.put(
  '/dashboard/settings',
  authenticateToken,
  [
    body('language_preference')
      .isIn(['urdu', 'english', 'both'])
      .withMessage('Language preference must be urdu, english, or both.'),
    validateRequest
  ],
  async (req, res) => {
    const businessId = req.business.id;
    const { language_preference } = req.body;
    try {
      await db.query(
        'UPDATE businesses SET language_preference = $1 WHERE id = $2',
        [language_preference, businessId]
      );
      console.log(`[Dashboard API] Business ${businessId} updated language_preference to: ${language_preference}`);
      res.status(200).json({ message: 'Settings updated successfully.', language_preference });
    } catch (error) {
      console.error('[Dashboard API] PUT /settings failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
