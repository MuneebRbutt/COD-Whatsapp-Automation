// src/pages/DashboardPage.jsx
// Main dashboard — stats cards + orders table with auto-refresh every 30s

import React, { useState, useEffect, useCallback } from 'react'
import { getStats, getOrders } from '../api/orders'
import StatCard from '../components/dashboard/StatCard'
import OrdersTable from '../components/dashboard/OrdersTable'
import ErrorMessage from '../components/shared/ErrorMessage'
import { useAuth } from '../context/AuthContext'

// Stat card icon components
const TotalIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)
const ConfirmedIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const CancelledIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const NoResponseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

// Auto-refresh interval: 30 seconds
const REFRESH_INTERVAL = 30 * 1000

export default function DashboardPage() {
  const { business } = useAuth()

  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [countdown, setCountdown] = useState(30)

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [])

  // Fetch orders with current filter applied
  const fetchOrders = useCallback(async (filter = '') => {
    setOrdersLoading(true)
    try {
      const params = { limit: 50 }
      if (filter) params.status = filter
      const data = await getOrders(params)
      setOrders(data.orders || data)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  // Initial load — fetch both stats and orders together
  const initialLoad = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([fetchStats(), fetchOrders(statusFilter)])
      setLastRefresh(new Date())
    } catch {
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [fetchStats, fetchOrders, statusFilter])

  // Auto-refresh: re-fetch every 30 seconds silently
  const silentRefresh = useCallback(async () => {
    await Promise.all([fetchStats(), fetchOrders(statusFilter)])
    setLastRefresh(new Date())
    setCountdown(30)
  }, [fetchStats, fetchOrders, statusFilter])

  // On mount
  useEffect(() => {
    initialLoad()
  }, [])

  // Set up 30-second auto-refresh
  useEffect(() => {
    const interval = setInterval(silentRefresh, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [silentRefresh])

  // Countdown timer UI (ticks every second)
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastRefresh])

  // Handle status filter change
  const handleStatusFilter = (status) => {
    setStatusFilter(status)
    fetchOrders(status)
  }

  // Build stat cards from API data
  const total = stats?.total_orders ?? 0
  const confirmed = stats?.confirmed_orders ?? 0
  const cancelled = stats?.cancelled_orders ?? 0
  const noResponse = stats?.no_response ?? 0

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  const statCards = [
    { title: 'Total Orders', count: total, color: 'blue', icon: <TotalIcon />, percentage: undefined },
    { title: 'Confirmed', count: confirmed, color: 'green', icon: <ConfirmedIcon />, percentage: pct(confirmed) },
    { title: 'Cancelled', count: cancelled, color: 'red', icon: <CancelledIcon />, percentage: pct(cancelled) },
    { title: 'No Response', count: noResponse, color: 'gray', icon: <NoResponseIcon />, percentage: pct(noResponse) },
  ]

  if (error && !stats) {
    return <ErrorMessage message={error} onRetry={initialLoad} />
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {business?.name ? `${business.name}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back · Here's what's happening today
          </p>
        </div>

        {/* Auto-refresh indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 px-3 py-2 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Auto-refreshing in {countdown}s</span>
        </div>
      </div>

      {/* Stats cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            count={card.count}
            percentage={card.percentage}
            color={card.color}
            icon={card.icon}
            loading={loading}
          />
        ))}
      </div>

      {/* Average confirmation time banner */}
      {!loading && stats?.average_confirmation_time != null && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 flex items-center gap-3 animate-fade-in">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-700">
            <span className="font-semibold">Average confirmation time:</span>{' '}
            {stats.average_confirmation_time.toFixed(1)} minutes
          </p>
        </div>
      )}

      {/* Orders table */}
      <OrdersTable
        orders={orders}
        loading={loading || ordersLoading}
        onStatusFilter={handleStatusFilter}
        currentFilter={statusFilter}
      />
    </div>
  )
}
