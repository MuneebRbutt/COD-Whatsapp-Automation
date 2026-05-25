// src/api/auth.js
// Authentication API calls: login, signup, profile

import apiClient from './client'

/**
 * Log in with email and password
 * Returns { token, business } on success
 */
export const login = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password })
  return response.data
}

/**
 * Register a new business account
 */
export const signup = async (data) => {
  const response = await apiClient.post('/auth/signup', data)
  return response.data
}

/**
 * Get current business profile + API key
 */
export const getProfile = async () => {
  const response = await apiClient.get('/profile')
  return response.data
}

/**
 * Update language preference (urdu | english | both)
 */
export const updateLanguage = async (language_preference) => {
  const response = await apiClient.put('/profile', { language_preference })
  return response.data
}
