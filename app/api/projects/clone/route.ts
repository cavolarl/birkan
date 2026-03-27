import { spawnSync } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'

export async function POST(req: Request) {
  const { url, dest } = await req.json()

  if (!url || !dest) {
    return Response.json({ error: 'url and dest are required' }, { status: 400 })
  }

  // Resolve dest relative to home if needed
  const resolvedDest = dest.startsWith('~')
    ? path.join(os.homedir(), dest.slice(1))
    : dest

  if (fs.existsSync(resolvedDest) && fs.readdirSync(resolvedDest).length > 0) {
    return Response.json({ error: `Directory already exists and is not empty: ${dest}` }, { status: 400 })
  }

  fs.mkdirSync(resolvedDest, { recursive: true })

  const result = spawnSync('git', ['clone', url, resolvedDest], {
    encoding: 'utf8',
    timeout: 120_000,
  })

  if (result.status !== 0) {
    // Clean up empty dir on failure
    try { fs.rmdirSync(resolvedDest) } catch { /* ignore */ }
    const err = result.stderr?.trim() || result.error?.message || 'git clone failed'
    return Response.json({ error: err }, { status: 500 })
  }

  return Response.json({ ok: true, path: resolvedDest })
}
