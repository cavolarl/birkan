export const PROJECT_COLORS = [
  { id: 'yellow', bg: '#fef08a', text: '#713f12', border: '#eab308' },
  { id: 'pink',   bg: '#fbcfe8', text: '#831843', border: '#ec4899' },
  { id: 'blue',   bg: '#bfdbfe', text: '#1e3a5f', border: '#3b82f6' },
  { id: 'green',  bg: '#bbf7d0', text: '#14532d', border: '#22c55e' },
  { id: 'orange', bg: '#fed7aa', text: '#7c2d12', border: '#f97316' },
  { id: 'purple', bg: '#ddd6fe', text: '#4c1d95', border: '#8b5cf6' },
] as const

export type ColorId = typeof PROJECT_COLORS[number]['id']

export type Project = {
  id: string
  name: string
  colorId: ColorId
  path?: string
}

export type NoteStatus = 'idle' | 'in-progress' | 'done'

export type Note = {
  id: string
  projectId: string
  title: string
  body: string
  images?: string[]
  status: NoteStatus
  position: { x: number; y: number }
  terminalSlotId?: number
  createdAt: number
}

export type SlotStatus = 'idle' | 'working' | 'error'

export type TerminalSlot = {
  id: number
  label: string
  projectId?: string
  status: SlotStatus
  lastNoteId?: string
}
