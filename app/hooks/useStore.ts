'use client'

import { useState, useEffect, useCallback } from 'react'
import { Note, Project, TerminalSlot, NoteStatus, ColorId } from '../types'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(method: string, path: string, body?: unknown) {
  await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── localStorage → SQLite migration (runs once) ───────────────────────────────

async function migrateFromLocalStorage() {
  const MIGRATED_KEY = 'birkan:migrated_to_sqlite'
  if (localStorage.getItem(MIGRATED_KEY)) return

  const rawProjects = localStorage.getItem('birkan:projects')
  const rawNotes = localStorage.getItem('birkan:notes')

  if (!rawProjects && !rawNotes) {
    localStorage.setItem(MIGRATED_KEY, '1')
    return
  }

  try {
    const projects: Project[] = rawProjects ? JSON.parse(rawProjects) : []
    const notes: Note[] = rawNotes ? JSON.parse(rawNotes) : []

    for (const p of projects) {
      await api('POST', '/api/projects', p)
    }
    for (const n of notes) {
      await api('POST', '/api/notes', n)
    }

    localStorage.removeItem('birkan:projects')
    localStorage.removeItem('birkan:notes')
    localStorage.removeItem('birkan:slots')
    localStorage.setItem(MIGRATED_KEY, '1')
    console.log(`[birkan] migrated ${projects.length} projects, ${notes.length} notes to SQLite`)
  } catch (e) {
    console.error('[birkan] migration failed:', e)
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const DEFAULT_SLOTS: TerminalSlot[] = [
  { id: 0, label: 'Terminal 1', status: 'idle' },
  { id: 1, label: 'Terminal 2', status: 'idle' },
  { id: 2, label: 'Terminal 3', status: 'idle' },
]

export function useStore() {
  const [projects, setProjects] = useState<Project[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [slots, setSlots] = useState<TerminalSlot[]>(DEFAULT_SLOTS)
  const [loaded, setLoaded] = useState(false)

  // Load from SQLite on mount (after optional migration)
  useEffect(() => {
    migrateFromLocalStorage().then(() =>
      fetch('/api/data')
        .then(r => r.json())
        .then(({ projects, notes, slots }) => {
          setProjects(projects ?? [])
          setNotes(notes ?? [])
          setSlots(slots?.length ? slots : DEFAULT_SLOTS)
          setLoaded(true)
        })
        .catch(e => { console.error('[birkan] failed to load data:', e); setLoaded(true) })
    )
  }, [])

  // ── Projects ──────────────────────────────────────────────────────────────

  const addProject = useCallback((name: string, colorId: ColorId): Project => {
    const project: Project = { id: uid(), name, colorId }
    setProjects(p => [...p, project])
    api('POST', '/api/projects', project)
    return project
  }, [])

  const updateProject = useCallback((id: string, updates: Partial<Pick<Project, 'name' | 'colorId'>>) => {
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, ...updates } : proj))
    api('PATCH', `/api/projects/${id}`, updates)
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(p => p.filter(proj => proj.id !== id))
    setNotes(n => n.filter(note => note.projectId !== id))
    api('DELETE', `/api/projects/${id}`)
  }, [])

  // ── Notes ─────────────────────────────────────────────────────────────────

  const addNote = useCallback((projectId: string, title: string, body: string, images?: string[]): Note => {
    const note: Note = {
      id: uid(),
      projectId,
      title,
      body,
      ...(images?.length ? { images } : {}),
      status: 'idle',
      position: { x: 40 + Math.random() * 200, y: 40 + Math.random() * 200 },
      createdAt: Date.now(),
    }
    setNotes(n => [...n, note])
    api('POST', '/api/notes', note)
    return note
  }, [])

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
    setNotes(n => n.map(note => note.id === id ? { ...note, ...updates } : note))
    api('PATCH', `/api/notes/${id}`, updates)
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes(n => n.filter(note => note.id !== id))
    api('DELETE', `/api/notes/${id}`)
  }, [])

  const moveNoteToSlot = useCallback((noteId: string, slotId: number) => {
    setNotes(n => n.map(note =>
      note.id === noteId
        ? { ...note, status: 'in-progress' as NoteStatus, terminalSlotId: slotId }
        : note
    ))
    setSlots(s => s.map(slot =>
      slot.id === slotId ? { ...slot, status: 'working', lastNoteId: noteId } : slot
    ))
    api('PATCH', `/api/notes/${noteId}`, { status: 'in-progress', terminalSlotId: slotId })
    api('PATCH', `/api/slots/${slotId}`, { status: 'working', lastNoteId: noteId })
  }, [])

  const markNoteDone = useCallback((noteId: string) => {
    setNotes(n => n.map(note =>
      note.id === noteId ? { ...note, status: 'done' as NoteStatus } : note
    ))
    api('PATCH', `/api/notes/${noteId}`, { status: 'done' })
  }, [])

  const resetNote = useCallback((noteId: string) => {
    setNotes(n => n.map(note =>
      note.id === noteId
        ? { ...note, status: 'idle' as NoteStatus, terminalSlotId: undefined }
        : note
    ))
    api('PATCH', `/api/notes/${noteId}`, { status: 'idle', terminalSlotId: null })
  }, [])

  const moveNotePosition = useCallback((noteId: string, x: number, y: number) => {
    setNotes(n => n.map(note =>
      note.id === noteId ? { ...note, position: { x, y } } : note
    ))
    api('PATCH', `/api/notes/${noteId}`, { position: { x, y } })
  }, [])

  // ── Slots ─────────────────────────────────────────────────────────────────

  const updateSlotStatus = useCallback((slotId: number, status: TerminalSlot['status'], projectId?: string) => {
    setSlots(s => s.map(slot =>
      slot.id === slotId ? { ...slot, status, ...(projectId !== undefined ? { projectId } : {}) } : slot
    ))
    api('PATCH', `/api/slots/${slotId}`, { status, ...(projectId !== undefined ? { projectId } : {}) })
  }, [])

  const resetSlot = useCallback((slotId: number) => {
    setNotes(n => {
      const updated = n.map(note =>
        note.terminalSlotId === slotId && note.status === 'in-progress'
          ? { ...note, status: 'idle' as NoteStatus, terminalSlotId: undefined }
          : note
      )
      // Fire API calls for notes that changed
      n.filter(note => note.terminalSlotId === slotId && note.status === 'in-progress')
        .forEach(note => api('PATCH', `/api/notes/${note.id}`, { status: 'idle', terminalSlotId: null }))
      return updated
    })
    setSlots(s => s.map(slot =>
      slot.id === slotId
        ? { ...slot, status: 'idle', projectId: undefined, lastNoteId: undefined }
        : slot
    ))
    api('PATCH', `/api/slots/${slotId}`, { status: 'idle', projectId: null, lastNoteId: null })
  }, [])

  const renameSlot = useCallback((slotId: number, label: string) => {
    setSlots(s => s.map(slot => slot.id === slotId ? { ...slot, label } : slot))
    api('PATCH', `/api/slots/${slotId}`, { label })
  }, [])

  return {
    projects,
    notes,
    slots,
    loaded,
    addProject,
    updateProject,
    deleteProject,
    addNote,
    updateNote,
    deleteNote,
    moveNoteToSlot,
    markNoteDone,
    resetNote,
    moveNotePosition,
    updateSlotStatus,
    resetSlot,
    renameSlot,
  }
}
