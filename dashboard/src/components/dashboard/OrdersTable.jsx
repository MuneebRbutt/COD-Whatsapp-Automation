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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden animate-fade-in">
      {/* Table header with filter */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Recent Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Loading...' : `${orders?.length || 0} orders`}
          </p>
        </div>

        {/* Status filter dropdown */}
        <select
          id="orders-status-filter"
          value={currentFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {/* Loading skeletons */}
            {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

            {/* Empty state */}
            {!loading && (!orders || orders.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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
                  <span className="font-medium text-slate-800">{order.customer_name || '—'}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{order.customer_phone || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{formatItems(order.order_items)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
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
