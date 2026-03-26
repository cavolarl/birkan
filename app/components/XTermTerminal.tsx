'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export interface XTermHandle {
  sendPrompt: (text: string, images?: string[]) => void
  sendReset: () => void
  clear: () => void
}

interface Props {
  wsUrl: string
  onStatusChange?: (status: 'idle' | 'working' | 'error') => void
}

const XTermTerminal = forwardRef<XTermHandle, Props>(({ wsUrl, onStatusChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useImperativeHandle(ref, () => ({
    sendPrompt: (text: string, images?: string[]) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (images && images.length > 0) {
        ws.send(JSON.stringify({ type: 'spawn_with_prompt', text, images }))
      } else {
        ws.send(JSON.stringify({ type: 'input', data: text + '\r' }))
      }
    },
    sendReset: () => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reset' }))
      }
    },
    clear: () => termRef.current?.clear(),
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        black: '#18181b',
        brightBlack: '#3f3f46',
        white: '#e4e4e7',
        brightWhite: '#fafafa',
      },
      fontFamily: 'var(--font-geist-mono), "Cascadia Code", "Fira Code", monospace',
      fontSize: 12,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    termRef.current = term

    // Defer initial fit so the browser has completed layout and the container
    // has real dimensions — otherwise xterm measures 0px and renders garbled.
    requestAnimationFrame(() => fit.fit())

    let reconnectTimer: ReturnType<typeof setTimeout>
    let alive = true

    function connect() {
      if (!alive) return
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        onStatusChange?.('idle')
        const dims = fit.proposeDimensions()
        if (dims) ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'output') term.write(msg.data as string)
        else if (msg.type === 'status') onStatusChange?.(msg.status)
      }

      ws.onerror = () => {
        onStatusChange?.('error')
      }

      ws.onclose = () => {
        if (alive) {
          onStatusChange?.('error')
          term.writeln('\r\n\x1b[31m[disconnected — retrying in 3s]\x1b[0m')
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    term.onData((data) => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })

    const observer = new ResizeObserver(() => {
      fit.fit()
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        const dims = fit.proposeDimensions()
        if (dims) ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      alive = false
      clearTimeout(reconnectTimer)
      observer.disconnect()
      wsRef.current?.close()
      term.dispose()
    }
  }, [wsUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
})

XTermTerminal.displayName = 'XTermTerminal'
export default XTermTerminal
