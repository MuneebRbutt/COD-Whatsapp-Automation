// src/components/orders/ChatBubble.jsx
// Renders a single WhatsApp-style message bubble

import React from 'react'

// Format timestamp for chat view
const formatChatTime = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ChatBubble({ message }) {
  // role can be 'customer', 'assistant', or 'system'
  const isOutgoing = message.role === 'assistant'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}>
      {/* Avatar for incoming messages */}
      {!isOutgoing && (
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs font-bold mr-2 mt-1 flex-shrink-0">
          C
        </div>
      )}

      <div className={`max-w-xs lg:max-w-md ${isOutgoing ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Role label */}
        <span className="text-xs text-slate-400 mb-1 px-1">
          {isOutgoing ? 'AI Assistant' : 'Customer'}
        </span>

        {/* Message bubble */}
        <div className={isOutgoing ? 'chat-bubble-outgoing px-4 py-2.5' : 'chat-bubble-incoming px-4 py-2.5'}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-slate-400 mt-1 px-1">
          {formatChatTime(message.timestamp)}
        </span>
      </div>

      {/* Avatar for outgoing (AI) messages */}
      {isOutgoing && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold ml-2 mt-1 flex-shrink-0">
          AI
        </div>
      )}
    </div>
  )
}
