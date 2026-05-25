// src/api/client.js
// Axios instance configured for the COD backend API
// All API calls go through this client so we have one place to set headers

import axios from 'axios'

// Base URL — during dev, Vite proxies /api to localhost:3000
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach JWT token from localStorage on every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cod_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401 (token expired) globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale credentials and redirect to login
      localStorage.removeItem('cod_token')
      localStorage.removeItem('cod_business')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
