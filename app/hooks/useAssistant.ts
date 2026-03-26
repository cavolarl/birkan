'use client'

import { useState, useCallback } from 'react'
import type { ColorId } from '../types'

export type ProjectSuggestion = {
  name: string
  colorId: ColorId
  notes: Array<{ title: string; body: string }>
}

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string
  suggestions?: ProjectSuggestion[]
}

const GREETING: AssistantMessage = {
  role: 'assistant',
  content:
    `Hi! I can scan your local repos to help you set up projects and tasks for your board. Enter a directory below, or just say "scan ~/" to get started.`,
}

export function useAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING])
  const [directory, setDirectory] = useState('~/')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: AssistantMessage = { role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      // Build history without the greeting or suggestions (just text)
      const history = [...messages, userMsg]
        .filter((m) => m.role !== 'assistant' || m !== GREETING)
        .map((m) => ({ role: m.role, content: m.content }))

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, directory, history }),
        })

        const data = (await res.json()) as { reply: string; suggestions: ProjectSuggestion[] }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            suggestions: data.suggestions?.length ? data.suggestions : undefined,
          },
        ])
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Something went wrong. Is the dev server running?' },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [messages, directory]
  )

  function reset() {
    setMessages([GREETING])
  }

  return { messages, directory, setDirectory, isLoading, sendMessage, reset }
}
