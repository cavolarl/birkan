'use client'

import { useState } from 'react'
import type { SlotHandle } from './TerminalSlot'
import type { TerminalSlot } from '../types'

const EFFORT_LEVELS = [
  { level: 'low',    bg: '#bbf7d0', text: '#14532d', border: '#22c55e', label: 'Low' },
  { level: 'medium', bg: '#fef08a', text: '#713f12', border: '#eab308', label: 'Medium' },
  { level: 'high',   bg: '#fed7aa', text: '#7c2d12', border: '#f97316', label: 'High' },
  { level: 'max',    bg: '#fbcfe8', text: '#831843', border: '#ec4899', label: 'Max' },
]

interface Props {
  slotRefs: React.MutableRefObject<(SlotHandle | null)[]>
  slots: TerminalSlot[]
}

export default function EffortMenu({ slotRefs, slots }: Props) {
  const [open, setOpen] = useState(false)

  function sendEffort(level: string) {
    slotRefs.current.forEach(ref => ref?.sendPrompt(`/effort ${level}`))
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs px-2 py-1.5 rounded font-mono transition-colors ${
          open
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        /effort
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-3 flex flex-col gap-2">
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 px-1">
                Sends to all {slots.length} terminals
              </p>
              <div className="flex gap-2">
                {EFFORT_LEVELS.map(e => (
                  <button
                    key={e.level}
                    onClick={() => sendEffort(e.level)}
                    className="rounded-sm border-t-4 px-3 py-2.5 text-center hover:scale-105 active:scale-95 transition-transform shadow-sm min-w-[56px]"
                    style={{ backgroundColor: e.bg, color: e.text, borderColor: e.border }}
                    title={`/effort ${e.level}`}
                  >
                    <span className="text-[9px] font-semibold block opacity-60">/effort</span>
                    <span className="text-sm font-extrabold block mt-0.5">{e.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
