// src/context/AuthContext.jsx
// Global authentication state — provides login/logout and current user to all components

import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Initialize from localStorage so we survive page refreshes
  const [token, setToken] = useState(() => localStorage.getItem('cod_token'))
  const [business, setBusiness] = useState(() => {
    const stored = localStorage.getItem('cod_business')
    return stored ? JSON.parse(stored) : null
  })

  /**
   * Called after successful login — persists credentials
   */
  const login = (token, business) => {
    localStorage.setItem('cod_token', token)
    localStorage.setItem('cod_business', JSON.stringify(business))
    setToken(token)
    setBusiness(business)
  }

  /**
   * Clears all auth state and redirects to login
   */
  const logout = () => {
    localStorage.removeItem('cod_token')
    localStorage.removeItem('cod_business')
    setToken(null)
    setBusiness(null)
  }

  /**
   * Update local business state (e.g. after settings change)
   */
  const updateBusiness = (updates) => {
    const updated = { ...business, ...updates }
    localStorage.setItem('cod_business', JSON.stringify(updated))
    setBusiness(updated)
  }

  const isAuthenticated = !!token

  return (
    <AuthContext.Provider value={{ token, business, isAuthenticated, login, logout, updateBusiness }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for easy access
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
