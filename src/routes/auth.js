/**
 * Auth Router
 * Handles merchant registration and login.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../services/db');

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
 * POST /api/auth/signup
 * Register a new business account.
 */
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Business name is required.'),
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('whatsapp_number').trim().notEmpty().withMessage('WhatsApp number is required.'),
    validateRequest
  ],
  async (req, res) => {
    const { name, email, password, whatsapp_number } = req.body;
    try {
      const checkRes = await db.query('SELECT id FROM businesses WHERE email = $1', [email]);
      if (checkRes.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered.' });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const insertQuery = `
        INSERT INTO businesses (name, email, password_hash, whatsapp_number, language_preference)
        VALUES ($1, $2, $3, $4, 'both')
        RETURNING id, name, email, api_key, whatsapp_number;
      `;
      const result = await db.query(insertQuery, [name, email, hashedPassword, whatsapp_number]);
      const business = result.rows[0];

      const token = jwt.sign(
        { id: business.id, email: business.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

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
      console.error('[Auth API] Signup failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

/**
 * POST /api/auth/login
 * Business dashboard login endpoint.
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email address is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
    validateRequest
  ],
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await db.query('SELECT * FROM businesses WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }
      const business = result.rows[0];

      const isMatch = await bcrypt.compare(password, business.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: business.id, email: business.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

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
      console.error('[Auth API] Login failed:', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = router;
