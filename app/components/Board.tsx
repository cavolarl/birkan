'use client'

import { useDroppable } from '@dnd-kit/core'
import { Note, Project } from '../types'
import NoteCard from './NoteCard'

interface Props {
  notes: Note[]
  projects: Project[]
  onEditNote: (note: Note) => void
  onDeleteNote: (noteId: string) => void
  onMarkDone: (noteId: string) => void
  filterProjectId?: string
}

export default function Board({ notes, projects, onEditNote, onDeleteNote, onMarkDone, filterProjectId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'board', data: { type: 'board' } })

  const visible = notes.filter(n => {
    if (n.status !== 'idle') return false
    if (filterProjectId && n.projectId !== filterProjectId) return false
    return true
  })

  return (
    <div
      ref={setNodeRef}
      className="relative flex-1 overflow-hidden transition-colors"
      style={{ backgroundColor: isOver ? 'var(--board-bg-over)' : 'var(--board-bg)' }}
    >
      {visible.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-zinc-400 dark:text-zinc-700 text-sm">Drag a note here, or create one above</p>
        </div>
      )}
      {visible.map(note => (
        <NoteCard
          key={note.id}
          note={note}
          project={projects.find(p => p.id === note.projectId)}
          onEdit={onEditNote}
          onDelete={onDeleteNote}
          onMarkDone={onMarkDone}
        />
      ))}
    </div>
  )
}
