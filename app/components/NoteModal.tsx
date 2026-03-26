'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Note, Project, PROJECT_COLORS } from '../types'

interface Props {
  note?: Note | null
  projects: Project[]
  defaultProjectId?: string
  onSave: (projectId: string, title: string, body: string, images: string[]) => void
  onClose: () => void
}

export default function NoteModal({ note, projects, defaultProjectId, onSave, onClose }: Props) {
  const [projectId, setProjectId] = useState(note?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '')
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [images, setImages] = useState<string[]>(note?.images ?? [])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [projects, projectId])

  const addImageFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (dataUrl) setImages(prev => [...prev, dataUrl])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      const imageItems = Array.from(items).filter(i => i.type.startsWith('image/'))
      if (imageItems.length === 0) return
      e.preventDefault()
      const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]
      addImageFiles(files)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addImageFiles])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (Array.from(e.dataTransfer.items).some(i => i.type.startsWith('image/'))) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    addImageFiles(e.dataTransfer.files)
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    onSave(projectId, title.trim(), body.trim(), images)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`bg-white dark:bg-zinc-900 border rounded-lg shadow-2xl w-full max-w-md p-6 transition-colors ${
          isDragOver
            ? 'border-zinc-400 dark:border-zinc-500 ring-2 ring-zinc-300 dark:ring-zinc-600'
            : 'border-zinc-200 dark:border-zinc-700'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{note ? 'Edit Note' : 'New Note'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Project</label>
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-500">No projects yet — create one first.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {projects.map(p => {
                  const color = PROJECT_COLORS.find(c => c.id === p.colorId) ?? PROJECT_COLORS[0]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProjectId(p.id)}
                      className="px-3 py-1 rounded text-sm font-medium border-2 transition-all hover:opacity-90 active:scale-95"
                      style={{
                        backgroundColor: projectId === p.id ? color.bg : 'transparent',
                        color: projectId === p.id ? color.text : color.bg,
                        borderColor: color.border,
                      }}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-1 block">Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Context, details, requirements..."
              rows={5}
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 resize-none"
            />
          </div>

          {/* Images section */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">Images</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                + Add
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => e.target.files && addImageFiles(e.target.files)}
            />
            {images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="relative group/img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-zinc-300 dark:border-zinc-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-800 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity leading-none"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                Drop images here, paste, or click + Add
              </p>
            )}
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
              disabled={!title.trim() || !projectId}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded font-medium hover:bg-zinc-700 dark:hover:bg-white disabled:opacity-40 transition-colors"
            >
              {note ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
