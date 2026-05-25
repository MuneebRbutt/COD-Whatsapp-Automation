// src/pages/OrderDetailPage.jsx
// Full order detail view with conversation history and manual override controls

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOrder, overrideOrderStatus } from '../api/orders'
import StatusBadge from '../components/shared/StatusBadge'
import ChatBubble from '../components/orders/ChatBubble'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import ErrorMessage from '../components/shared/ErrorMessage'

// Format full date for order metadata
const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PK', {
    weekday: 'short', year: 'numeric',
    month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Parse order items into readable list
const parseItems = (items) => {
  if (!items) return []
  try {
    const arr = typeof items === 'string' ? JSON.parse(items) : items
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Parse conversation messages
const parseMessages = (messages) => {
  if (!messages) return []
  try {
    const arr = typeof messages === 'string' ? JSON.parse(messages) : messages
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Confirmation modal component
function OverrideModal({ action, onConfirm, onCancel, loading }) {
  const isConfirm = action === 'confirmed'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal card */}
      <div className="relative bg-white rounded-2xl shadow-modal border border-slate-100 p-6 w-full max-w-sm mx-4 animate-fade-in">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
          isConfirm ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isConfirm ? (
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
          {isConfirm ? 'Mark as Confirmed?' : 'Mark as Cancelled?'}
        </h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          {isConfirm
            ? 'This will manually confirm the order and notify the customer.'
            : 'This will cancel the order. This action cannot be undone.'}
        </p>

        <div className="flex gap-3">
          <button
            id="override-modal-cancel"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition"
          >
            Go Back
          </button>
          <button
            id="override-modal-confirm"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 font-semibold rounded-xl text-sm text-white transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isConfirm
                ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
            }`}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              isConfirm ? 'Yes, Confirm' : 'Yes, Cancel'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const chatEndRef = useRef(null)

  const [order, setOrder] = useState(null)
  const [conversation, setConversation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalAction, setModalAction] = useState(null) // 'confirmed' | 'cancelled' | null
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideSuccess, setOverrideSuccess] = useState('')

  const fetchOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrder(id)
      setOrder(data.order || data)
      setConversation(data.conversation || null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load order details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [id])

  // Scroll chat to bottom when messages load
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation])

  // Handle manual status override
  const handleOverride = async () => {
    setOverrideLoading(true)
    try {
      await overrideOrderStatus(id, modalAction)
      setOverrideSuccess(`Order marked as ${modalAction} successfully.`)
      setModalAction(null)
      // Refresh order data
      fetchOrder()
      setTimeout(() => setOverrideSuccess(''), 4000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update order status.')
      setModalAction(null)
    } finally {
      setOverrideLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="Loading order..." />
      </div>
    )
  }

  if (error && !order) {
    return <ErrorMessage message={error} onRetry={fetchOrder} />
  }

  const messages = parseMessages(conversation?.messages)
  const items = parseItems(order?.order_items)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button + page title */}
      <div className="flex items-center gap-4">
        <button
          id="order-detail-back-btn"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition"
          title="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Order Details</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">#{id.slice(0, 8).toUpperCase()}</p>
        </div>
        {order && <StatusBadge status={order.status} />}
      </div>

      {/* Success toast */}
      {overrideSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {overrideSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Order info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Customer info card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">Customer</h2>
            <div className="space-y-3">
              <InfoRow label="Name" value={order?.customer_name} />
              <InfoRow label="Phone" value={order?.customer_phone} mono />
              <InfoRow label="Order ID" value={order?.shopify_order_id} mono />
              <InfoRow label="Placed at" value={formatDate(order?.created_at)} />
            </div>
          </div>

          {/* Delivery address card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Delivery Address</h2>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-slate-600 leading-relaxed">
                {order?.delivery_address || '—'}
              </p>
            </div>
          </div>

          {/* Order items card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Items Ordered</h2>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No items recorded</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.name || item.title}</span>
                    <span className="text-slate-400 font-medium">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manual override buttons */}
          {order?.status !== 'confirmed' && order?.status !== 'cancelled' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Manual Override</h2>
              <p className="text-xs text-slate-400 mb-4">Manually update this order's status if the customer responded outside WhatsApp.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="override-confirm-btn"
                  onClick={() => setModalAction('confirmed')}
                  className="py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm
                </button>
                <button
                  id="override-cancel-btn"
                  onClick={() => setModalAction('cancelled')}
                  className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Conversation history */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card h-full flex flex-col">
            {/* Chat header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">WhatsApp Conversation</p>
                <p className="text-xs text-slate-400">
                  {messages.length} message{messages.length !== 1 ? 's' : ''} · {conversation?.current_state || 'No conversation'}
                </p>
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ maxHeight: '520px', minHeight: '200px' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400">
                  <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Conversation will appear here once the customer replies</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <ChatBubble key={idx} message={msg} />
                ))
              )}
              {/* Auto-scroll anchor */}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Override confirmation modal */}
      {modalAction && (
        <OverrideModal
          action={modalAction}
          onConfirm={handleOverride}
          onCancel={() => setModalAction(null)}
          loading={overrideLoading}
        />
      )}
    </div>
  )
}

// Helper: label + value info row
function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-700 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}
