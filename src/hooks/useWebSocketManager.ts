import { useState, useRef, useEffect } from 'react'
import SimpleSpawnService from '../services/SimpleSpawnService'
import { Terminal as StoredTerminal } from '../stores/simpleTerminalStore'
import { Agent } from '../types'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  defaultTheme?: string
  defaultBackground?: string
  defaultTransparency?: number
  defaultFontFamily?: string
  defaultFontSize?: number
}

/**
 * Custom hook for WebSocket connection management and message handling.
 *
 * Handles:
 * - WebSocket connection setup, teardown, and auto-reconnect with exponential backoff
 * - Message routing (terminal-spawned, output, closed, tmux-sessions-list)
 * - Agent state management and lifecycle
 * - Window isolation for multi-window support (CRITICAL for popout feature)
 * - Terminal reconnection to existing tmux sessions on page refresh
 *
 * CRITICAL Window Isolation: This hook implements window filtering to prevent
 * cross-window contamination. Each window only manages terminals with matching windowId.
 * See CLAUDE.md "Critical Architecture (Popout Flow)" for details.
 *
 * @param currentWindowId - ID of current browser window
 * @param storedTerminals - Array of all stored terminals
 * @param activeTerminalId - ID of currently active terminal
 * @param spawnOptions - Array of available spawn options
 * @param spawnOptionsRef - Ref to spawn options (avoids closure issues)
 * @param useTmux - Whether tmux is enabled
 * @param pendingSpawns - Map of pending spawn requests by requestId
 * @param wsRef - CRITICAL: WebSocket ref that must be shared with Terminal components
 * @param updateTerminal - Function to update terminal properties
 * @param removeTerminal - Function to remove a terminal
 * @param setActiveTerminal - Function to set active terminal
 * @param handleReconnectTerminal - Function to reconnect to existing terminal session
 * @returns Object with webSocketAgents, connectionStatus, and setter
 */
export function useWebSocketManager(
  currentWindowId: string,
  storedTerminals: StoredTerminal[],
  activeTerminalId: string | null,
  spawnOptions: SpawnOption[],
  spawnOptionsRef: React.MutableRefObject<SpawnOption[]>,
  useTmux: boolean,
  pendingSpawns: React.MutableRefObject<Map<string, StoredTerminal>>,
  wsRef: React.MutableRefObject<WebSocket | null>, // CRITICAL: Use parent's wsRef!
  updateTerminal: (id: string, updates: Partial<StoredTerminal>) => void,
  removeTerminal: (id: string) => void,
  setActiveTerminal: (id: string | null) => void,
  handleReconnectTerminal: (terminal: StoredTerminal, option: SpawnOption) => Promise<void>
) {
  const [webSocketAgents, setWebSocketAgents] = useState<Agent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const processedAgentIds = useRef<Set<string>>(new Set())

  // Clear all agentIds on mount - they're always stale after page refresh
  const hasHydrated = useRef(false)
  useEffect(() => {
    if (!hasHydrated.current && storedTerminals.length > 0) {
      hasHydrated.current = true
      console.log('[useWebSocketManager] 🧹 Clearing stale agentIds from localStorage terminals')

      storedTerminals.forEach(terminal => {
        if (terminal.agentId || terminal.status === 'active') {
          updateTerminal(terminal.id, {
            agentId: undefined,
            status: 'spawning', // Will be updated to 'active' after reconnection
          })
        }
      })
    }
  }, [storedTerminals.length])

  // Query for tmux sessions after both spawn options load AND WebSocket connects
  const hasQueriedSessions = useRef(false)
  useEffect(() => {
    if (
      connectionStatus === 'connected' &&
      spawnOptions.length > 0 &&
      storedTerminals.length > 0 &&
      useTmux &&
      !hasQueriedSessions.current &&
      wsRef.current
    ) {
      console.log('[useWebSocketManager] ✅ Querying for active tmux sessions...')
      wsRef.current.send(JSON.stringify({ type: 'query-tmux-sessions' }))
      hasQueriedSessions.current = true
    }
  }, [connectionStatus, spawnOptions.length, storedTerminals.length, useTmux])

  // Reset query flag on disconnect
  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      hasQueriedSessions.current = false
    }
  }, [connectionStatus])

  /**
   * Handle WebSocket messages - routes messages to appropriate handlers
   * CRITICAL: Implements window isolation to prevent cross-window contamination
   */
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'terminal-spawned':
        if (message.data) {
          if (processedAgentIds.current.has(message.data.id)) {
            return
          }

          // Find matching terminal - check pendingSpawns ref first (synchronous)
          let existingTerminal = pendingSpawns.current.get(message.requestId)

          // Fallback: Check state by requestId
          if (!existingTerminal) {
            existingTerminal = storedTerminals.find(t => t.requestId === message.requestId)
          }

          // Fallback: Check by agentId (reconnection case)
          if (!existingTerminal) {
            existingTerminal = storedTerminals.find(t => t.agentId === message.data.id)
          }

          // Fallback: Find most recent spawning terminal of same type
          if (!existingTerminal) {
            existingTerminal = storedTerminals
              .filter(t => t.status === 'spawning' && t.terminalType === message.data.terminalType)
              .sort((a, b) => b.createdAt - a.createdAt)[0]
          }

          // CRITICAL: Only update terminals that belong to THIS window
          // Check this BEFORE adding to webSocketAgents to prevent cross-window contamination
          if (existingTerminal) {
            const terminalWindow = existingTerminal.windowId || 'main'
            if (terminalWindow !== currentWindowId) {
              console.log('[useWebSocketManager] ⏭️ Ignoring terminal-spawned for different window')
              return
            }

            console.log('[useWebSocketManager] ✅ Matched terminal:', existingTerminal.id)

            // Add to webSocketAgents
            processedAgentIds.current.add(message.data.id)
            setWebSocketAgents(prev => {
              const existingIndex = prev.findIndex(a => a.id === message.data.id)
              if (existingIndex !== -1) {
                const updated = [...prev]
                updated[existingIndex] = {
                  ...message.data,
                  status: message.data.state || message.data.status || 'active',
                }
                return updated
              }
              return [...prev, {
                ...message.data,
                status: message.data.state || message.data.status || 'active',
              }]
            })

            // Clear from pending spawns
            if (message.requestId) {
              pendingSpawns.current.delete(message.requestId)
            }

            // Update terminal with agent info - PRESERVE critical properties
            updateTerminal(existingTerminal.id, {
              agentId: message.data.id,
              sessionName: message.data.sessionName,
              status: 'active',
              requestId: undefined,
              // CRITICAL: Preserve frontend properties (user may have renamed, etc.)
              name: existingTerminal.name,
              terminalType: existingTerminal.terminalType,
              command: existingTerminal.command,
              icon: existingTerminal.icon,
              theme: existingTerminal.theme,
              background: existingTerminal.background,
              transparency: existingTerminal.transparency,
              fontSize: existingTerminal.fontSize,
              fontFamily: existingTerminal.fontFamily,
              // CRITICAL: Preserve split/window properties
              splitLayout: existingTerminal.splitLayout,
              isHidden: existingTerminal.isHidden,
              windowId: existingTerminal.windowId,
            })
          } else {
            // CRITICAL: Do NOT create terminal for unmatched spawns
            // Prevents cross-window contamination
            console.warn('[useWebSocketManager] ⏭️ Ignoring terminal-spawned - no matching terminal')
            return
          }
        }
        break

      case 'terminal-output':
        if (message.terminalId && message.data) {
          // Dispatch custom event for Terminal component to handle
          window.dispatchEvent(new CustomEvent('terminal-output', {
            detail: {
              terminalId: message.terminalId,
              data: message.data,
            },
          }))
        }
        break

      case 'terminal-closed':
        if (message.data && message.data.id) {
          setWebSocketAgents(prev => prev.filter(a => a.id !== message.data.id))

          // Find terminal with this agentId
          const terminal = storedTerminals.find(t => t.agentId === message.data.id)
          if (terminal) {
            console.log(`[useWebSocketManager] Terminal exited: ${terminal.name}`)

            // Handle split terminal removal
            if (terminal.isHidden) {
              const splitContainer = storedTerminals.find(t =>
                t.splitLayout?.panes?.some(p => p.terminalId === terminal.id)
              )

              if (splitContainer && splitContainer.splitLayout) {
                const remainingPanes = splitContainer.splitLayout.panes.filter(
                  p => p.terminalId !== terminal.id
                )

                if (remainingPanes.length === 1) {
                  // Convert to single terminal
                  updateTerminal(splitContainer.id, {
                    splitLayout: { type: 'single', panes: [] }
                  })
                  updateTerminal(remainingPanes[0].terminalId, { isHidden: false })
                } else if (remainingPanes.length > 1) {
                  updateTerminal(splitContainer.id, {
                    splitLayout: {
                      ...splitContainer.splitLayout,
                      panes: remainingPanes
                    }
                  })
                }
              }
            }

            // Remove terminal
            removeTerminal(terminal.id)

            // Switch active terminal or close window
            setTimeout(() => {
              const currentVisibleTerminals = storedTerminals.filter(t => {
                const terminalWindow = t.windowId || 'main'
                return terminalWindow === currentWindowId && !t.isHidden
              })

              if (activeTerminalId === terminal.id) {
                if (currentVisibleTerminals.length > 0) {
                  setActiveTerminal(currentVisibleTerminals[0].id)
                } else {
                  setActiveTerminal(null)
                  // Close popped-out windows when empty
                  if (currentWindowId !== 'main') {
                    setTimeout(() => window.close(), 1000)
                  }
                }
              }
            }, 100)
          }
        }
        break

      case 'tmux-sessions-list':
        if (message.data && message.data.sessions) {
          const activeSessions = new Set(message.data.sessions)
          const currentSpawnOptions = spawnOptionsRef.current

          console.log('[useWebSocketManager] 📋 Active tmux sessions:', Array.from(activeSessions))

          // Track which sessions we've started reconnecting (prevent duplicates)
          const reconnectingSessionsSet = new Set<string>()

          // Process stored terminals
          storedTerminals.forEach(terminal => {
            if (terminal.sessionName && activeSessions.has(terminal.sessionName)) {
              // Skip split containers ONLY if they're hidden (their session belongs to a pane)
              // But allow them to reconnect if they're visible (they are the first pane)
              if (terminal.splitLayout && terminal.splitLayout.type !== 'single' && terminal.isHidden) {
                console.log(`[useWebSocketManager] ⏭️ Skipping hidden split container (panes will reconnect separately):`, terminal.sessionName)
                return
              }

              // Skip duplicates
              if (reconnectingSessionsSet.has(terminal.sessionName)) {
                return
              }

              // Skip terminals from other windows
              const terminalWindow = terminal.windowId || 'main'
              if (terminalWindow !== currentWindowId) {
                return
              }

              reconnectingSessionsSet.add(terminal.sessionName)
              console.log(`[useWebSocketManager] 🔄 Reconnecting to session: ${terminal.sessionName}`)

              // Find spawn option
              let option = terminal.command
                ? currentSpawnOptions.find(opt => opt.command === terminal.command)
                : null

              if (!option) {
                option = currentSpawnOptions.find(opt => opt.terminalType === terminal.terminalType)
              }

              if (option) {
                handleReconnectTerminal(terminal, option)
              } else {
                console.warn(`[useWebSocketManager] ⚠️ No spawn option found for: ${terminal.command}`)
                updateTerminal(terminal.id, { status: 'error' })
              }
            } else if (terminal.sessionName) {
              // Session is dead, remove terminal
              console.log(`[useWebSocketManager] ❌ Session ${terminal.sessionName} not found, removing`)
              removeTerminal(terminal.id)
            }
          })
        }
        break
    }
  }

  /**
   * Connect to WebSocket server with auto-reconnect
   */
  const connectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setConnectionStatus('connecting')
    processedAgentIds.current.clear()

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let wsUrl: string
    if (import.meta.env.DEV) {
      wsUrl = `${protocol}//${window.location.host}/ws`
    } else {
      const backendPort = import.meta.env.VITE_BACKEND_PORT || '8127'
      const host = window.location.hostname || 'localhost'
      wsUrl = `${protocol}//${host}:${backendPort}/ws`
    }

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnectionStatus('connected')
      setReconnectAttempts(0)
    }

    ws.onclose = (evt) => {
      setConnectionStatus('disconnected')

      // CRITICAL: Clear old agents when disconnecting
      setWebSocketAgents([])
      processedAgentIds.current.clear()

      // Clear agentIds from all terminals (will be re-assigned on reconnect)
      storedTerminals.forEach(terminal => {
        if (terminal.agentId || terminal.status === 'active') {
          updateTerminal(terminal.id, {
            agentId: undefined,
            status: 'spawning',
          })
        }
      })

      if (evt.code === 1000 || evt.code === 1001) {
        return
      }

      // Exponential backoff reconnection
      const MAX_RECONNECT_ATTEMPTS = 10
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Maximum reconnection attempts reached')
        return
      }

      const baseDelay = 1000
      const maxDelay = 30000
      const retryDelay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay)

      setReconnectAttempts(prev => prev + 1)
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, retryDelay)
    }

    ws.onerror = (error) => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn('WebSocket connection failed, will retry...')
      }
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWebSocketMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    wsRef.current = ws
  }

  // Initialize WebSocket on mount
  useEffect(() => {
    SimpleSpawnService.initialize(wsRef)
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      if (wsRef.current) {
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
    }
  }, [])

  return {
    webSocketAgents,
    connectionStatus,
    setWebSocketAgents
  }
}
