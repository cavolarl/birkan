import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

// ---------- resolve claude binary (same logic as server.ts) ----------
function resolveClaudeBin(): string {
  const candidates = [
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK)
      return c
    } catch { /* not found */ }
  }
  return 'claude'
}

const CLAUDE_BIN = resolveClaudeBin()

const augmentedEnv = {
  ...process.env,
  PATH: [
    path.join(os.homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH ?? '',
  ].join(':'),
} as NodeJS.ProcessEnv

// ---------- directory scanner ----------
interface RepoInfo {
  name: string
  dir: string
  commits: string
  description: string
}

async function scanDirectory(dir: string): Promise<RepoInfo[]> {
  const expanded = dir.replace(/^~/, os.homedir())

  let gitDirs: string[] = []
  try {
    const { stdout } = await execAsync(
      `find ${JSON.stringify(expanded)} -name ".git" -type d -maxdepth 3 2>/dev/null || true`,
      { timeout: 10_000 }
    )
    gitDirs = stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }

  const repos = await Promise.all(
    gitDirs.slice(0, 10).map(async (gitDir) => {
      const repoDir = path.dirname(gitDir)
      const name = path.basename(repoDir)
      let commits = ''
      let description = ''

      try {
        const { stdout } = await execAsync(
          `git -C ${JSON.stringify(repoDir)} log --oneline -8 2>/dev/null || true`,
          { timeout: 5_000 }
        )
        commits = stdout.trim()
      } catch { /* skip */ }

      for (const readme of ['README.md', 'readme.md', 'README.txt']) {
        const p = path.join(repoDir, readme)
        if (fs.existsSync(p)) {
          description = fs.readFileSync(p, 'utf8').slice(0, 500)
          break
        }
      }
      if (!description) {
        const pkgPath = path.join(repoDir, 'package.json')
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
            description = pkg.description ?? ''
          } catch { /* skip */ }
        }
      }

      return { name, dir: repoDir, commits, description }
    })
  )

  return repos.filter((r) => r.name)
}

// ---------- call claude --print ----------
async function askClaude(prompt: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `birkan_${Date.now()}.txt`)
  try {
    fs.writeFileSync(tmpPath, prompt, 'utf8')
    const { stdout } = await execAsync(
      `${JSON.stringify(CLAUDE_BIN)} --dangerously-skip-permissions --print < ${JSON.stringify(tmpPath)}`,
      { timeout: 90_000, maxBuffer: 2 * 1024 * 1024, env: augmentedEnv, shell: '/bin/bash' }
    )
    return stdout
  } finally {
    try { fs.unlinkSync(tmpPath) } catch { /* ok */ }
  }
}

// ---------- extract JSON from Claude output ----------
function extractJSON(text: string): unknown {
  // Claude sometimes wraps JSON in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim()
  // Find first '{' to be safe
  const start = candidate.indexOf('{')
  if (start === -1) throw new Error('No JSON object found')
  return JSON.parse(candidate.slice(start))
}

// ---------- system prompt ----------
const SYSTEM_PROMPT = `You are a project setup assistant for Birkan, a kanban-style task board where developers drag notes onto Claude Code terminal sessions.

Your role: help the user discover what they want to work on by scanning their local repos/files, then suggest projects and actionable tasks to populate their board.

Available project colors: yellow, pink, blue, green, orange, purple

ALWAYS reply with valid JSON matching exactly this shape:
{
  "reply": "<your conversational message to show in the chat>",
  "suggestions": [
    {
      "name": "<project name, short>",
      "colorId": "<one of: yellow pink blue green orange purple>",
      "notes": [
        { "title": "<short actionable task title, under 60 chars>", "body": "<optional details or empty string>" }
      ]
    }
  ]
}

Rules:
- "suggestions" may be [] if you need more info or there's nothing to suggest yet
- Keep note titles short, specific, and actionable (e.g. "Fix login redirect bug" not "Work on auth")
- Infer tasks from recent git commits and README — look for TODOs, known issues, recent work in progress
- Pick a distinct color per project so they're visually distinguishable
- Maximum 6 projects and 5 notes per project`

// ---------- route handler ----------
export async function POST(request: Request) {
  try {
    const { message, directory, history } = (await request.json()) as {
      message: string
      directory: string
      history: Array<{ role: string; content: string }>
    }

    // Scan if message looks like a scan request or it's the first message
    let scanContext = ''
    const dir = directory || '~'
    const isScanRequest =
      history.length === 0 ||
      /\bscan\b|\bfind\b|\blook\b|\bcheck\b|\bexplore\b/i.test(message)

    if (isScanRequest) {
      const repos = await scanDirectory(dir)
      if (repos.length === 0) {
        scanContext = `\n\n[Scan of "${dir}" found no git repositories.]\n`
      } else {
        const repoLines = repos
          .map(
            (r) =>
              `### ${r.name} (${r.dir})\n` +
              (r.description ? `Description: ${r.description.split('\n')[0]}\n` : '') +
              (r.commits ? `Recent commits:\n${r.commits}\n` : '')
          )
          .join('\n')
        scanContext = `\n\n[Scanned "${dir}" — found ${repos.length} git repositories:]\n${repoLines}`
      }
    }

    // Build conversation history for the prompt
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const fullPrompt =
      SYSTEM_PROMPT +
      (historyText ? `\n\n--- Conversation so far ---\n${historyText}` : '') +
      scanContext +
      `\n\nUser: ${message}\n\nRespond with JSON only:`

    const raw = await askClaude(fullPrompt)
    const parsed = extractJSON(raw) as { reply: string; suggestions: unknown[] }

    return Response.json({ reply: parsed.reply, suggestions: parsed.suggestions ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json(
      { reply: `Sorry, something went wrong: ${message}`, suggestions: [] },
      { status: 500 }
    )
  }
}
