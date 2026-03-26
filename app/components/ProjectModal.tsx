'use client'

import { useState } from 'react'
import { Project, PROJECT_COLORS, ColorId } from '../types'

interface Props {
  project?: Project | null
  onSave: (name: string, colorId: ColorId) => void
  onClose: () => void
}

export default function ProjectModal({ project, onSave, onClose }: Props) {
  const [name, setName] = useState(project?.name ?? '')
  const [colorId, setColorId] = useState<ColorId>(project?.colorId ?? 'yellow')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave(name.trim(), colorId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{project ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-2 block">Color</label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setColorId(color.id)}
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                  style={{
                    backgroundColor: color.bg,
                    borderColor: colorId === color.id ? color.text : 'transparent',
                    transform: colorId === color.id ? 'scale(1.2)' : undefined,
                  }}
                  title={color.id}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded font-medium hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 transition-colors"
            >
              {project ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
