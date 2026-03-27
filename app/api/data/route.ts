import { getDb } from '../db'

export async function GET() {
  const db = getDb()
  const projects = db.prepare('SELECT id, name, color_id as colorId, path FROM projects ORDER BY rowid').all()
  const linkRows = db.prepare('SELECT note_id, linked_note_id FROM note_links').all() as { note_id: string; linked_note_id: string }[]
  const linkMap: Record<string, string[]> = {}
  for (const { note_id, linked_note_id } of linkRows) {
    ;(linkMap[note_id] ??= []).push(linked_note_id)
  }

  const notes = db.prepare(`
    SELECT id, project_id as projectId, title, body, images,
           status, position_x as posX, position_y as posY,
           terminal_slot_id as terminalSlotId, created_at as createdAt
    FROM notes ORDER BY created_at
  `).all().map((r) => {
    const row = r as Record<string, unknown>
    const { posX, posY, images, ...rest } = row
    return {
      ...rest,
      position: { x: posX, y: posY },
      images: JSON.parse(images as string) as string[],
      linkedNoteIds: linkMap[rest.id as string] ?? [],
    }
  })
  const slots = db.prepare(`
    SELECT id, label, project_id as projectId, status, last_note_id as lastNoteId
    FROM slots ORDER BY id
  `).all()

  return Response.json({ projects, notes, slots })
}
