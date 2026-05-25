/**
 * Conversation State Manager
 * Handles the full lifecycle of customer confirmation conversations,
 * managing transitions, database queries, and calling AI and WhatsApp services.
 */

const db = require('./db');
const whatsappService = require('./whatsapp');
const aiConversation = require('./aiConversation');
const { normalizePhone } = require('../utils/phoneFormatter');

/**
 * Starts a new order confirmation conversation.
 * Inserts/updates the conversation record and dispatches the initial WhatsApp template.
 * 
 * @param {Object} order - The saved order object from the database.
 * @returns {Promise<void>}
 */
async function startConversation(order) {
  console.log(`[Conversation Manager] Starting conversation for order: ${order.id}`);
  const client = await db.getClient();

  try {
    // 1. Send the initial bilingual template message
    const messageId = await whatsappService.sendConfirmationMessage(order);

    // 2. Prepare the initial conversation log entry
    const initialMessage = {
      role: 'assistant',
      text: `Order confirmation message sent. Message ID: ${messageId}`,
      timestamp: new Date().toISOString()
    };

    await client.query('BEGIN');

    // 3. Insert or update the conversation record in a transaction
    const checkRes = await client.query('SELECT id FROM conversations WHERE order_id = $1', [order.id]);
    if (checkRes.rows.length > 0) {
      await client.query(
        'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE order_id = $3',
        [JSON.stringify([initialMessage]), 'awaiting_reply', order.id]
      );
    } else {
      await client.query(
        'INSERT INTO conversations (order_id, messages, current_state, last_updated) VALUES ($1, $2, $3, NOW())',
        [order.id, JSON.stringify([initialMessage]), 'awaiting_reply']
      );
    }

    await client.query('COMMIT');
    console.log(`[Conversation Manager] Conversation started successfully for order: ${order.id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Conversation Manager] Failed to start conversation for order ${order.id}:`, error.stack || error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handles incoming customer replies via WhatsApp webhook.
 * Identifies active conversations, passes context to Claude, replies to the user,
 * and handles order finalization if confirmation or cancellation is detected.
 * 
 * @param {string} rawPhoneNumber - The phone number of the customer who replied.
 * @param {string} messageText - The reply text sent by the customer.
 * @returns {Promise<void>}
 */
async function handleIncomingReply(rawPhoneNumber, messageText) {
  const normalizedNum = normalizePhone(rawPhoneNumber);
  console.log(`[Conversation Manager] Handling incoming reply from: ${normalizedNum}. Message: "${messageText}"`);

  // Query to find an active conversation matching the phone number
  // Regex removes non-digits from customer_phone to compare with incoming normalized number
  const findActiveConvQuery = `
    SELECT c.*, o.id as order_uuid, o.customer_name, o.customer_phone, o.delivery_address, o.shopify_order_id, o.order_items, o.business_id
    FROM conversations c
    JOIN orders o ON c.order_id = o.id
    WHERE (
      regexp_replace(o.customer_phone, '\\D', '', 'g') = $1
      OR regexp_replace(o.customer_phone, '\\D', '', 'g') = regexp_replace($1, '^92', '0')
    )
    AND c.current_state IN ('awaiting_reply', 'follow_up_sent')
    ORDER BY c.last_updated DESC
    LIMIT 1;
  `;

  try {
    const activeConvRes = await db.query(findActiveConvQuery, [normalizedNum]);
    
    // Handle case where no active conversation is found
    if (activeConvRes.rows.length === 0) {
      console.warn(`[Conversation Manager] No active conversation found for phone number: ${rawPhoneNumber}`);
      
      // Optional: Respond to let the customer know they don't have a pending confirmation
      const fallbackReply = "Assalam o Alaikum! Hum aap ke order details fetch nahi kar sake. Agar koi sawal hai toh humse rabta karein.";
      try {
        await whatsappService.sendMessage(rawPhoneNumber, fallbackReply);
      } catch (whatsappErr) {
        console.error('[Conversation Manager] Failed to send fallback message:', whatsappErr.message);
      }
      return;
    }

    const conversation = activeConvRes.rows[0];
    
    // Re-structure order object for Claude
    const order = {
      id: conversation.order_uuid,
      business_id: conversation.business_id,
      shopify_order_id: conversation.shopify_order_id,
      customer_name: conversation.customer_name,
      customer_phone: conversation.customer_phone,
      delivery_address: conversation.delivery_address,
      order_items: conversation.order_items
    };

    // Get current chat history
    let chatHistory = [];
    if (Array.isArray(conversation.messages)) {
      chatHistory = conversation.messages;
    } else if (typeof conversation.messages === 'string') {
      chatHistory = JSON.parse(conversation.messages);
    }

    // 1. Process customer message with Claude
    const aiResponse = await aiConversation.processCustomerReply(order, chatHistory, messageText);
    console.log(`[Conversation Manager] Claude response:`, aiResponse);

    // 2. Dispatch AI response back to customer
    await whatsappService.sendMessage(conversation.customer_phone, aiResponse.reply);

    // 3. Append messages to history
    const userMsgLog = { role: 'user', text: messageText, timestamp: new Date().toISOString() };
    const assistantMsgLog = { role: 'assistant', text: aiResponse.reply, timestamp: new Date().toISOString() };
    const updatedMessages = [...chatHistory, userMsgLog, assistantMsgLog];

    // 4. If AI determines the conversation is finalized
    if (aiResponse.orderStatus === 'confirmed' || aiResponse.orderStatus === 'cancelled') {
      await finalizeOrder(order.id, aiResponse.orderStatus, aiResponse.updatedAddress, updatedMessages);
    } else {
      // Otherwise, save conversation state and await next response
      await db.query(
        'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE id = $3',
        [JSON.stringify(updatedMessages), 'awaiting_reply', conversation.id]
      );
      console.log(`[Conversation Manager] Conversation state updated for order ${order.id}. Awaiting next reply.`);
    }

  } catch (error) {
    console.error('[Conversation Manager] Error in handleIncomingReply:', error.stack || error.message);
    throw error;
  }
}

/**
 * Finalizes an order status, updates the delivery address if changed,
 * archives the conversation, and sends a final notification message.
 * 
 * @param {string} orderId - The UUID of the order in database.
 * @param {string} status - The status to set ('confirmed' or 'cancelled').
 * @param {string|null} updatedAddress - The updated shipping address, if any.
 * @param {Array} messagesToSave - The final set of conversation messages to store.
 * @returns {Promise<void>}
 */
async function finalizeOrder(orderId, status, updatedAddress, messagesToSave = null) {
  console.log(`[Conversation Manager] Finalizing order ${orderId} as '${status}'. Updated address: "${updatedAddress}"`);
  
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Update order status and address (if updated)
    if (status === 'confirmed') {
      console.log(`[Conversation Manager] Confirmation Time Logged: ${new Date().toISOString()} for order ${orderId}`);
    }

    if (updatedAddress) {
      await client.query(
        'UPDATE orders SET status = $1, delivery_address = $2 WHERE id = $3',
        [status, updatedAddress, orderId]
      );
    } else {
      await client.query(
        'UPDATE orders SET status = $1 WHERE id = $2',
        [status, orderId]
      );
    }

    // 2. Fetch active conversation details to retrieve phone and update history
    const convRes = await client.query('SELECT id, messages FROM conversations WHERE order_id = $1', [orderId]);
    if (convRes.rows.length === 0) {
      throw new Error(`Conversation not found for order ID: ${orderId}`);
    }
    const conversation = convRes.rows[0];

    // Determine final messages representation
    let finalMessages = messagesToSave;
    if (!finalMessages) {
      const existingHistory = Array.isArray(conversation.messages) ? conversation.messages : JSON.parse(conversation.messages || '[]');
      finalMessages = [...existingHistory];
    }
    
    // Add completion log to history
    finalMessages.push({
      role: 'system',
      text: `Conversation ended. Order finalized as: ${status}`,
      timestamp: new Date().toISOString()
    });

    // 3. Mark conversation as completed
    await client.query(
      'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE id = $3',
      [JSON.stringify(finalMessages), 'completed', conversation.id]
    );

    // Fetch order phone to send final message
    const orderRes = await client.query('SELECT customer_phone FROM orders WHERE id = $1', [orderId]);
    const phone = orderRes.rows[0].customer_phone;

    await client.query('COMMIT');

    // 4. Send final message to customer (non-blocking outside transaction)
    const finalNotification = status === 'confirmed'
      ? 'Aapka order confirm ho chuka hai. Jald hi dispatch kar diya jayega. Shukriya!'
      : 'Aapka order cancel kar diya gaya hai. Hamare store par visit karne ka shukriya.';
      
    await whatsappService.sendMessage(phone, finalNotification);
    console.log(`[Conversation Manager] Order ${orderId} finalized. Final notification dispatched.`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Conversation Manager] Failed to finalize order ${orderId}:`, error.stack || error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handles automated escalation or expiration when a customer fails to reply.
 * - After 3 hours: sends a gentle reminder message and updates state.
 * - After 6 hours total: marks conversation and order as expired ('no_response').
 * 
 * @param {string} orderId - The UUID of the order in database.
 * @returns {Promise<void>}
 */
async function handleNoResponse(orderId) {
  console.log(`[Conversation Manager] Running handleNoResponse check for order: ${orderId}`);
  
  try {
    const convRes = await db.query(
      'SELECT c.*, o.customer_phone, o.customer_name FROM conversations c JOIN orders o ON c.order_id = o.id WHERE c.order_id = $1',
      [orderId]
    );

    if (convRes.rows.length === 0) {
      console.warn(`[Conversation Manager] Conversation not found for order: ${orderId}`);
      return;
    }

    const conversation = convRes.rows[0];
    const phone = conversation.customer_phone;
    const chatHistory = Array.isArray(conversation.messages) ? conversation.messages : JSON.parse(conversation.messages || '[]');

    if (conversation.current_state === 'awaiting_reply') {
      // 3 Hours: Send one gentle reminder message
      console.log(`[Conversation Manager] Order ${orderId} reached 3-hour mark without reply. Sending follow up...`);
      
      const reminderText = `Assalam o Alaikum! Hum aapke reply ka intezar kar rahe hain. Kya aap apna order confirm karna chahte hain? Reply karein: HAAN ya NAHI`;
      await whatsappService.sendMessage(phone, reminderText);

      const reminderLog = { role: 'assistant', text: reminderText, timestamp: new Date().toISOString() };
      const updatedMessages = [...chatHistory, reminderLog];

      await db.query(
        'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE id = $3',
        [JSON.stringify(updatedMessages), 'follow_up_sent', conversation.id]
      );
      console.log(`[Conversation Manager] Order ${orderId} conversation state escalated to 'follow_up_sent'.`);

    } else if (conversation.current_state === 'follow_up_sent') {
      // 6 Hours total: Mark conversation and order as expired ('no_response')
      console.log(`[Conversation Manager] Order ${orderId} reached 6-hour mark without reply. Closing conversation...`);

      const expirationLog = { role: 'system', text: 'Conversation expired due to no response.', timestamp: new Date().toISOString() };
      const updatedMessages = [...chatHistory, expirationLog];

      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        
        // Update order status
        await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['no_response', orderId]);
        
        // Mark conversation state
        await client.query(
          'UPDATE conversations SET messages = $1, current_state = $2, last_updated = NOW() WHERE id = $3',
          [JSON.stringify(updatedMessages), 'no_response', conversation.id]
        );

        await client.query('COMMIT');
        console.log(`[Conversation Manager] Order ${orderId} and conversation marked as 'no_response'.`);
      } catch (txnErr) {
        await client.query('ROLLBACK');
        throw txnErr;
      } finally {
        client.release();
      }
    } else {
      console.log(`[Conversation Manager] Order ${orderId} is in state '${conversation.current_state}'. No action taken.`);
    }

  } catch (error) {
    console.error(`[Conversation Manager] Error in handleNoResponse check for order ${orderId}:`, error.stack || error.message);
  }
}

module.exports = {
  startConversation,
  handleIncomingReply,
  finalizeOrder,
  handleNoResponse
};
