'use client'

import { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { useAssistant, ProjectSuggestion } from '../hooks/useAssistant'
import { PROJECT_COLORS } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAccept: (suggestions: ProjectSuggestion[]) => void
}

export default function AssistantPanel({ isOpen, onClose, onAccept }: Props) {
  const { messages, directory, setDirectory, isLoading, sendMessage, reset } = useAssistant()
  const [input, setInput] = useState('')
  const [welcomed, setWelcomed] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const hasSuggestions = messages.some((m) => m.suggestions && m.suggestions.length > 0)
  const step = !welcomed ? 0 : accepted ? 3 : hasSuggestions ? 2 : 1

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input when panel opens (only after welcome screen)
  useEffect(() => {
    if (isOpen && welcomed) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen, welcomed])

  function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleFolderPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Reset so the same folder can be re-picked
    e.target.value = ''

    // Collect git repos and their description files from the FileList
    const repoSet = new Set<string>()
    const readmeFiles = new Map<string, File>()
    const pkgFiles = new Map<string, File>()

    for (const file of Array.from(files)) {
      const parts = file.webkitRelativePath.split('/')
      // parts[0] = selected dir, parts[1] = child, parts[2] = .git or file
      if (parts.length >= 3 && parts[2] === '.git') repoSet.add(parts[1])
      if (parts.length === 3 && /^readme\.md$/i.test(parts[2])) readmeFiles.set(parts[1], file)
      if (parts.length === 3 && parts[2] === 'package.json') pkgFiles.set(parts[1], file)
    }

    const folderName = files[0].webkitRelativePath.split('/')[0]
    setDirectory(folderName)

    const repos = await Promise.all(
      Array.from(repoSet).map(async (name) => {
        let description = ''
        if (readmeFiles.has(name)) {
          description = (await readmeFiles.get(name)!.text()).slice(0, 500)
        } else if (pkgFiles.has(name)) {
          try {
            const pkg = JSON.parse(await pkgFiles.get(name)!.text()) as { description?: string }
            description = pkg.description ?? ''
          } catch { /* skip */ }
        }
        return { name, description }
      })
    )

    await sendMessage(`Scan "${folderName}"`, { repos })
  }

  function handleAcceptAll(suggestions: ProjectSuggestion[]) {
    onAccept(suggestions)
    setAccepted(true)
  }

  function handleReset() {
    reset()
    setWelcomed(false)
    setAccepted(false)
  }

  return (
    <>
      {/* Backdrop (light tap-away) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/10 dark:bg-black/20"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-40 w-[380px] flex flex-col
          bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          shadow-2xl transition-transform duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <span className="text-violet-500">✦</span> AI Setup
          </span>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1.5 py-0.5 transition-colors ml-auto"
            title="Start over"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        {welcomed && (
          <div className="flex items-center gap-0 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 flex-shrink-0">
            {(['Scan', 'Review', 'Done'] as const).map((label, i) => {
              const s = i + 1
              const isComplete = step > s
              const isActive = step === s
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${
                        isComplete
                          ? 'bg-violet-600 text-white'
                          : isActive
                          ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 ring-1 ring-violet-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isComplete ? '✓' : s}
                    </div>
                    <span
                      className={`text-[11px] font-medium transition-colors ${
                        isActive
                          ? 'text-zinc-800 dark:text-zinc-200'
                          : isComplete
                          ? 'text-violet-600 dark:text-violet-400'
                          : 'text-zinc-400 dark:text-zinc-600'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {s < 3 && (
                    <div
                      className={`flex-1 h-px mx-2 transition-colors ${
                        step > s ? 'bg-violet-400' : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Welcome screen */}
        {!welcomed && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-2xl">
              ✦
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Set up your board</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Scan a local directory and I'll detect your git repos, then suggest projects and tasks to add to your board.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => setWelcomed(true)}
                className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 active:bg-violet-700 transition-colors"
              >
                Get started
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-zinc-500 dark:text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Chat UI (hidden until welcome is dismissed) */}
        {welcomed && (
          <>
            {/* Directory row */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 flex-shrink-0 bg-zinc-50 dark:bg-zinc-950/50">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold flex-shrink-0">Dir</span>
              <input
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage(`scan ${directory}`)
                }}
                placeholder="~/Projects"
                className="flex-1 text-xs bg-transparent text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none font-mono min-w-0"
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is not in React's types
                webkitdirectory=""
                className="hidden"
                onChange={handleFolderPicked}
              />
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={isLoading}
                title="Pick a folder"
                className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors font-medium flex-shrink-0"
              >
                📂
              </button>
              <button
                onClick={() => sendMessage(`scan ${directory}`)}
                disabled={isLoading}
                className="text-[10px] px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/60 disabled:opacity-40 transition-colors font-medium flex-shrink-0"
              >
                Scan
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-[90%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Suggestion cards */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <SuggestionBlock
                      suggestions={msg.suggestions}
                      onAccept={handleAcceptAll}
                    />
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg rounded-bl-sm px-3 py-2 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="Ask me anything..."
                className="flex-1 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 dark:focus:ring-violet-600 disabled:opacity-50 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 transition-colors font-medium flex-shrink-0"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Suggestion block ────────────────────────────────────────────────────────

interface SuggestionBlockProps {
  suggestions: ProjectSuggestion[]
  onAccept: (suggestions: ProjectSuggestion[]) => void
}

function SuggestionBlock({ suggestions, onAccept }: SuggestionBlockProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="w-full max-w-[95%] flex flex-col gap-2">
      {suggestions.map((s) => {
        const color = PROJECT_COLORS.find((c) => c.id === s.colorId) ?? PROJECT_COLORS[0]
        const isExpanded = expanded === s.name
        return (
          <div
            key={s.name}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: color.border + '66' }}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : s.name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:opacity-90"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              <span className="font-semibold text-sm flex-1 truncate">{s.name}</span>
              <span className="text-[10px] opacity-70 flex-shrink-0">
                {s.notes.length} task{s.notes.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[10px] opacity-60">{isExpanded ? '▲' : '▼'}</span>
            </button>
            {isExpanded && s.notes.length > 0 && (
              <ul
                className="px-3 py-2 flex flex-col gap-1"
                style={{ backgroundColor: color.bg + '33' }}
              >
                {s.notes.map((n, ni) => (
                  <li key={ni} className="text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-1.5">
                    <span className="opacity-40 flex-shrink-0 mt-px">·</span>
                    <span>{n.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <button
        onClick={() => onAccept(suggestions)}
        className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700 transition-colors font-medium self-start"
      >
        Create {suggestions.length} project{suggestions.length !== 1 ? 's' : ''} →
      </button>
    </div>
  )
}
