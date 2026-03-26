import { getDb } from '../../db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = getDb()

  const fields: string[] = []
  const values: unknown[] = []

  if (body.title !== undefined)          { fields.push('title = ?');            values.push(body.title) }
  if (body.body !== undefined)           { fields.push('body = ?');             values.push(body.body) }
  if (body.images !== undefined)         { fields.push('images = ?');           values.push(JSON.stringify(body.images)) }
  if (body.status !== undefined)         { fields.push('status = ?');           values.push(body.status) }
  if (body.projectId !== undefined)      { fields.push('project_id = ?');       values.push(body.projectId) }
  if (body.position !== undefined)       { fields.push('position_x = ?, position_y = ?'); values.push(body.position.x, body.position.y) }
  if ('terminalSlotId' in body)          { fields.push('terminal_slot_id = ?'); values.push(body.terminalSlotId ?? null) }

  if (fields.length > 0) {
    db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
  }
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
  return Response.json({ ok: true })
}
