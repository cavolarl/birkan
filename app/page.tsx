'use client'

import { useState, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useStore } from './hooks/useStore'
import { useTheme } from './hooks/useTheme'
import { Note, PROJECT_COLORS } from './types'
import Board from './components/Board'
import InProgressShelf from './components/InProgressShelf'
import TerminalSlot, { SlotHandle } from './components/TerminalSlot'
import NoteModal from './components/NoteModal'
import ProjectModal from './components/ProjectModal'
import EffortMenu from './components/EffortMenu'
import AssistantPanel from './components/AssistantPanel'
import SettingsModal from './components/SettingsModal'
import type { ProjectSuggestion } from './hooks/useAssistant'

export default function Home() {
  const store = useStore()
  const { isDark, toggle: toggleTheme } = useTheme()

  // Modals
  const [noteModal, setNoteModal] = useState<{ open: boolean; note?: Note; projectId?: string }>({ open: false })
  const [projectModal, setProjectModal] = useState<{ open: boolean }>({ open: false })
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Active project filter
  const [filterProjectId, setFilterProjectId] = useState<string | undefined>(undefined)

  // Number of terminal slots currently open (starts at 1, max NUM_SLOTS)
  const [openSlotCount, setOpenSlotCount] = useState(1)

  // Drag state
  const [activeNote, setActiveNote] = useState<Note | null>(null)

  // Refs to each terminal slot for sendPrompt
  const slotRefs = useRef<(SlotHandle | null)[]>([null, null, null])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.type === 'note') setActiveNote(data.note as Note)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveNote(null)
    const { active, over, delta } = event
    if (!over) return

    const noteData = active.data.current
    if (noteData?.type !== 'note') return
    const note = noteData.note as Note

    if (over.id === 'board') {
      // Reposition note on board
      store.moveNotePosition(
        note.id,
        Math.max(0, note.position.x + delta.x),
        Math.max(0, note.position.y + delta.y)
      )
    } else if (typeof over.id === 'string' && over.id.startsWith('slot-')) {
      const slotId = over.data.current?.slotId as number
      const slot = store.slots.find(s => s.id === slotId)
      if (!slot) return

      // Move note to in-progress
      store.moveNoteToSlot(note.id, slotId)

      // Send note content as prompt to that terminal
      const linkedContext = (note.linkedNoteIds ?? [])
        .map(id => store.notes.find(n => n.id === id))
        .filter(Boolean)
        .map(n => `Related: "${n!.title}"${n!.body ? `\n${n!.body}` : ''}`)
        .join('\n\n')
      const prompt = [
        note.title,
        note.body,
        linkedContext,
        'When you are done, stage all changes with git add, commit with a descriptive message, and push to the remote.',
      ].filter(Boolean).join('\n\n')
      slotRefs.current[slotId]?.sendPrompt(prompt, note.images)
    }
  }

  function handleSaveNote(projectId: string, title: string, body: string, images: string[]) {
    if (noteModal.note) {
      store.updateNote(noteModal.note.id, { projectId, title, body, images })
    } else {
      store.addNote(projectId, title, body, images)
    }
  }

  function handleAcceptSuggestions(suggestions: ProjectSuggestion[]) {
    for (const s of suggestions) {
      const project = store.addProject(s.name, s.colorId)
      for (const note of s.notes) {
        store.addNote(project.id, note.title, note.body)
      }
    }
  }

  const inProgressNotes = store.notes.filter(n => n.status === 'in-progress')
  const doneCount = store.notes.filter(n => n.status === 'done').length

  if (!store.loaded) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <span className="text-sm text-zinc-500 animate-pulse">Loading…</span>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-shrink-0">
        <span className="font-serif font-bold tracking-tight text-zinc-800 dark:text-zinc-200" style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>birkan</span>

        {/* Project filter tabs */}
        <div className="flex gap-1 ml-2">
          <button
            onClick={() => setFilterProjectId(undefined)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              !filterProjectId
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {store.projects.map(p => {
            const color = PROJECT_COLORS.find(c => c.id === p.colorId) ?? PROJECT_COLORS[0]
            const isActive = filterProjectId === p.id
            return (
              <button
                key={p.id}
                onClick={() => setFilterProjectId(isActive ? undefined : p.id)}
                className="text-xs px-2 py-1 rounded transition-all font-medium"
                style={{
                  backgroundColor: isActive ? color.bg : 'transparent',
                  color: isActive ? color.text : color.bg,
                  border: `1px solid ${isActive ? color.border : color.bg + '66'}`,
                }}
              >
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {doneCount > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-600">{doneCount} done</span>
          )}
          <button
            onClick={() => setAssistantOpen(true)}
            className="text-xs px-2.5 py-1.5 rounded border font-medium transition-colors"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent-hover)', backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-light)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ✦ Setup
          </button>
          <EffortMenu slotRefs={slotRefs} slots={store.slots} />
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings (CLAUDE.md)"
            className="text-xs px-2 py-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ⚙
          </button>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-xs px-2 py-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isDark ? '☀' : '☾'}
          </button>
          <button
            onClick={() => setProjectModal({ open: true })}
            className="text-xs px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            + Project
          </button>
          <button
            onClick={() => setNoteModal({ open: true, projectId: filterProjectId })}
            disabled={store.projects.length === 0}
            className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-40 transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
          >
            + Note
          </button>
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 min-h-0">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Left: board + in-progress shelf (75%) */}
          <div className="flex flex-col" style={{ flex: '3 1 0%', minWidth: 0 }}>
            <Board
              notes={store.notes}
              projects={store.projects}
              filterProjectId={filterProjectId}
              onEditNote={(note) => setNoteModal({ open: true, note })}
              onDeleteNote={store.deleteNote}
              onMarkDone={store.markNoteDone}
            />
            <InProgressShelf
              notes={inProgressNotes}
              projects={store.projects}
              onMarkDone={store.markNoteDone}
              onReset={store.resetNote}
            />
          </div>

          {/* Right: terminal slots (25%) */}
          <div
            className="flex flex-col border-l border-zinc-200 dark:border-zinc-800 flex-shrink-0"
            style={{ flex: '1 1 0%', minWidth: 340, maxWidth: 520 }}
          >
            {store.slots.slice(0, openSlotCount).map((slot, i) => (
              <TerminalSlot
                key={slot.id}
                ref={(el) => { slotRefs.current[i] = el }}
                slot={slot}
                projects={store.projects}
                lastNote={slot.lastNoteId ? store.notes.find(n => n.id === slot.lastNoteId) : undefined}
                onReset={store.resetSlot}
                onRename={store.renameSlot}
                onStatusChange={store.updateSlotStatus}
              />
            ))}
            {openSlotCount < store.slots.length && (
              <div className="flex items-center justify-center p-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setOpenSlotCount(c => c + 1)}
                  className="text-xs px-3 py-1.5 rounded border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                >
                  + Terminal
                </button>
              </div>
            )}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeNote && (() => {
              const project = store.projects.find(p => p.id === activeNote.projectId)
              const color = PROJECT_COLORS.find(c => c.id === project?.colorId) ?? PROJECT_COLORS[0]
              return (
                <div
                  className="rounded-sm border-t-4 shadow-xl p-3 w-48 opacity-90 rotate-2"
                  style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
                >
                  {project && (
                    <span className="text-xs font-semibold opacity-70 block mb-1">{project.name}</span>
                  )}
                  <p className="font-bold text-sm">{activeNote.title}</p>
                  {activeNote.body && (
                    <p className="text-xs mt-1 opacity-70 line-clamp-3">{activeNote.body}</p>
                  )}
                </div>
              )
            })()}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {noteModal.open && (
        <NoteModal
          note={noteModal.note}
          notes={store.notes}
          projects={store.projects}
          defaultProjectId={noteModal.projectId}
          onSave={handleSaveNote}
          onAddLink={store.addNoteLink}
          onRemoveLink={store.removeNoteLink}
          onClose={() => setNoteModal({ open: false })}
        />
      )}
      {projectModal.open && (
        <ProjectModal
          onSave={(name, colorId, path) => store.addProject(name, colorId, path)}
          onClose={() => setProjectModal({ open: false })}
        />
      )}

      <AssistantPanel
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        onAccept={handleAcceptSuggestions}
      />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
