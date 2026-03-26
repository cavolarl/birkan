import { getDb } from '../db'

export async function GET() {
  const db = getDb()
  const projects = db.prepare('SELECT id, name, color_id as colorId FROM projects ORDER BY rowid').all()
  const notes = db.prepare(`
    SELECT id, project_id as projectId, title, body, images,
           status, position_x as posX, position_y as posY,
           terminal_slot_id as terminalSlotId, created_at as createdAt
    FROM notes ORDER BY created_at
  `).all().map((r) => {
    const row = r as Record<string, unknown>
    const { posX, posY, images, ...rest } = row
    return { ...rest, position: { x: posX, y: posY }, images: JSON.parse(images as string) as string[] }
  })
  const slots = db.prepare(`
    SELECT id, label, project_id as projectId, status, last_note_id as lastNoteId
    FROM slots ORDER BY id
  `).all()

  return Response.json({ projects, notes, slots })
}
