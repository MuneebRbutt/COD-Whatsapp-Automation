/**
 * AI Conversation Service
 * Manages chat interactions with Anthropic Claude API to confirm COD orders,
 * verify addresses, and process customer responses in Roman Urdu, Urdu, and English.
 */

const axios = require('axios');
const db = require('./db');

// Retrieve Anthropic API Key from environment variables
const ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Extracts and parses a JSON object from Claude's text response.
 * Handles cases where Claude wraps JSON in markdown blocks or prepends text.
 * 
 * @param {string} text - The raw response string from Claude.
 * @returns {Object} The parsed JSON response.
 * @throws {Error} If no valid JSON could be extracted.
 */
function extractJSON(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Attempt to extract JSON from markdown triple backticks (```json ... ```)
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      try {
        return JSON.parse(markdownMatch[1].trim());
      } catch (innerErr) {
        console.error('[AI Service] Failed to parse JSON from markdown block:', innerErr);
      }
    }

    // Fallback: Locate the first '{' and last '}' characters and slice the string
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        console.error('[AI Service] Failed to parse sliced braces content:', innerErr);
      }
    }

    throw new Error(`Failed to extract valid JSON from Claude reply. Raw response: "${text}"`);
  }
}

/**
 * Processes a customer's WhatsApp response by querying Claude AI.
 * Claude analyzes the context, decides the next message, and determines order status.
 * 
 * @param {Object} order - The database order object.
 * @param {Array} conversationHistory - The array of historical message logs for this conversation.
 * @param {string} customerMessage - The latest message text received from the customer.
 * @returns {Promise<Object>} Object containing { reply, orderStatus, updatedAddress, confidence }.
 */
async function processCustomerReply(order, conversationHistory, customerMessage) {
  console.log(`[AI Service] Processing customer reply for order UUID: ${order.id}`);

  if (!ANTHROPIC_API_KEY) {
    console.error('[AI Service] Anthropic API key is not configured.');
    throw new Error('Anthropic API key is missing from environment variables.');
  }

  // 1. Fetch business name if not pre-joined on the order
  let businessName = order.business_name;
  if (!businessName && order.business_id) {
    try {
      const businessRes = await db.query('SELECT name FROM businesses WHERE id = $1', [order.business_id]);
      if (businessRes.rows.length > 0) {
        businessName = businessRes.rows[0].name;
      }
    } catch (dbErr) {
      console.error('[AI Service] Error loading business name for order:', dbErr.message);
    }
  }
  businessName = businessName || 'our store';

  // 2. Format order items for context
  let itemsArray = [];
  if (Array.isArray(order.order_items)) {
    itemsArray = order.order_items;
  } else if (typeof order.order_items === 'string') {
    try {
      itemsArray = JSON.parse(order.order_items);
    } catch (e) {
      console.error('[AI Service] Error parsing order_items JSON string:', e);
    }
  }
  const orderItemsText = itemsArray
    .map(item => `${item.quantity}x ${item.title || item.name}`)
    .join(', ') || 'No items listed';

  // 3. Reconstruct outbound template text to form first assistant message
  const outboundItemsList = itemsArray
    .map(item => `- ${item.quantity}x ${item.title || item.name}`)
    .join('\n');
  const outboundTemplateText = `Assalam o Alaikum ${order.customer_name}! Aapka order confirm karne ke liye yeh message bheja gaya hai.

Order:
${outboundItemsList}

Address: ${order.delivery_address || 'No address provided'}

Kya aap yeh order confirm karte hain?
Reply karein: HAAN ya NAHI`;

  // 4. Build system prompt
  const systemPrompt = `You are an order confirmation assistant for ${businessName}. 
You are confirming a COD (Cash on Delivery) order via WhatsApp.
Be friendly, brief, and professional.
Always reply in the same language the customer uses.
If they write in Urdu or Roman Urdu, reply in Roman Urdu.
If they write in English, reply in English.

Current order details:
- Customer: ${order.customer_name}
- Items: ${orderItemsText}
- Address: ${order.delivery_address}
- Order ID: ${order.shopify_order_id || order.id}

Your goals in order:
1. Confirm the customer placed this order (yes/no)
2. Verify delivery address is correct
3. If anything needs to change, collect the updated info
4. End conversation clearly with confirmed or cancelled status

After each customer message, you must respond with JSON only in this format:
{
  "reply": "your whatsapp message to customer",
  "orderStatus": "pending/confirmed/cancelled/needs_info",
  "updatedAddress": "new address if changed or null",
  "confidence": "high/medium/low"
}`;

  // 5. Structure conversation history (ensure alternating user/assistant messages)
  const messages = [];

  // Claude requires a user message to begin the chat context
  messages.push({
    role: 'user',
    content: 'Start order confirmation flow.'
  });

  // Outbound message sent from our platform acts as the first assistant response
  messages.push({
    role: 'assistant',
    content: outboundTemplateText
  });

  // Load chat history from DB, filtering out metadata logs
  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (msg.text && !msg.text.startsWith('Order confirmation message sent.')) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.text
        });
      }
    }
  }

  // Add the newly received customer message
  messages.push({
    role: 'user',
    content: customerMessage
  });

  // 6. Request processing from Claude API
  try {
    const payload = {
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    };

    const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });

    if (response.data && response.data.content && response.data.content[0]) {
      const rawText = response.data.content[0].text;
      console.log(`[AI Service] Claude reply raw text: ${rawText}`);
      
      const structuredResponse = extractJSON(rawText);
      return {
        reply: structuredResponse.reply,
        orderStatus: structuredResponse.orderStatus || 'pending',
        updatedAddress: structuredResponse.updatedAddress || null,
        confidence: structuredResponse.confidence || 'medium'
      };
    } else {
      throw new Error('Empty content block in Claude API response');
    }
  } catch (error) {
    console.error('[AI Service] Anthropic Claude API Call Failed:', error.response?.data || error.message);
    throw new Error(`Claude AI API failure: ${error.response?.data?.error?.message || error.message}`);
  }
}

module.exports = {
  processCustomerReply
};
