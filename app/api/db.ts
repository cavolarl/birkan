import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const DB_DIR = path.join(os.homedir(), 'birkan-workspaces')
fs.mkdirSync(DB_DIR, { recursive: true })

const DB_PATH = path.join(DB_DIR, 'birkan.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  migrate(_db)
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      color_id  TEXT NOT NULL,
      path      TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id               TEXT PRIMARY KEY,
      project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      body             TEXT NOT NULL DEFAULT '',
      images           TEXT NOT NULL DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'idle',
      position_x       REAL NOT NULL DEFAULT 40,
      position_y       REAL NOT NULL DEFAULT 40,
      terminal_slot_id INTEGER,
      created_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slots (
      id           INTEGER PRIMARY KEY,
      label        TEXT NOT NULL,
      project_id   TEXT REFERENCES projects(id) ON DELETE SET NULL,
      status       TEXT NOT NULL DEFAULT 'idle',
      last_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL
    );
  `)

  // Add path column to projects if it doesn't exist (migration for existing DBs)
  const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[]
  if (!cols.some(c => c.name === 'path')) {
    db.exec('ALTER TABLE projects ADD COLUMN path TEXT')
  }

  // Seed default slots if the table is empty
  const { c } = db.prepare('SELECT COUNT(*) as c FROM slots').get() as { c: number }
  if (c === 0) {
    const ins = db.prepare('INSERT INTO slots (id, label) VALUES (?, ?)')
    ins.run(0, 'Terminal 1')
    ins.run(1, 'Terminal 2')
    ins.run(2, 'Terminal 3')
  }
}
