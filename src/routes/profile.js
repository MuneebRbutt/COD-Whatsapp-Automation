/**
 * Profile Router
 * Handles business profile information and settings.
 */

const express = require('express');
const db = require('../services/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/profile
 * Returns the current business profile.
 */
router.get('/', authenticateToken, async (req, res) => {
  const businessId = req.business.id;
  try {
    const result = await db.query(
      'SELECT id, name, email, whatsapp_number, language_preference, created_at FROM businesses WHERE id = $1',
      [businessId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('[Profile API] GET / failed:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * PUT /api/profile
 * Updates business settings.
 */
router.put('/', authenticateToken, async (req, res) => {
  const businessId = req.business.id;
  const { language_preference, name, whatsapp_number } = req.body;

  try {
    let updateFields = [];
    let queryParams = [businessId];

    if (language_preference) {
      queryParams.push(language_preference);
      updateFields.push(`language_preference = $${queryParams.length}`);
    }
    if (name) {
      queryParams.push(name);
      updateFields.push(`name = $${queryParams.length}`);
    }
    if (whatsapp_number) {
      queryParams.push(whatsapp_number);
      updateFields.push(`whatsapp_number = $${queryParams.length}`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const updateQuery = `
      UPDATE businesses 
      SET ${updateFields.join(', ')} 
      WHERE id = $1 
      RETURNING id, name, email, whatsapp_number, language_preference;
    `;
    const result = await db.query(updateQuery, queryParams);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('[Profile API] PUT / failed:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
