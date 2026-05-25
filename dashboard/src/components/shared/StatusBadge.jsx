// src/components/shared/StatusBadge.jsx
// Colored status badge pill used in the orders table and detail page

import React from 'react'

// Map status values to readable labels and CSS classes
const STATUS_CONFIG = {
  confirmed: {
    label: 'Confirmed',
    className: 'badge-confirmed',
    dot: '●',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'badge-cancelled',
    dot: '●',
  },
  pending: {
    label: 'Pending',
    className: 'badge-pending',
    dot: '●',
  },
  no_response: {
    label: 'No Response',
    className: 'badge-no_response',
    dot: '○',
  },
  awaiting_reply: {
    label: 'Awaiting Reply',
    className: 'badge-pending',
    dot: '◌',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: 'badge-no_response',
    dot: '○',
  }

  return (
    <span className={`badge ${config.className}`}>
      <span style={{ fontSize: '0.6rem' }}>{config.dot}</span>
      {config.label}
    </span>
  )
}
