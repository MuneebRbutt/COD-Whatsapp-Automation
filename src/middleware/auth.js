/**
 * Auth Middleware
 * Verifies JWT access tokens and attaches the authenticated business to the request object.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[Auth Middleware] WARNING: JWT_SECRET is not configured in environment variables.');
}

/**
 * Express middleware to authenticate requests via JWT.
 * Expects header: "Authorization: Bearer <TOKEN>"
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access Denied: No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET || 'fallback_secret');
    req.business = {
      id: verified.id,
      email: verified.email
    };
    next();
  } catch (error) {
    console.warn(`[Auth Middleware] JWT validation failed: ${error.message}`);
    return res.status(403).json({ error: 'Access Denied: Invalid or expired token.' });
  }
}

module.exports = authenticateToken;
