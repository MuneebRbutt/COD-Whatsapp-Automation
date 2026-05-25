// src/App.jsx
// Root component — sets up routing and auth context

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Context
import { AuthProvider } from './context/AuthContext'

// Layout components
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'

// Pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* All protected routes — require JWT token */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Main dashboard */}
              <Route index element={<DashboardPage />} />

              {/* Orders list */}
              <Route path="orders" element={<OrdersPage />} />

              {/* Order detail with conversation history */}
              <Route path="orders/:id" element={<OrderDetailPage />} />

              {/* Business settings */}
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all: redirect unknown paths to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
