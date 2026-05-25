// src/components/dashboard/StatCard.jsx
// Individual stat card used in the main dashboard header

import React from 'react'

export default function StatCard({ title, count, percentage, color, icon, loading }) {
  // Color variant mappings
  const colors = {
    blue: {
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-600',
      text: 'text-blue-600',
      bar: 'bg-blue-500',
    },
    green: {
      bg: 'bg-green-50',
      iconBg: 'bg-green-500',
      text: 'text-green-600',
      bar: 'bg-green-500',
    },
    red: {
      bg: 'bg-red-50',
      iconBg: 'bg-red-500',
      text: 'text-red-600',
      bar: 'bg-red-500',
    },
    gray: {
      bg: 'bg-slate-50',
      iconBg: 'bg-slate-400',
      text: 'text-slate-500',
      bar: 'bg-slate-400',
    },
    yellow: {
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-500',
      text: 'text-amber-600',
      bar: 'bg-amber-500',
    },
  }

  const c = colors[color] || colors.blue

  if (loading) {
    return (
      <div className="dark-card rounded-2xl border border-[var(--bg-border)] p-5 stat-card shadow-card">
        <div className="skeleton h-4 w-24 mb-4 rounded" />
        <div className="skeleton h-8 w-16 mb-2 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    )
  }

  return (
    <div className="dark-card rounded-2xl border border-[var(--bg-border)] p-5 stat-card shadow-card animate-fade-in">
      {/* Header row: title + icon */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
        <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center text-white`}>
          {icon}
        </div>
      </div>

      {/* Count */}
      <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {count ?? '—'}
      </p>

      {/* Percentage + progress bar */}
      {percentage !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: c.textColor }}>{percentage}%</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>of total</span>
          </div>
          <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(percentage, 100)}%`, background: c.barColor }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
