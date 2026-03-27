import { getDb } from '../db'

export async function POST(req: Request) {
  const { id, name, colorId, path } = await req.json()
  const db = getDb()
  db.prepare('INSERT INTO projects (id, name, color_id, path) VALUES (?, ?, ?, ?)').run(id, name, colorId, path ?? null)
  return Response.json({ ok: true })
}
