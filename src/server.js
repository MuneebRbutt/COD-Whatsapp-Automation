/**
 * Main entry point for the COD Order Confirmation Platform backend.
 * Configures the Express application, middleware, routes, and error handlers.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { startFollowUpJob } = require('./jobs/followUp');

// Initialize the Express application
const app = express();

// Determine the port from environment variables, defaulting to 3000
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing (CORS)
// Configure to allow Vercel frontend and local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL // Vercel URL from environment variables
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1 && process.env.NODE_ENV !== 'production') {
      // In development, allow all origins if not explicitly listed
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Configure body-parser middleware to parse incoming request bodies
// We store the raw request body in req.rawBody to verify Shopify's HMAC signatures
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Root Route
 * Provides basic information about the API and prevents "Cannot GET /" errors on Railway.
 */
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'COD Whatsapp Automation API is running.',
    version: '1.0.0',
    status: 'healthy',
    documentation: 'https://github.com/MuneebRbutt/COD-Whatsapp-Automation'
  });
});

/**
 * Health Check Endpoint
 * Used to verify the server is running and healthy.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/profile', require('./routes/profile'));
app.use('/webhook', require('./routes/webhook'));

// --- Static File Serving (For Single-Domain Deployment) ---
// Serve static assets from the dashboard/dist folder
app.use(express.static(path.join(__dirname, '../dashboard/dist')));

// Catch-all route: Send all other requests to the React app's index.html
// This handles client-side routing (e.g., /orders, /settings)
app.get('*', (req, res) => {
  // If the request is for an API route that wasn't caught, return 404
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
});

// Backward compatibility or other dashboard routes if any
// app.use('/', require('./routes/dashboard')); // Disabled in favor of clean /api structure

/**
 * Global Error Handler Middleware
 */
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message || err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});

// Start listening for incoming HTTP requests
const server = app.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  
  // Start the follow-up cron job (runs every 30 minutes)
  startFollowUpJob();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
