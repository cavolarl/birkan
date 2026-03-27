import { getDb } from '../../../../db'

// POST /api/notes/[id]/links  { linkedNoteId }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { linkedNoteId } = await req.json()
  const db = getDb()
  // Insert both directions so the relationship is symmetric
  db.prepare('INSERT OR IGNORE INTO note_links (note_id, linked_note_id) VALUES (?, ?)').run(id, linkedNoteId)
  db.prepare('INSERT OR IGNORE INTO note_links (note_id, linked_note_id) VALUES (?, ?)').run(linkedNoteId, id)
  return Response.json({ ok: true })
}

// DELETE /api/notes/[id]/links  { linkedNoteId }
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { linkedNoteId } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM note_links WHERE (note_id = ? AND linked_note_id = ?) OR (note_id = ? AND linked_note_id = ?)').run(id, linkedNoteId, linkedNoteId, id)
  return Response.json({ ok: true })
}
