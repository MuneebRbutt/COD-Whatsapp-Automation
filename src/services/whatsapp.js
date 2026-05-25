/**
 * WhatsApp Service
 * Handles integration with the 360dialog WhatsApp API, number formatting,
 * confirmation templates, and incoming message parsing.
 */

const axios = require('axios');
const db = require('./db');
const { normalizePhone } = require('../utils/phoneFormatter');

// Retrieve configurations from environment variables
const D360_API_KEY = process.env.DIALOG_360_API_KEY || process.env.D360_API_KEY;
const D360_API_URL = process.env.DIALOG_360_API_URL || 'https://waba-v2.360dialog.io';

/**
 * Sends a WhatsApp text message using the 360dialog API.
 * 
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} message - The text content of the message.
 * @returns {Promise<string>} The WhatsApp message ID.
 */
/**
 * Sends a WhatsApp text message immediately using the 360dialog API (used by worker).
 * 
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} message - The text content of the message.
 * @returns {Promise<string>} The WhatsApp message ID.
 */
async function sendDirectMessage(phoneNumber, message) {
  const formattedPhone = normalizePhone(phoneNumber);
  console.log(`[WhatsApp Service] Sending direct API message to: ${formattedPhone}`);
  
  if (!D360_API_KEY) {
    console.error('[WhatsApp Service] D360_API_KEY is missing from environment.');
    throw new Error('360dialog API Key not configured');
  }

  try {
    const payload = {
      to: formattedPhone,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await axios.post(`${D360_API_URL}/v1/messages`, payload, {
      headers: {
        'D360-API-KEY': D360_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      const messageId = response.data.messages[0].id;
      console.log(`[WhatsApp Service] Message successfully sent to ${formattedPhone}. ID: ${messageId}`);
      return messageId;
    } else {
      throw new Error('Invalid response structure from 360dialog API');
    }
  } catch (error) {
    console.error(`[WhatsApp Service] Failed to send message to ${formattedPhone}:`, error.response?.data || error.message);
    throw new Error(`WhatsApp API Error: ${error.response?.data?.errors?.[0]?.title || error.message}`);
  }
}

/**
 * Sends a WhatsApp text message via the Bull message queue.
 * 
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} message - The text content of the message.
 * @returns {Promise<string>} The queue job ID prefixed with 'queued-job-'.
 */
async function sendMessage(phoneNumber, message) {
  const { enqueueMessage } = require('./messageQueue');
  const jobId = await enqueueMessage(phoneNumber, message);
  return `queued-job-${jobId}`;
}

/**
 * Formats and sends a bilingual order confirmation message.
 * 
 * @param {Object} order - The order object from the database.
 * @returns {Promise<string>} The WhatsApp message ID.
 */
async function sendConfirmationMessage(order) {
  console.log(`[WhatsApp Service] Formatting confirmation message for Shopify Order #${order.shopify_order_id}`);

  // Safely parse order items
  let itemsArray = [];
  if (Array.isArray(order.order_items)) {
    itemsArray = order.order_items;
  } else if (typeof order.order_items === 'string') {
    try {
      itemsArray = JSON.parse(order.order_items);
    } catch (e) {
      console.error('[WhatsApp Service] Failed to parse order items:', e);
    }
  }

  // Format list of items
  const itemsList = itemsArray
    .map(item => `- ${item.quantity}x ${item.title || item.name}`)
    .join('\n');

  // Format delivery address
  const address = order.delivery_address || 'No address provided';

  // Construct the bilingual Urdu/Roman Urdu and English message template
  const messageBody = `Assalam o Alaikum ${order.customer_name}! Aapka order confirm karne ke liye yeh message bheja gaya hai.

Order:
${itemsList}

Address: ${address}

Kya aap yeh order confirm karte hain?
Reply karein: HAAN ya NAHI`;

  return await sendMessage(order.customer_phone, messageBody);
}

/**
 * Parses an incoming webhook payload from 360dialog.
 * Extracts details if the payload corresponds to an incoming message.
 * Supports detecting image and voice note types.
 * 
 * @param {Object} webhookPayload - The raw webhook body.
 * @returns {Object|null} Clean message data { from, text, id, type } or null.
 */
function receiveMessage(webhookPayload) {
  if (!webhookPayload || !Array.isArray(webhookPayload.messages) || webhookPayload.messages.length === 0) {
    // Likely a message status update (sent/delivered/read/failed)
    return null;
  }

  const message = webhookPayload.messages[0];
  const from = message.from;
  const id = message.id;
  let text = '';
  let type = 'text';

  // Detect media message types
  if (message.type === 'voice' || message.type === 'audio') {
    type = 'voice';
  } else if (message.type === 'image') {
    type = 'image';
  }

  // Extract text from standard text messages
  if (message.type === 'text' && message.text) {
    text = message.text.body;
  } 
  // Handle interactive buttons (e.g. quick reply HAAN/NAHI buttons)
  else if (message.type === 'interactive' && message.interactive) {
    const interactive = message.interactive;
    if (interactive.type === 'button_reply' && interactive.button_reply) {
      text = interactive.button_reply.title;
    } else if (interactive.type === 'list_reply' && interactive.list_reply) {
      text = interactive.list_reply.title;
    }
  } 
  // Handle old-style quick reply template buttons
  else if (message.type === 'button' && message.button) {
    text = message.button.text;
  }

  return {
    from,
    text: text ? text.trim() : '',
    id,
    type
  };
}

/**
 * Triggers the automated WhatsApp confirmation flow for an order.
 * This is executed asynchronously in the background.
 * 
 * @param {string} orderId - The UUID of the order in the database.
 */
async function triggerConfirmationFlow(orderId) {
  console.log(`[WhatsApp Service] Running confirmation flow for order ID: ${orderId}`);
  try {
    // 1. Fetch order details from database
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      console.error(`[WhatsApp Service] Order ${orderId} not found in database.`);
      return;
    }
    const order = orderRes.rows[0];

    // 2. Format and send the confirmation message
    const messageId = await sendConfirmationMessage(order);

    // 3. Update or create the conversation record
    const initialMessage = {
      role: 'assistant',
      text: `Order confirmation message sent. Message ID: ${messageId}`,
      timestamp: new Date().toISOString()
    };

    const convRes = await db.query('SELECT id FROM conversations WHERE order_id = $1', [order.id]);
    if (convRes.rows.length > 0) {
      await db.query(
        'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE order_id = $3',
        [JSON.stringify([initialMessage]), 'awaiting_confirmation', order.id]
      );
    } else {
      await db.query(
        'INSERT INTO conversations (order_id, messages, current_state, last_updated) VALUES ($1, $2, $3, NOW())',
        [order.id, JSON.stringify([initialMessage]), 'awaiting_confirmation']
      );
    }

    console.log(`[WhatsApp Service] Confirmation message dispatched and conversation state updated to 'awaiting_confirmation'.`);
  } catch (error) {
    console.error(`[WhatsApp Service] Error processing triggerConfirmationFlow for order ${orderId}:`, error.stack || error.message);
  }
}

module.exports = {
  sendMessage,
  sendDirectMessage,
  sendConfirmationMessage,
  receiveMessage,
  triggerConfirmationFlow
};
