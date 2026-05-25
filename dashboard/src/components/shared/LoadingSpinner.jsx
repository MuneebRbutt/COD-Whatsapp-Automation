// src/components/shared/LoadingSpinner.jsx
// Reusable loading spinner used across all async states

import React from 'react'

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizes[size]} rounded-full border-blue-200 border-t-blue-600 animate-spin`}
        style={{ borderStyle: 'solid' }}
        role="status"
        aria-label="Loading"
      />
      {text && <p className="text-sm text-slate-500 font-medium">{text}</p>}
    </div>
  )
}
