'use client'

import { Note, Project, PROJECT_COLORS } from '../types'

interface Props {
  notes: Note[]
  projects: Project[]
  onMarkDone: (noteId: string) => void
  onReset: (noteId: string) => void
}

export default function InProgressShelf({ notes, projects, onMarkDone, onReset }: Props) {
  if (notes.length === 0) return null

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 px-4 py-3 flex-shrink-0">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2 font-semibold">In Progress</p>
      <div className="flex gap-2 flex-wrap">
        {notes.map(note => {
          const project = projects.find(p => p.id === note.projectId)
          const color = PROJECT_COLORS.find(c => c.id === project?.colorId) ?? PROJECT_COLORS[0]
          return (
            <div
              key={note.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-xs shadow-sm border border-opacity-30 max-w-[220px]"
              style={{ backgroundColor: color.bg + 'cc', color: color.text, borderColor: color.border }}
            >
              <div className="flex flex-col min-w-0">
                {project && (
                  <span className="text-[10px] font-semibold opacity-70 truncate">{project.name}</span>
                )}
                <span className="font-medium truncate">{note.title}</span>
                {note.terminalSlotId !== undefined && (
                  <span className="text-[10px] opacity-60">→ Terminal {note.terminalSlotId + 1}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 ml-auto pl-2 flex-shrink-0">
                <button
                  onClick={() => onMarkDone(note.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded hover:bg-black/15 active:bg-black/25 transition-colors whitespace-nowrap font-medium"
                >
                  Done
                </button>
                <button
                  onClick={() => onReset(note.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded hover:bg-black/15 active:bg-black/25 transition-colors whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
