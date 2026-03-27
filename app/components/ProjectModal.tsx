'use client'

import { useState } from 'react'
import { Project, PROJECT_COLORS, ColorId } from '../types'

interface Props {
  project?: Project | null
  onSave: (name: string, colorId: ColorId, path?: string) => void
  onClose: () => void
}

function repoNameFromUrl(url: string): string {
  const clean = url.trim().replace(/\.git$/, '')
  return clean.split('/').pop() ?? ''
}

export default function ProjectModal({ project, onSave, onClose }: Props) {
  const [mode, setMode] = useState<'clone' | 'manual'>(project ? 'manual' : 'clone')
  const [name, setName] = useState(project?.name ?? '')
  const [colorId, setColorId] = useState<ColorId>(project?.colorId ?? 'yellow')
  const [manualPath, setManualPath] = useState(project?.path ?? '')

  // Clone mode state
  const [repoUrl, setRepoUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')

  function handleUrlChange(url: string) {
    setRepoUrl(url)
    setCloneError('')
    const detected = repoNameFromUrl(url)
    if (detected && !name) setName(detected)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    if (mode === 'clone' && repoUrl.trim()) {
      setCloning(true)
      setCloneError('')
      const dest = `~/birkan-workspaces/${name.trim()}`
      try {
        const res = await fetch('/api/projects/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: repoUrl.trim(), dest }),
        })
        const data = await res.json()
        if (!res.ok) {
          setCloneError(data.error ?? 'Clone failed')
          setCloning(false)
          return
        }
        onSave(name.trim(), colorId, data.path)
        onClose()
      } catch {
        setCloneError('Network error')
        setCloning(false)
      }
    } else {
      onSave(name.trim(), colorId, manualPath.trim() || undefined)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          {project ? 'Edit Project' : 'New Project'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Mode toggle (only for new projects) */}
          {!project && (
            <div className="flex rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setMode('clone')}
                className={`flex-1 py-1.5 transition-colors ${mode === 'clone' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Clone repo
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 py-1.5 transition-colors ${mode === 'manual' ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Local path
              </button>
            </div>
          )}

          {/* Clone URL */}
          {mode === 'clone' && !project && (
            <div>
              <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Repository URL</label>
              <input
                autoFocus
                value={repoUrl}
                onChange={e => handleUrlChange(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 font-mono"
              />
              {cloneError && <p className="text-xs text-red-500 mt-1">{cloneError}</p>}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Name</label>
            <input
              autoFocus={mode === 'manual' || !!project}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
            {mode === 'clone' && name && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">
                Will clone to ~/birkan-workspaces/{name.trim()}
              </p>
            )}
          </div>

          {/* Manual path */}
          {(mode === 'manual' || project) && (
            <div>
              <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Working Directory</label>
              <input
                value={manualPath}
                onChange={e => setManualPath(e.target.value)}
                placeholder="/Users/you/my-project"
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 font-mono"
              />
            </div>
          )}

          {/* Color */}
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
              disabled={cloning}
              className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || cloning}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded font-medium hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 transition-colors min-w-[80px]"
            >
              {cloning ? 'Cloning…' : project ? 'Save' : mode === 'clone' && repoUrl.trim() ? 'Clone' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
