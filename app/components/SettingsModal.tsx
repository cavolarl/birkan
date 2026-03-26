'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/claude-md')
      .then(r => r.json())
      .then(({ content: c }) => {
        setContent(c)
        setStatus('idle')
      })
      .catch(() => {
        setStatus('error')
        setErrorMsg('Failed to load CLAUDE.md')
      })
  }, [])

  async function handleSave() {
    setStatus('saving')
    try {
      const res = await fetch('/api/claude-md', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('saved')
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setStatus('idle'), 2000)
      } else {
        setStatus('error')
        setErrorMsg(data.error ?? 'Save failed')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Save failed')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (status !== 'saving') handleSave()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ height: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">CLAUDE.md — project instructions for Claude Code</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4">
          {status === 'loading' ? (
            <div className="h-full flex items-center justify-center text-sm text-zinc-400">Loading…</div>
          ) : (
            <textarea
              value={content}
              onChange={e => { setContent(e.target.value); if (status === 'saved') setStatus('idle') }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full h-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 resize-none"
              placeholder="Add project instructions for Claude Code here…"
            />
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <span className="text-xs text-zinc-400">
            {status === 'error' && <span className="text-red-500">{errorMsg}</span>}
            {status === 'saved' && <span className="text-green-600 dark:text-green-400">Saved</span>}
            {status === 'idle' && <span>⌘S to save</span>}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status === 'saving' || status === 'loading'}
              className="px-3 py-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded font-medium hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 transition-colors"
            >
              {status === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
