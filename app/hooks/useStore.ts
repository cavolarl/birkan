'use client'

import { useState, useEffect, useCallback } from 'react'
import { Note, Project, TerminalSlot, NoteStatus, ColorId } from '../types'

const STORAGE_KEYS = {
  projects: 'birkan:projects',
  notes: 'birkan:notes',
  slots: 'birkan:slots',
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const DEFAULT_SLOTS: TerminalSlot[] = [
  { id: 0, label: 'Terminal 1', status: 'idle' },
  { id: 1, label: 'Terminal 2', status: 'idle' },
  { id: 2, label: 'Terminal 3', status: 'idle' },
]

export function useStore() {
  const [projects, setProjects] = useState<Project[]>(() => load(STORAGE_KEYS.projects, []))
  const [notes, setNotes] = useState<Note[]>(() => load(STORAGE_KEYS.notes, []))
  const [slots, setSlots] = useState<TerminalSlot[]>(() => load(STORAGE_KEYS.slots, DEFAULT_SLOTS))

  useEffect(() => { save(STORAGE_KEYS.projects, projects) }, [projects])
  useEffect(() => { save(STORAGE_KEYS.notes, notes) }, [notes])
  useEffect(() => { save(STORAGE_KEYS.slots, slots) }, [slots])

  // Projects
  const addProject = useCallback((name: string, colorId: ColorId): Project => {
    const project: Project = { id: uid(), name, colorId }
    setProjects(p => [...p, project])
    return project
  }, [])

  const updateProject = useCallback((id: string, updates: Partial<Pick<Project, 'name' | 'colorId'>>) => {
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, ...updates } : proj))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(p => p.filter(proj => proj.id !== id))
    setNotes(n => n.filter(note => note.projectId !== id))
  }, [])

  // Notes
  const addNote = useCallback((projectId: string, title: string, body: string, images?: string[]): Note => {
    const note: Note = {
      id: uid(),
      projectId,
      title,
      body,
      ...(images && images.length > 0 ? { images } : {}),
      status: 'idle',
      position: { x: 40 + Math.random() * 200, y: 40 + Math.random() * 200 },
      createdAt: Date.now(),
    }
    setNotes(n => [...n, note])
    return note
  }, [])

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
    setNotes(n => n.map(note => note.id === id ? { ...note, ...updates } : note))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes(n => n.filter(note => note.id !== id))
  }, [])

  const moveNoteToSlot = useCallback((noteId: string, slotId: number) => {
    setNotes(n => n.map(note =>
      note.id === noteId
        ? { ...note, status: 'in-progress' as NoteStatus, terminalSlotId: slotId }
        : note
    ))
    setSlots(s => s.map(slot =>
      slot.id === slotId
        ? { ...slot, status: 'working', lastNoteId: noteId }
        : slot
    ))
  }, [])

  const markNoteDone = useCallback((noteId: string) => {
    setNotes(n => n.map(note =>
      note.id === noteId ? { ...note, status: 'done' as NoteStatus } : note
    ))
  }, [])

  const resetNote = useCallback((noteId: string) => {
    setNotes(n => n.map(note =>
      note.id === noteId
        ? { ...note, status: 'idle' as NoteStatus, terminalSlotId: undefined }
        : note
    ))
  }, [])

  const moveNotePosition = useCallback((noteId: string, x: number, y: number) => {
    setNotes(n => n.map(note =>
      note.id === noteId ? { ...note, position: { x, y } } : note
    ))
  }, [])

  // Slots
  const updateSlotStatus = useCallback((slotId: number, status: TerminalSlot['status'], projectId?: string) => {
    setSlots(s => s.map(slot =>
      slot.id === slotId ? { ...slot, status, ...(projectId !== undefined ? { projectId } : {}) } : slot
    ))
  }, [])

  const resetSlot = useCallback((slotId: number) => {
    // Return in-progress notes on this slot to idle
    setNotes(n => n.map(note =>
      note.terminalSlotId === slotId && note.status === 'in-progress'
        ? { ...note, status: 'idle' as NoteStatus, terminalSlotId: undefined }
        : note
    ))
    setSlots(s => s.map(slot =>
      slot.id === slotId
        ? { ...slot, status: 'idle', projectId: undefined, lastNoteId: undefined }
        : slot
    ))
  }, [])

  const renameSlot = useCallback((slotId: number, label: string) => {
    setSlots(s => s.map(slot => slot.id === slotId ? { ...slot, label } : slot))
  }, [])

  return {
    projects,
    notes,
    slots,
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
