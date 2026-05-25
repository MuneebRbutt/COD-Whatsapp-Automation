// src/components/layout/ProtectedRoute.jsx
// Redirects unauthenticated users to /login

import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  // If not logged in, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Otherwise render the child route
  return <Outlet />
}
