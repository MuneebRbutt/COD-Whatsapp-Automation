// src/components/dashboard/OrdersTable.jsx
// Paginated, filterable orders table for the main dashboard

import React from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../shared/StatusBadge'

// Format ISO timestamp to readable local time
const formatTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PK', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Summarize order items array into a readable string
const formatItems = (items) => {
  if (!items) return '—'
  try {
    const arr = typeof items === 'string' ? JSON.parse(items) : items
    if (!Array.isArray(arr) || arr.length === 0) return '—'
    const summary = arr.map(i => `${i.name || i.title} ×${i.quantity}`).join(', ')
    return summary.length > 55 ? summary.slice(0, 52) + '...' : summary
  } catch {
    return String(items)
  }
}

// Loading skeleton row
function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4,5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 rounded" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

export default function OrdersTable({ orders, loading, onStatusFilter, currentFilter }) {
  const navigate = useNavigate()

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'pending', label: 'Pending' },
    { value: 'no_response', label: 'No Response' },
  ]

  return (
    <div className="dark-card overflow-hidden animate-fade-in shadow-card">
      {/* Table header with filter */}
      <div 
        className="px-5 py-4 flex items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--bg-border)' }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Orders</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Loading...' : `${orders?.length || 0} orders`}
          </p>
        </div>

        {/* Status filter dropdown */}
        <select
          id="orders-status-filter"
          value={currentFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: 'var(--text-secondary)' }}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: 'var(--bg-elevated)' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Items</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Time</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--bg-border-sub)' }}>
            {/* Loading skeletons */}
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

            {/* Empty state */}
            {!loading && (!orders || orders.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 4-8-4" />
                    </svg>
                    No orders found
                  </div>
                </td>
              </tr>
            )}

            {/* Order rows */}
            {!loading && orders?.map((order) => (
              <tr
                key={order.id}
                id={`order-row-${order.id}`}
                className="table-row-hover transition-colors duration-100"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <td className="px-4 py-3">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{order.customer_name || '—'}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{order.customer_phone || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{formatItems(order.order_items)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} needsManualReview={order.needs_manual_review} />
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {formatTime(order.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
