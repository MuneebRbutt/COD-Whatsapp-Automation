// src/api/orders.js
// All order-related API calls

import apiClient from './client'

/**
 * Fetch orders with optional filters
 * @param {Object} params - { status, date_from, date_to, page, limit }
 */
export const getOrders = async (params = {}) => {
  const response = await apiClient.get('/dashboard/orders', { params })
  return response.data
}

/**
 * Get a single order with full conversation history
 * @param {string} orderId
 */
export const getOrder = async (orderId) => {
  const response = await apiClient.get(`/dashboard/orders/${orderId}`)
  return response.data
}

/**
 * Get aggregate stats for the current business
 */
export const getStats = async () => {
  const response = await apiClient.get('/dashboard/stats')
  return response.data
}

/**
 * Manually override an order's status
 * @param {string} orderId
 * @param {'confirmed' | 'cancelled'} status
 * @param {string} [updatedAddress] - optional new delivery address
 */
export const overrideOrderStatus = async (orderId, status, updatedAddress = null) => {
  const body = { status }
  if (updatedAddress) body.updated_address = updatedAddress
  const response = await apiClient.put(`/dashboard/orders/${orderId}/override`, body)
  return response.data
}
