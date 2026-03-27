import { getDb } from '../../db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = getDb()
  if (body.name !== undefined) db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(body.name, id)
  if (body.colorId !== undefined) db.prepare('UPDATE projects SET color_id = ? WHERE id = ?').run(body.colorId, id)
  if (body.path !== undefined) db.prepare('UPDATE projects SET path = ? WHERE id = ?').run(body.path || null, id)
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return Response.json({ ok: true })
}
