import { getDb } from '../db'

export async function POST(req: Request) {
  const n = await req.json()
  const db = getDb()
  db.prepare(`
    INSERT INTO notes (id, project_id, title, body, images, status, position_x, position_y, terminal_slot_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    n.id, n.projectId, n.title, n.body ?? '',
    JSON.stringify(n.images ?? []),
    n.status ?? 'idle',
    n.position?.x ?? 40, n.position?.y ?? 40,
    n.terminalSlotId ?? null,
    n.createdAt ?? Date.now(),
  )
  return Response.json({ ok: true })
}
