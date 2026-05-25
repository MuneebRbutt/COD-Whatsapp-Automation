/**
 * Main entry point for the COD Order Confirmation Platform backend.
 * Configures the Express application, middleware, routes, and error handlers.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { startFollowUpJob } = require('./jobs/followUp');

// Initialize the Express application
const app = express();

// Determine the port from environment variables, defaulting to 3000
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Configure body-parser middleware to parse incoming request bodies
// We store the raw request body in req.rawBody to verify Shopify's HMAC signatures
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Register Routes
app.use('/webhook', require('./routes/webhook'));
app.use('/', require('./routes/dashboard'));

/**
 * Health Check Endpoint
 * Used to verify the server is running and healthy.
 * Returns: { status: "ok" }
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Global Error Handler Middleware
 * Catches all unhandled errors in route handlers and middleware.
 * Prevents the application from crashing silently.
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
