import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import { IncomingMessage } from 'http'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as crypto from 'crypto'

const NUM_SLOTS = 3
const PORT = 3001
const WORKSPACES_ROOT = path.join(os.homedir(), 'birkan-workspaces')

// Augment PATH so claude binary is found regardless of how the server was launched
const augmentedEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PATH: [
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    process.env.PATH ?? '',
  ].join(':'),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureWorkspace(slotId: number): string {
  const dir = path.join(WORKSPACES_ROOT, `slot-${slotId}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function findClaudeBin(): string {
  for (const c of [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]) {
    if (fs.existsSync(c)) return c
  }
  return 'claude'
}

function saveImages(dataUrls: string[], dir?: string): string[] {
  return dataUrls.map((dataUrl) => {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return null
    const ext = m[1].split('/')[1] ?? 'png'
    const buf = Buffer.from(m[2], 'base64')
    const filePath = path.join(dir ?? os.tmpdir(), `birkan_${crypto.randomBytes(8).toString('hex')}.${ext}`)
    fs.writeFileSync(filePath, buf)
    return filePath
  }).filter((p): p is string => p !== null)
}

// ── Slot management ───────────────────────────────────────────────────────────

const SCROLLBACK_LIMIT = 10 * 1024 // 10 KB per slot

type Slot = {
  pty: ReturnType<typeof pty.spawn> | null
  clients: Set<WebSocket>
  scrollback: string
}

const slots: Slot[] = Array.from({ length: NUM_SLOTS }, () => ({
  pty: null,
  clients: new Set(),
  scrollback: '',
}))

function appendScrollback(slot: Slot, data: string) {
  slot.scrollback += data
  if (slot.scrollback.length > SCROLLBACK_LIMIT) {
    slot.scrollback = slot.scrollback.slice(-SCROLLBACK_LIMIT)
  }
}

function broadcast(slot: Slot, msg: unknown) {
  const data = JSON.stringify(msg)
  slot.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  })
}

function spawnSession(slotId: number, extraImagePaths: string[] = []) {
  const slot = slots[slotId]

  if (slot.pty) {
    try { slot.pty.kill() } catch { /* already dead */ }
    slot.pty = null
  }

  slot.scrollback = ''
  broadcast(slot, { type: 'output', data: '\r\n\x1b[2m[Starting session...]\x1b[0m\r\n' })

  const workspace = ensureWorkspace(slotId)
  const claudeBin = findClaudeBin()
  const spawnArgs = [
    '--dangerously-skip-permissions',
    ...extraImagePaths.flatMap(p => ['--image', p]),
  ]

  broadcast(slot, {
    type: 'output',
    data: `\x1b[2m[workspace: ~/birkan-workspaces/slot-${slotId}]\x1b[0m\r\n`,
  })

  console.log(`\x1b[2m[slot ${slotId}] spawn: ${claudeBin} ${spawnArgs.join(' ')}\x1b[0m`)

  const p = pty.spawn(claudeBin, spawnArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: workspace,
    env: augmentedEnv,
  })

  console.log(`\x1b[2m[slot ${slotId}] pty pid ${p.pid}\x1b[0m`)

  p.onData((data) => {
    appendScrollback(slot, data)
    broadcast(slot, { type: 'output', data })
  })

  p.onExit(({ exitCode }) => {
    console.log(`\x1b[33m[slot ${slotId}] exited (${exitCode})\x1b[0m`)
    slot.pty = null
    broadcast(slot, {
      type: 'output',
      data: `\r\n\x1b[2m[Session exited (${exitCode}). Click ↺ New to restart.]\x1b[0m\r\n`,
    })
    broadcast(slot, { type: 'status', status: 'idle' })
  })

  slot.pty = p
  return p
}

// ── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const slotId = parseInt(url.searchParams.get('slot') ?? '0', 10)

  if (isNaN(slotId) || slotId < 0 || slotId >= NUM_SLOTS) {
    ws.close(1008, 'Invalid slot')
    return
  }

  const slot = slots[slotId]
  slot.clients.add(ws)
  console.log(`\x1b[32m[slot ${slotId}] client connected (total=${slot.clients.size})\x1b[0m`)

  // Lazy-spawn: start session on first connection to this slot
  if (!slot.pty) spawnSession(slotId)

  // Replay buffered output so the browser sees what it missed
  if (slot.scrollback) {
    ws.send(JSON.stringify({ type: 'output', data: slot.scrollback }))
  }

  ws.on('message', (raw: Buffer) => {
    let msg: { type: string; data?: string; text?: string; images?: string[]; cols?: number; rows?: number }
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.type) {
      case 'input':
        if (slot.pty && msg.data) slot.pty.write(msg.data)
        break

      case 'resize':
        if (slot.pty && msg.cols && msg.rows) slot.pty.resize(msg.cols, msg.rows)
        break

      case 'reset':
        spawnSession(slotId)
        break

      case 'spawn_with_prompt': {
        const workspace = ensureWorkspace(slotId)
        const imagePaths = msg.images?.length ? saveImages(msg.images, workspace) : []
        const p = spawnSession(slotId, imagePaths)
        if (msg.text) {
          setTimeout(() => p.write(msg.text! + '\r'), 500)
        }
        break
      }
    }
  })

  ws.on('close', () => { slot.clients.delete(ws); console.log(`\x1b[2m[slot ${slotId}] client disconnected (total=${slot.clients.size})\x1b[0m`) })
  ws.on('error', (e) => { slot.clients.delete(ws); console.error(`\x1b[31m[slot ${slotId}] ws error: ${e.message}\x1b[0m`) })
})

console.log(`\x1b[32m[birkan server]\x1b[0m Terminal bridge on ws://localhost:${PORT}`)
console.log(`\x1b[32m[birkan server]\x1b[0m Mode: local claude (workspaces in ~/birkan-workspaces/)`)
console.log(`\x1b[2m  ${NUM_SLOTS} slots ready. Waiting for connections...\x1b[0m`)
