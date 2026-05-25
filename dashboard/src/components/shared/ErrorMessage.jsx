// src/components/shared/ErrorMessage.jsx
// Friendly error display component with retry support

import React from 'react'

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 animate-fade-in">
      {/* Error icon */}
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Something went wrong</h3>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          {message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>

      {/* Retry button — only shown if handler provided */}
      {onRetry && (
        <button
          id="error-retry-btn"
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-900/40"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
