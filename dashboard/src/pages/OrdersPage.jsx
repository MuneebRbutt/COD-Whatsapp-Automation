// src/pages/OrdersPage.jsx
// Standalone orders list page (navigated from sidebar "Orders" link)
// Same table as dashboard but with full filter/pagination controls

import React, { useState, useEffect, useCallback } from 'react'
import { getOrders } from '../api/orders'
import OrdersTable from '../components/dashboard/OrdersTable'
import ErrorMessage from '../components/shared/ErrorMessage'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchOrders = useCallback(async (filter = '') => {
    setLoading(true)
    setError('')
    try {
      const params = { limit: 100 }
      if (filter) params.status = filter
      const data = await getOrders(params)
      setOrders(data.orders || data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleStatusFilter = (status) => {
    setStatusFilter(status)
    fetchOrders(status)
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => fetchOrders(statusFilter)} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-0.5">All incoming COD orders and their confirmation status</p>
      </div>

      <OrdersTable
        orders={orders}
        loading={loading}
        onStatusFilter={handleStatusFilter}
        currentFilter={statusFilter}
      />
    </div>
  )
}
