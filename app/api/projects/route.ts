import { getDb } from '../db'

export async function POST(req: Request) {
  const { id, name, colorId } = await req.json()
  const db = getDb()
  db.prepare('INSERT INTO projects (id, name, color_id) VALUES (?, ?, ?)').run(id, name, colorId)
  return Response.json({ ok: true })
}
