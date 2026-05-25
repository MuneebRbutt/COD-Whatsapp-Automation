-- Enable pgcrypto extension for gen_random_uuid() support
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/**
 * Businesses Table (Multi-tenant SaaS)
 * Stores details of the e-commerce businesses using the platform.
 */
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    api_key UUID UNIQUE DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(50),
    language_preference VARCHAR(50) NOT NULL DEFAULT 'both',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/**
 * Orders Table
 * Stores Shopify orders synced to the platform.
 */
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    shopify_order_id VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    order_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    delivery_address TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/**
 * Conversations Table
 * Stores the chat history (in JSON form) and state machine status for each order.
 */
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_state VARCHAR(100) NOT NULL DEFAULT 'pending_verification',
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexing to speed up foreign key lookups and queries
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);

/**
 * Failed Messages Table
 * Logs outgoing WhatsApp messages that failed completely after all Bull queue retries.
 */
CREATE TABLE IF NOT EXISTS failed_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50) NOT NULL,
    message_body TEXT NOT NULL,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

