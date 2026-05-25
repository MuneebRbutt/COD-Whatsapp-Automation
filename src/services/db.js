/**
 * Database service using the pg library.
 * Creates a connection pool to PostgreSQL and provides query helper functions.
 */

const { Pool } = require('pg');

// Determine if we should connect via connection string or individual components.
// DATABASE_URL takes precedence.
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432', 10),
    };

// Initialize the PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Event listener for successful connections
pool.on('connect', () => {
  console.log('Database pool connected successfully');
});

// Event listener for unexpected errors on idle clients
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

/**
 * Execute a SQL query.
 * @param {string} text - The SQL query text.
 * @param {Array} params - The query parameters.
 * @returns {Promise<Object>} The query result object.
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log queries in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`Executed query: ${text.replace(/\s+/g, ' ').slice(0, 100)}... [Duration: ${duration}ms]`);
    }
    return res;
  } catch (error) {
    console.error('Database query error:', {
      text,
      error: error.message || error,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions.
 * @returns {Promise<Object>} A pg client instance.
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Set a safety timeout to warn about unreleased database clients
  const timeout = setTimeout(() => {
    console.error('A database client has been checked out for more than 10 seconds!');
    console.error('Check for potential connection leaks.');
  }, 10000);

  client.release = (err) => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client, [err]);
  };

  return client;
}

module.exports = {
  query,
  getClient,
  pool,
};
