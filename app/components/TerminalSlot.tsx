'use client'

import { useDroppable } from '@dnd-kit/core'
import { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import dynamic from 'next/dynamic'
import { TerminalSlot as TSlot, Project, Note, PROJECT_COLORS } from '../types'
import type { XTermHandle } from './XTermTerminal'

const XTermTerminal = dynamic(() => import('./XTermTerminal'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-950 animate-pulse rounded" />,
})

const STATUS_COLORS: Record<TSlot['status'], string> = {
  idle: 'bg-zinc-400 dark:bg-zinc-600',
  working: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
}

export interface SlotHandle {
  sendPrompt: (text: string, images?: string[]) => void
}

interface Props {
  slot: TSlot
  projects: Project[]
  lastNote?: Note
  onReset: (slotId: number) => void
  onRename: (slotId: number, label: string) => void
  onStatusChange: (slotId: number, status: TSlot['status']) => void
}

const TerminalSlot = forwardRef<SlotHandle, Props>(
  ({ slot, projects, lastNote, onReset, onRename, onStatusChange }, ref) => {
    const xtermRef = useRef<XTermHandle>(null)
    const [isRenaming, setIsRenaming] = useState(false)
    const [labelInput, setLabelInput] = useState(slot.label)

    useImperativeHandle(ref, () => ({
      sendPrompt: (text: string, images?: string[]) => xtermRef.current?.sendPrompt(text, images),
    }))

    const { setNodeRef, isOver } = useDroppable({
      id: `slot-${slot.id}`,
      data: { type: 'terminal', slotId: slot.id },
    })

    const project = projects.find(p => p.id === slot.projectId)
    const color = project ? (PROJECT_COLORS.find(c => c.id === project.colorId) ?? PROJECT_COLORS[0]) : null

    function commitRename() {
      const trimmed = labelInput.trim()
      if (trimmed && trimmed !== slot.label) onRename(slot.id, trimmed)
      setIsRenaming(false)
    }

    function handleReset() {
      xtermRef.current?.sendReset()
      onReset(slot.id)
    }

    return (
      <div
        ref={setNodeRef}
        className="relative flex flex-col border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 transition-colors"
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: isOver ? 'var(--slot-bg-over)' : 'var(--slot-bg)',
          outline: isOver ? `2px solid var(--slot-outline)` : 'none',
          outlineOffset: '-2px',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-950">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[slot.status]}`} />

          {isRenaming ? (
            <input
              autoFocus
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setLabelInput(slot.label); setIsRenaming(false) }
              }}
              className="bg-transparent text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none border-b border-zinc-400 dark:border-zinc-600 min-w-0 flex-1"
            />
          ) : (
            <button
              onClick={() => { setIsRenaming(true); setLabelInput(slot.label) }}
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 -mx-1 transition-colors truncate flex-1 text-left font-medium"
            >
              {slot.label}
            </button>
          )}

          {color && project && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{ backgroundColor: color.bg + '22', color: color.bg }}
            >
              {project.name}
            </span>
          )}

          {lastNote && slot.status === 'working' && (
            <span
              className="text-[10px] text-zinc-500 truncate max-w-[80px] flex-shrink-0"
              title={lastNote.title}
            >
              {lastNote.title}
            </span>
          )}

          <button
            onClick={handleReset}
            title="Reset to new session"
            className="text-[10px] text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1.5 py-0.5 flex-shrink-0 transition-colors ml-auto"
          >
            ↺ New
          </button>
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-0 p-1 overflow-hidden">
          <XTermTerminal
            ref={xtermRef}
            wsUrl={`ws://localhost:3001?slot=${slot.id}`}
            onStatusChange={(status) => onStatusChange(slot.id, status)}
          />
        </div>

        {/* Drop overlay */}
        {isOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-zinc-100/95 dark:bg-zinc-800/95 text-zinc-900 dark:text-zinc-100 text-sm px-5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 shadow-2xl font-medium">
              Send to {slot.label}
            </div>
          </div>
        )}
      </div>
    )
  }
)

TerminalSlot.displayName = 'TerminalSlot'
export default TerminalSlot
