/**
 * Message Queue Service
 * Handles queuing and processing outgoing WhatsApp messages using Bull and Redis,
 * with an automatic in-memory fallback if Redis is offline.
 */

const Queue = require('bull');
const Redis = require('ioredis');
const RedisMock = require('ioredis-mock');
const db = require('./db');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let isRedisOffline = false;

// Create a test client to verify if Redis is available
const testRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  lazyConnect: true
});

testRedis.connect().then(() => {
  console.log('[Message Queue] Redis is running. Outgoing messages will use standard Redis queue.');
  testRedis.disconnect();
}).catch((err) => {
  console.warn(`[Message Queue] Redis is unavailable on port 6379 (${err.message}). Falling back to IN-MEMORY queue.`);
  isRedisOffline = true;
});

/**
 * Custom client builder for Bull queue connection
 */
function createRedisClient(type) {
  if (isRedisOffline) {
    // Shared mock Redis instance
    return new RedisMock();
  }
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

// Initialize the Bull Queue
const outgoingQueue = new Queue('outgoing-messages', {
  createClient: (type) => createRedisClient(type)
});

// Configure the worker to process messages
outgoingQueue.process(async (job) => {
  const { phoneNumber, message } = job.data;
  console.log(`[Message Queue] Sending message to ${phoneNumber} (Attempt ${job.attemptsMade + 1}/3)...`);
  
  // Dynamically import whatsappService to avoid circular dependency
  const whatsappService = require('./whatsapp');
  
  // Call sendDirectMessage which connects directly to the 360dialog API
  const messageId = await whatsappService.sendDirectMessage(phoneNumber, message);
  return { messageId };
});

// Global queue error handler
outgoingQueue.on('error', (error) => {
  console.error('[Message Queue] Bull Queue Error:', error.message || error);
});

// Handle job failures and logs permanently failed messages
outgoingQueue.on('failed', async (job, err) => {
  // If the job has failed after all retries (attempts is 3)
  if (job.attemptsMade >= job.opts.attempts) {
    console.error(`[Message Queue] Job to ${job.data.phoneNumber} failed permanently after 3 attempts. Error: ${err.message}`);
    
    try {
      await db.query(
        `INSERT INTO failed_messages (phone_number, message_body, error_message, attempts)
         VALUES ($1, $2, $3, $4)`,
        [job.data.phoneNumber, job.data.message, err.message, job.attemptsMade]
      );
      console.log(`[Message Queue] Failed message successfully logged to database for: ${job.data.phoneNumber}`);
    } catch (dbErr) {
      console.error('[Message Queue] Failed to write failed message log to database:', dbErr.message);
    }
  } else {
    console.warn(`[Message Queue] Job to ${job.data.phoneNumber} failed (Attempt ${job.attemptsMade}). Retrying in 5 minutes. Error: ${err.message}`);
  }
});

/**
 * Adds an outgoing WhatsApp message to the queue.
 * Configures 3 retries with a 5 minute delay between each attempt.
 * 
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} message - Message text
 * @returns {Promise<string>} The enqueued Job ID
 */
async function enqueueMessage(phoneNumber, message) {
  console.log(`[Message Queue] Enqueuing outgoing message for ${phoneNumber}`);
  
  const job = await outgoingQueue.add(
    { phoneNumber, message },
    {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5 * 60 * 1000 // 5 minutes in milliseconds
      },
      removeOnComplete: true // Delete job representation from memory on success
    }
  );
  
  return job.id;
}

module.exports = {
  enqueueMessage,
  outgoingQueue
};
