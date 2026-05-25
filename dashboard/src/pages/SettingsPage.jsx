// src/pages/SettingsPage.jsx
// Business settings: API key, Shopify webhook URL, language preference

import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, updateLanguage } from '../api/auth'
import CopyButton from '../components/shared/CopyButton'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import ErrorMessage from '../components/shared/ErrorMessage'

// Language options for the toggle
const LANGUAGE_OPTIONS = [
  { value: 'both', label: 'Both (Urdu + English)', description: 'AI replies in whichever language the customer uses' },
  { value: 'urdu', label: 'Urdu / Roman Urdu', description: 'All AI messages sent in Roman Urdu' },
  { value: 'english', label: 'English Only', description: 'All AI messages sent in English' },
]

// Masked API key display (show first 8 + last 4 chars)
const maskApiKey = (key) => {
  if (!key || key.length < 12) return key
  return `${key.slice(0, 8)}${'•'.repeat(key.length - 12)}${key.slice(-4)}`
}

export default function SettingsPage() {
  const { business, updateBusiness } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [langLoading, setLangLoading] = useState(false)
  const [langSuccess, setLangSuccess] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState(business?.language_preference || 'both')

  // Fetch latest profile data (includes api_key)
  const fetchProfile = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProfile()
      setProfile(data.business || data)
      setSelectedLanguage(data.business?.language_preference || data.language_preference || 'both')
    } catch (err) {
      // Use cached business data from context as fallback
      if (business) {
        setProfile(business)
      } else {
        setError(err.response?.data?.error || 'Failed to load settings.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  // Handle language preference update
  const handleLanguageChange = async (lang) => {
    if (lang === selectedLanguage) return

    setLangLoading(true)
    setLangSuccess('')
    try {
      await updateLanguage(lang)
      setSelectedLanguage(lang)
      updateBusiness({ language_preference: lang })
      setLangSuccess('Language preference updated successfully!')
      setTimeout(() => setLangSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update language preference.')
    } finally {
      setLangLoading(false)
    }
  }

  // Shopify webhook URL for this business
  const apiKey = profile?.api_key || business?.api_key || ''
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://your-backend.com'
  const webhookUrl = `${backendUrl}/webhook/shopify?api_key=${apiKey}`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="Loading settings..." />
      </div>
    )
  }

  if (error && !profile) {
    return <ErrorMessage message={error} onRetry={fetchProfile} />
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your business configuration</p>
      </div>

      {/* Success/error toasts */}
      {langSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {langSuccess}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Business info card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Business Information</h2>
        <div className="space-y-3">
          <SettingRow label="Business Name" value={profile?.name || business?.name || '—'} />
          <SettingRow label="Email" value={profile?.email || business?.email || '—'} />
          <SettingRow label="WhatsApp Number" value={profile?.whatsapp_number || business?.whatsapp_number || '—'} />
        </div>
      </div>

      {/* API Key card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-800">API Key</h2>
            <p className="text-xs text-slate-400 mt-0.5">Your unique key for authenticating webhooks</p>
          </div>
          <span className="badge badge-confirmed text-xs">Active</span>
        </div>

        {/* API key display box */}
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <code
            id="settings-api-key-display"
            className="text-sm font-mono text-slate-700 flex-1 break-all"
          >
            {showApiKey ? (apiKey || '—') : maskApiKey(apiKey || '')}
          </code>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle visibility */}
            <button
              id="settings-toggle-api-key"
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              title={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>

            <CopyButton text={apiKey} label="Copy Key" id="settings-copy-api-key" />
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          ⚠️ Keep this key private. Anyone with this key can send orders to your account.
        </p>
      </div>

      {/* Shopify Webhook URL card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="mb-2">
          <h2 className="text-base font-semibold text-slate-800">Shopify Webhook URL</h2>
          <p className="text-xs text-slate-400 mt-0.5">Paste this URL in your Shopify admin → Settings → Notifications → Webhooks</p>
        </div>

        {/* Step guide */}
        <div className="mt-3 mb-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
          <p className="font-semibold text-blue-800 mb-2">Setup Instructions:</p>
          <p>1. Go to Shopify Admin → Settings → Notifications</p>
          <p>2. Scroll to "Webhooks" at the bottom</p>
          <p>3. Click "Create Webhook"</p>
          <p>4. Event: <strong>Order payment</strong> · Format: <strong>JSON</strong></p>
          <p>5. Paste the URL below</p>
        </div>

        {/* Webhook URL display */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <code
            id="settings-webhook-url-display"
            className="text-xs font-mono text-slate-600 flex-1 break-all"
          >
            {webhookUrl}
          </code>
          <CopyButton text={webhookUrl} label="Copy URL" id="settings-copy-webhook-url" />
        </div>
      </div>

      {/* Language preference card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Language Preference</h2>
        <p className="text-xs text-slate-400 mb-5">Choose how the AI communicates with your customers</p>

        <div className="space-y-3">
          {LANGUAGE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              id={`lang-option-${opt.value}`}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedLanguage === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              } ${langLoading ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {/* Radio circle */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                selectedLanguage === opt.value
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-slate-300'
              }`}>
                {selectedLanguage === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              <input
                type="radio"
                name="language"
                value={opt.value}
                checked={selectedLanguage === opt.value}
                onChange={() => handleLanguageChange(opt.value)}
                className="sr-only"
              />

              <div>
                <p className={`text-sm font-semibold ${selectedLanguage === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
              </div>

              {/* Loading spinner next to selected option */}
              {langLoading && selectedLanguage === opt.value && (
                <div className="ml-auto">
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                </div>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// Simple label + value row helper
function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}
