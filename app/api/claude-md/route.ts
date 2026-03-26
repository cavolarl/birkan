import * as fs from 'fs'
import * as path from 'path'

const CLAUDE_MD_PATH = path.join(process.cwd(), 'CLAUDE.md')

export async function GET() {
  try {
    const content = fs.readFileSync(CLAUDE_MD_PATH, 'utf8')
    return Response.json({ content })
  } catch {
    return Response.json({ content: '' })
  }
}

export async function PUT(request: Request) {
  try {
    const { content } = (await request.json()) as { content: string }
    fs.writeFileSync(CLAUDE_MD_PATH, content, 'utf8')
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
