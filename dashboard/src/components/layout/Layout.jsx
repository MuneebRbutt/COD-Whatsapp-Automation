// src/components/layout/Layout.jsx
// Main layout wrapper — sidebar + content area
// All authenticated pages are rendered inside this layout

import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content — offset by sidebar width */}
      <main className="flex-1 ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* React Router renders the matched child page here */}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
