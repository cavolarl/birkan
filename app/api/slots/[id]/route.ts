import { getDb } from '../../db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = getDb()

  const fields: string[] = []
  const values: unknown[] = []

  if (body.label !== undefined)      { fields.push('label = ?');       values.push(body.label) }
  if (body.status !== undefined)     { fields.push('status = ?');      values.push(body.status) }
  if ('projectId' in body)           { fields.push('project_id = ?');  values.push(body.projectId ?? null) }
  if ('lastNoteId' in body)          { fields.push('last_note_id = ?'); values.push(body.lastNoteId ?? null) }

  if (fields.length > 0) {
    db.prepare(`UPDATE slots SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return Response.json({ ok: true })
}
