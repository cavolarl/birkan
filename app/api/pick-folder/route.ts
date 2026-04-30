import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST() {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'POSIX path of (choose folder)'`,
      { timeout: 60_000 }
    )
    const path = stdout.trim().replace(/\/$/, '') // strip trailing slash
    return Response.json({ path })
  } catch (err: unknown) {
    // User cancelled — osascript exits with code 1
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('User canceled')) return Response.json({ path: null })
    return Response.json({ path: null, error: msg }, { status: 500 })
  }
}
