/**
 * Webhook Router
 * Handles Shopify and other incoming external webhook requests.
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../services/db');
const whatsappService = require('../services/whatsapp');
const conversationManager = require('../services/conversationManager');

const router = express.Router();

/**
 * POST /webhook/shopify
 * Shopify Webhook receiver. Verifies authenticity, parses the payload,
 * saves the order, responds immediately, and triggers the WhatsApp flow.
 * 
 * Query Param: api_key (required) - Authenticates the tenant merchant.
 */
router.post('/shopify', async (req, res) => {
  console.log('Received incoming Shopify webhook request...');

  try {
    const apiKey = req.query.api_key;
    if (!apiKey) {
      console.error('Webhook validation failed: Missing api_key query parameter.');
      return res.status(400).json({ error: 'Bad Request: Missing api_key query parameter' });
    }

    // 1. Identify the business/tenant
    const businessRes = await db.query(
      'SELECT id, name FROM businesses WHERE api_key = $1',
      [apiKey]
    );

    if (businessRes.rows.length === 0) {
      console.error(`Unauthorized webhook: Business not found for api_key '${apiKey}'.`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    const business = businessRes.rows[0];
    console.log(`Webhook authenticated for business: ${business.name} (${business.id})`);

    // 2. Verify Shopify HMAC signature
    const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];

    if (shopifySecret) {
      if (!hmacHeader) {
        console.error('Webhook signature check failed: Missing x-shopify-hmac-sha256 header.');
        return res.status(401).json({ error: 'Unauthorized: Missing HMAC signature' });
      }

      const calculatedHmac = crypto
        .createHmac('sha256', shopifySecret)
        .update(req.rawBody || '')
        .digest('base64');

      const a = Buffer.from(calculatedHmac, 'utf8');
      const b = Buffer.from(hmacHeader, 'utf8');

      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        console.error('Webhook signature check failed: HMAC mismatch.');
        return res.status(401).json({ error: 'Unauthorized: Invalid HMAC signature' });
      }
      console.log('Shopify webhook HMAC signature verified successfully.');
    } else {
      console.warn('WARNING: SHOPIFY_WEBHOOK_SECRET is not configured. Signature verification is bypassed.');
    }

    // 3. Extract payload fields
    const orderData = req.body;
    
    // Shopify order identifier
    const shopifyOrderId = orderData.id ? orderData.id.toString() : '';
    if (!shopifyOrderId) {
      console.error('Webhook validation failed: Payload is missing the order id.');
      return res.status(400).json({ error: 'Bad Request: Missing order id' });
    }

    // Customer name formatting
    const customerName = `${orderData.customer?.first_name || ''} ${orderData.customer?.last_name || ''}`.trim() || 'Valued Customer';
    
    // Customer phone formatting
    const customerPhone = orderData.shipping_address?.phone || orderData.customer?.phone || orderData.billing_address?.phone || '';
    
    // Shipping Address formatting
    const shipping = orderData.shipping_address || {};
    const deliveryAddress = [
      shipping.address1,
      shipping.address2,
      shipping.city,
      shipping.province,
      shipping.country,
      shipping.zip
    ].filter(Boolean).join(', ') || 'No shipping address provided';

    // Line items structure (product title and quantity)
    const orderItems = (orderData.line_items || []).map(item => ({
      title: item.title || item.name,
      quantity: item.quantity,
      price: item.price
    }));

    console.log(`Parsing Shopify Order: #${shopifyOrderId} for ${customerName} (Phone: ${customerPhone})`);

    // 4. Save to PostgreSQL database
    const insertQuery = `
      INSERT INTO orders (business_id, shopify_order_id, customer_name, customer_phone, order_items, delivery_address, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const orderInsertRes = await db.query(insertQuery, [
      business.id,
      shopifyOrderId,
      customerName,
      customerPhone,
      JSON.stringify(orderItems),
      deliveryAddress,
      'pending'
    ]);

    const localOrderId = orderInsertRes.rows[0].id;
    console.log(`Saved order to local DB with UUID: ${localOrderId}`);

    // 5. Respond 200 OK immediately
    res.status(200).json({
      status: 'ok',
      message: 'Webhook processed successfully',
      order_id: localOrderId
    });

    // Reconstruct the order object to start conversation manager
    const orderObj = {
      id: localOrderId,
      business_id: business.id,
      business_name: business.name,
      shopify_order_id: shopifyOrderId,
      customer_name: customerName,
      customer_phone: customerPhone,
      order_items: orderItems,
      delivery_address: deliveryAddress,
      status: 'pending'
    };

    // 6. Trigger WhatsApp Flow in background (no await here for rapid response)
    conversationManager.startConversation(orderObj).catch(err => {
      console.error(`Background error in startConversation for order ${localOrderId}:`, err.stack || err);
    });

  } catch (error) {
    console.error('Error processing Shopify webhook:', error.stack || error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /webhook/whatsapp
 * WhatsApp webhook receiver for 360dialog.
 * Processes incoming chat replies (e.g. HAAN/NAHI) from customers.
 */
router.post('/whatsapp', async (req, res) => {
  console.log('Received incoming WhatsApp webhook request...');

  try {
    const payload = req.body;
    
    // Parse the message using the WhatsApp service
    const messageData = whatsappService.receiveMessage(payload);

    if (!messageData) {
      // Return 200 to acknowledge status updates (sent, delivered, read) to prevent webhook blockage
      return res.status(200).json({ status: 'ok', message: 'Status update or non-message webhook acknowledged' });
    }

    console.log(`Received message from ${messageData.from}: "${messageData.text}" (ID: ${messageData.id})`);

    // Acknowledge receipt of the webhook to 360dialog immediately
    res.status(200).json({ status: 'ok', message: 'Message webhook received' });

    // Background execution of conversation handling via conversationManager
    conversationManager.handleIncomingReply(messageData.from, messageData.text).catch(err => {
      console.error(`Background error in handleIncomingReply for customer ${messageData.from}:`, err.stack || err);
    });
    
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error.stack || error);
    // WhatsApp/360dialog expects a 200 OK status to avoid retries or webhook suspension
    res.status(200).json({ error: 'Internal server error handled' });
  }
});

module.exports = router;
