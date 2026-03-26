import { WebSocketServer, WebSocket } from 'ws'
import * as pty from 'node-pty'
import { IncomingMessage } from 'http'
import { execSync } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as crypto from 'crypto'

const NUM_SLOTS = 3
const PORT = 3001

// Resolve claude binary — bun scripts don't inherit the full login shell PATH.
// Try common install locations before falling back to PATH lookup.
function resolveClaudeBin(): string {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]
  for (const c of candidates) {
    try { execSync(`test -x ${JSON.stringify(c)}`); return c } catch { /* not found */ }
  }
  // Last resort: let the shell find it
  return 'claude'
}

const CLAUDE_BIN = resolveClaudeBin()

// Augment PATH so the spawned process can find its own dependencies
const augmentedEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PATH: [
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH ?? '',
  ].join(':'),
}

type Slot = {
  pty: ReturnType<typeof pty.spawn> | null
  clients: Set<WebSocket>
}

const slots: Slot[] = Array.from({ length: NUM_SLOTS }, () => ({
  pty: null,
  clients: new Set(),
}))

function broadcast(slot: Slot, msg: unknown) {
  const data = JSON.stringify(msg)
  slot.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data)
  })
}

function saveImages(dataUrls: string[]): string[] {
  return dataUrls.map((dataUrl) => {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) return null
    const ext = m[1].split('/')[1] ?? 'png'
    const buf = Buffer.from(m[2], 'base64')
    const filePath = path.join(os.tmpdir(), `birkan_${crypto.randomBytes(8).toString('hex')}.${ext}`)
    fs.writeFileSync(filePath, buf)
    return filePath
  }).filter((p): p is string => p !== null)
}

function spawnClaude(slotId: number, imagePaths: string[] = []) {
  const slot = slots[slotId]

  if (slot.pty) {
    try { slot.pty.kill() } catch { /* already dead */ }
    slot.pty = null
  }

  broadcast(slot, { type: 'output', data: '\r\n\x1b[2m[New session starting...]\x1b[0m\r\n' })

  const imageArgs = imagePaths.flatMap(p => ['--image', p])
  const p = pty.spawn(CLAUDE_BIN, ['--dangerously-skip-permissions', ...imageArgs], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env: augmentedEnv,
  })

  p.onData((data) => {
    broadcast(slot, { type: 'output', data })
  })

  p.onExit(({ exitCode }) => {
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

// Boot all slots
for (let i = 0; i < NUM_SLOTS; i++) {
  spawnClaude(i)
}

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

  ws.on('message', (raw: Buffer) => {
    let msg: { type: string; data?: string; text?: string; images?: string[]; cols?: number; rows?: number }
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.type) {
      case 'input':
        if (slot.pty && msg.data) slot.pty.write(msg.data)
        break

      case 'resize':
        if (slot.pty && msg.cols && msg.rows) {
          slot.pty.resize(msg.cols, msg.rows)
        }
        break

      case 'reset':
        spawnClaude(slotId)
        break

      case 'spawn_with_prompt': {
        const imagePaths = msg.images && msg.images.length > 0 ? saveImages(msg.images) : []
        const p = spawnClaude(slotId, imagePaths)
        if (msg.text) {
          // Small delay so the PTY process has initialised its input handler
          setTimeout(() => p.write(msg.text! + '\r'), 300)
        }
        break
      }
    }
  })

  ws.on('close', () => slot.clients.delete(ws))
  ws.on('error', () => slot.clients.delete(ws))
})

console.log(`\x1b[32m[birkan server]\x1b[0m Terminal bridge on ws://localhost:${PORT}`)
console.log(`\x1b[2m  Spawned ${NUM_SLOTS} Claude sessions. Waiting for connections...\x1b[0m`)
