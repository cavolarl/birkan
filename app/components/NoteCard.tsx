'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Note, Project, PROJECT_COLORS } from '../types'

interface Props {
  note: Note
  project?: Project
  onEdit: (note: Note) => void
  onDelete: (noteId: string) => void
  onMarkDone?: (noteId: string) => void
}

export default function NoteCard({ note, project, onEdit, onDelete, onMarkDone }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
    data: { type: 'note', note },
    disabled: note.status !== 'idle',
  })

  const color = PROJECT_COLORS.find(c => c.id === project?.colorId) ?? PROJECT_COLORS[0]

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    position: 'absolute',
    left: note.position.x,
    top: note.position.y,
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.border,
    zIndex: isDragging ? 999 : 1,
    width: 200,
    minHeight: 120,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-sm border-t-4 shadow-md p-3 flex flex-col gap-1 group select-none"
    >
      {/* drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing absolute inset-0 rounded-sm"
        style={{ zIndex: 0 }}
      />
      <div className="relative z-10 pointer-events-none">
        {project && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded mb-1 inline-block"
            style={{ backgroundColor: color.border + '33', color: color.text }}
          >
            {project.name}
          </span>
        )}
        <p className="font-bold text-sm leading-tight">{note.title}</p>
        {note.body && (
          <p className="text-xs mt-1 line-clamp-4 whitespace-pre-wrap opacity-80">{note.body}</p>
        )}
        {note.images && note.images.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.images.slice(0, 3).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="w-12 h-12 object-cover rounded"
                style={{ border: `1px solid ${color.border}55` }}
              />
            ))}
            {note.images.length > 3 && (
              <div
                className="w-12 h-12 rounded flex items-center justify-center text-xs font-semibold opacity-60"
                style={{ border: `1px solid ${color.border}55`, backgroundColor: color.border + '22' }}
              >
                +{note.images.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
      {/* action buttons — only show on hover */}
      <div className="relative z-10 flex gap-1 mt-auto pt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(note) }}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-black/15 active:bg-black/25 transition-colors font-medium"
        >
          Edit
        </button>
        {onMarkDone && note.status === 'in-progress' && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDone(note.id) }}
            className="text-xs px-1.5 py-0.5 rounded hover:bg-black/15 active:bg-black/25 transition-colors font-medium"
          >
            Done
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(note.id) }}
          className="text-xs px-1.5 py-0.5 rounded hover:bg-red-500/30 active:bg-red-500/50 transition-colors ml-auto"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
