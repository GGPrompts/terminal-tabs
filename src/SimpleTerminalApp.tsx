import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { SettingsModal } from './components/SettingsModal'
import { Agent, TERMINAL_TYPES } from './types'
import { useSimpleTerminalStore, Terminal as StoredTerminal } from './stores/simpleTerminalStore'
import { useSettingsStore } from './stores/useSettingsStore'
import SimpleSpawnService from './services/SimpleSpawnService'
import { backgroundGradients, getBackgroundCSS } from './styles/terminal-backgrounds'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  defaultTheme?: string
  defaultBackground?: string // Background gradient key
  defaultTransparency?: number
  defaultFontFamily?: string
  defaultFontSize?: number
}

// Legacy theme-to-background mapping for migration (auto-assign backgrounds from themes)
const THEME_BACKGROUNDS: Record<string, string> = {
  default: 'dark-neutral',
  amber: 'amber-warmth',
  matrix: 'matrix-depths',
  dracula: 'dracula-purple',
  monokai: 'monokai-brown',
  'solarized-dark': 'solarized-dark',
  'github-dark': 'github-dark',
  cyberpunk: 'cyberpunk-neon',
  holographic: 'ocean-depths',
  vaporwave: 'vaporwave-dream',
  retro: 'amber-warmth',
  synthwave: 'synthwave-sunset',
  aurora: 'aurora-borealis',
}

function SimpleTerminalApp() {
  const [webSocketAgents, setWebSocketAgents] = useState<Agent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [showSpawnMenu, setShowSpawnMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const headerHideTimer = useRef<NodeJS.Timeout | null>(null)

  // Settings
  const { useTmux, updateSettings } = useSettingsStore()
  const [showCustomizePanel, setShowCustomizePanel] = useState(false)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const spawnOptionsRef = useRef<SpawnOption[]>([]) // Ref to avoid closure issues
  const wsRef = useRef<WebSocket | null>(null)
  const terminalRef = useRef<any>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const processedAgentIds = useRef<Set<string>>(new Set())
  const pendingSpawns = useRef<Map<string, StoredTerminal>>(new Map()) // Track pending spawns by requestId

  const {
    terminals: storedTerminals,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    updateTerminal,
    setActiveTerminal,
    clearAllTerminals,
  } = useSimpleTerminalStore()

  // Merge WebSocket agents with stored terminals
  const agents = useMemo(() => {
    const activeAgentsMap = new Map(webSocketAgents.map(a => [a.id, a]))
    const result: Agent[] = []
    const processedIds = new Set<string>()

    storedTerminals.forEach(terminal => {
      if (terminal.agentId) {
        const activeAgent = activeAgentsMap.get(terminal.agentId)
        if (activeAgent && !processedIds.has(activeAgent.id)) {
          result.push(activeAgent)
          processedIds.add(activeAgent.id)
          activeAgentsMap.delete(terminal.agentId)
        }
      }
    })

    activeAgentsMap.forEach((agent, id) => {
      if (!processedIds.has(id)) {
        result.push(agent)
        processedIds.add(id)
      }
    })

    return result
  }, [webSocketAgents, storedTerminals])

  // Load spawn options from JSON file
  const loadSpawnOptions = () => {
    console.log('[SimpleTerminalApp] 📥 Loading spawn options...')
    fetch('/spawn-options.json')
      .then(res => res.json())
      .then(data => {
        if (data.spawnOptions) {
          console.log('[SimpleTerminalApp] ✅ Spawn options loaded:', data.spawnOptions.length, 'options')
          setSpawnOptions(data.spawnOptions)
          spawnOptionsRef.current = data.spawnOptions // Update ref immediately
        }
      })
      .catch(err => console.error('[SimpleTerminalApp] ❌ Failed to load spawn options:', err))
  }

  // Keep ref in sync with state
  useEffect(() => {
    spawnOptionsRef.current = spawnOptions
  }, [spawnOptions])

  useEffect(() => {
    loadSpawnOptions()
  }, [])

  // Clear all agentIds on mount - they're always stale after page refresh
  // This prevents terminals from trying to render with old invalid agentIds
  const hasHydrated = useRef(false)
  useEffect(() => {
    if (!hasHydrated.current && storedTerminals.length > 0) {
      hasHydrated.current = true
      console.log('[SimpleTerminalApp] 🧹 Clearing stale agentIds from localStorage terminals')

      storedTerminals.forEach(terminal => {
        if (terminal.agentId || terminal.status === 'active') {
          updateTerminal(terminal.id, {
            agentId: undefined,
            status: 'spawning', // Will be updated to 'active' after reconnection
          })
        }
      })
    }
  }, [storedTerminals.length]) // Run when terminals are hydrated from localStorage

  // Query for tmux sessions after both spawn options load AND WebSocket connects
  const hasQueriedSessions = useRef(false)
  useEffect(() => {
    console.log('[SimpleTerminalApp] 🔍 Checking reconnection conditions:', {
      connectionStatus,
      spawnOptionsCount: spawnOptions.length,
      storedTerminalsCount: storedTerminals.length,
      useTmux,
      hasQueried: hasQueriedSessions.current,
      wsReady: !!wsRef.current
    })

    if (
      connectionStatus === 'connected' &&
      spawnOptions.length > 0 &&
      storedTerminals.length > 0 &&
      useTmux &&
      !hasQueriedSessions.current &&
      wsRef.current
    ) {
      console.log('[SimpleTerminalApp] ✅ All conditions met! Querying for active tmux sessions...')
      wsRef.current.send(JSON.stringify({ type: 'query-tmux-sessions' }))
      hasQueriedSessions.current = true
    } else if (storedTerminals.length > 0 && useTmux) {
      console.log('[SimpleTerminalApp] ⏳ Waiting for conditions:', {
        needsConnection: connectionStatus !== 'connected',
        needsSpawnOptions: spawnOptions.length === 0,
        alreadyQueried: hasQueriedSessions.current
      })
    }
  }, [connectionStatus, spawnOptions.length, storedTerminals.length, useTmux])

  // Reset query flag on disconnect
  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      hasQueriedSessions.current = false
    }
  }, [connectionStatus])

  // Initialize WebSocket
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

  // Track last closed terminal for Ctrl+Shift+T
  const lastClosedTerminalRef = useRef<{ terminalType: string; icon?: string; name: string } | null>(null)

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close spawn menu
      if (e.key === 'Escape' && showSpawnMenu) {
        setShowSpawnMenu(false)
        return
      }

      // Ctrl+T - Spawn first option (default)
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        if (spawnOptions.length > 0) {
          handleSpawnTerminal(spawnOptions[0])
        } else {
          setShowSpawnMenu(prev => !prev)
        }
        return
      }

      // Ctrl+W - Close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeTerminalId) {
          const terminal = storedTerminals.find(t => t.id === activeTerminalId)
          if (terminal) {
            lastClosedTerminalRef.current = {
              terminalType: terminal.terminalType,
              icon: terminal.icon,
              name: terminal.name,
            }
          }
          handleCloseTerminal(activeTerminalId)
        }
        return
      }

      // Ctrl+Tab - Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        if (storedTerminals.length > 0) {
          const currentIndex = storedTerminals.findIndex(t => t.id === activeTerminalId)
          const nextIndex = (currentIndex + 1) % storedTerminals.length
          setActiveTerminal(storedTerminals[nextIndex].id)
        }
        return
      }

      // Ctrl+Shift+Tab - Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (storedTerminals.length > 0) {
          const currentIndex = storedTerminals.findIndex(t => t.id === activeTerminalId)
          const prevIndex = currentIndex <= 0 ? storedTerminals.length - 1 : currentIndex - 1
          setActiveTerminal(storedTerminals[prevIndex].id)
        }
        return
      }

      // Ctrl+Shift+T - Reopen last closed tab
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        if (lastClosedTerminalRef.current) {
          const option = spawnOptions.find(
            opt => opt.terminalType === lastClosedTerminalRef.current!.terminalType
          )
          if (option) {
            handleSpawnTerminal(option)
          }
        }
        return
      }

      // Ctrl+1-9 - Jump to tab N
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const tabIndex = parseInt(e.key) - 1
        if (tabIndex < storedTerminals.length) {
          setActiveTerminal(storedTerminals[tabIndex].id)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSpawnMenu, activeTerminalId, storedTerminals, spawnOptions])

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
      // Note: Reconnection query happens in separate useEffect after spawn options load
    }

    ws.onclose = (evt) => {
      setConnectionStatus('disconnected')

      if (evt.code === 1000 || evt.code === 1001) {
        return
      }

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

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'terminal-spawned':
        if (message.data) {
          if (processedAgentIds.current.has(message.data.id)) {
            return
          }
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

          // Debug: Show all stored terminals and what we're looking for
          console.log('[SimpleTerminalApp] Looking for requestId:', message.requestId)
          console.log('[SimpleTerminalApp] Stored terminals:', storedTerminals.map(t => ({
            id: t.id,
            requestId: t.requestId,
            status: t.status,
            type: t.terminalType
          })))
          console.log('[SimpleTerminalApp] Pending spawns:', Array.from(pendingSpawns.current.keys()))

          // FIRST: Check pendingSpawns ref (synchronous, no race condition!)
          let existingTerminal = pendingSpawns.current.get(message.requestId)
          console.log('[SimpleTerminalApp] Found in pendingSpawns ref?', !!existingTerminal)

          // SECOND: Check state (in case ref was cleared but state updated)
          if (!existingTerminal) {
            existingTerminal = storedTerminals.find(t => t.requestId === message.requestId)
            console.log('[SimpleTerminalApp] Found in state by requestId?', !!existingTerminal)
          }

          // Fallback 1: Check if this agent already has a stored terminal
          if (!existingTerminal) {
            existingTerminal = storedTerminals.find(t => t.agentId === message.data.id)
            console.log('[SimpleTerminalApp] Found by agentId?', !!existingTerminal)
          }

          // Fallback 2: Find the most recent spawning terminal of same type (for reconnections)
          if (!existingTerminal) {
            existingTerminal = storedTerminals
              .filter(t => t.status === 'spawning' && t.terminalType === message.data.terminalType)
              .sort((a, b) => b.createdAt - a.createdAt)[0]
            console.log('[SimpleTerminalApp] Found by type?', !!existingTerminal)
          }

          if (existingTerminal) {
            console.log('[SimpleTerminalApp] ✅ Matched terminal:', existingTerminal.id, 'requestId:', message.requestId)

            // Clear from pending spawns ref
            if (message.requestId) {
              pendingSpawns.current.delete(message.requestId)
              console.log('[SimpleTerminalApp] Cleared from pendingSpawns ref')
            }

            // Update existing terminal with agent info
            updateTerminal(existingTerminal.id, {
              agentId: message.data.id,
              sessionName: message.data.sessionName,
              status: 'active',
              requestId: undefined, // Clear requestId after matching
            })
          } else {
            // This should rarely happen now that we match by requestId
            console.warn('[SimpleTerminalApp] No matching terminal found for requestId:', message.requestId)
            const option = spawnOptions.find(opt => opt.terminalType === message.data.terminalType)
            const newTerminal: StoredTerminal = {
              id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: message.data.name || message.data.terminalType,
              terminalType: message.data.terminalType,
              icon: option?.icon,
              agentId: message.data.id,
              workingDir: message.data.workingDir,
              sessionName: message.data.sessionName,
              createdAt: Date.now(),
              status: 'active',
            }
            addTerminal(newTerminal)
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

          // Find terminal with this agentId and update status
          const terminal = storedTerminals.find(t => t.agentId === message.data.id)
          if (terminal) {
            updateTerminal(terminal.id, {
              status: 'closed',
              agentId: undefined,
            })
          }
        }
        break

      case 'tmux-sessions-list':
        if (message.data && message.data.sessions) {
          const activeSessions = new Set(message.data.sessions)
          const currentSpawnOptions = spawnOptionsRef.current // Use ref to avoid closure issues

          console.log('[SimpleTerminalApp] 📋 Active tmux sessions:', Array.from(activeSessions))
          console.log('[SimpleTerminalApp] 💾 Stored terminals:', storedTerminals.map(t => ({
            id: t.id.slice(-8),
            sessionName: t.sessionName,
            status: t.status,
            terminalType: t.terminalType
          })))
          console.log('[SimpleTerminalApp] 📦 Spawn options loaded:', currentSpawnOptions.length)

          // Process stored terminals
          storedTerminals.forEach(terminal => {
            if (terminal.sessionName && activeSessions.has(terminal.sessionName)) {
              // Session exists! Reconnect by respawning (backend will auto-attach)
              console.log(`[SimpleTerminalApp] 🔄 Reconnecting to session: ${terminal.sessionName}`)

              // Find spawn option - prioritize matching by command, fallback to terminalType
              let option = terminal.command
                ? currentSpawnOptions.find(opt => opt.command === terminal.command)
                : null

              if (!option) {
                // Fallback: find by terminalType (for terminals without command stored)
                option = currentSpawnOptions.find(opt => opt.terminalType === terminal.terminalType)
              }

              if (option) {
                // Respawn with existing sessionName (backend will reconnect)
                handleReconnectTerminal(terminal, option)
              } else {
                console.warn(`[SimpleTerminalApp] ⚠️ No spawn option found for command: ${terminal.command}, type: ${terminal.terminalType}`)
                console.log('[SimpleTerminalApp] Available spawn options:', currentSpawnOptions.map(o => ({ command: o.command, type: o.terminalType })))
                // Mark as error but don't remove - user might add the spawn option later
                updateTerminal(terminal.id, { status: 'error' })
              }
            } else if (terminal.sessionName) {
              // Session is dead, remove terminal from store
              console.log(`[SimpleTerminalApp] ❌ Session ${terminal.sessionName} not found, removing terminal`)
              removeTerminal(terminal.id)
            }
            // If no sessionName, it's a non-tmux terminal, leave it alone
          })
        }
        break
    }
  }

  // Terminal type abbreviations for short session names
  const terminalTypeAbbreviations: Record<string, string> = {
    'claude-code': 'cc',
    'opencode': 'oc',
    'codex': 'cx',
    'gemini': 'gm',
    'bash': 'bash',
    'tui-tool': 'tui',
    'default': 'term',
  }

  // Generate short session name like "tt-cc-a3k" (Terminal Tabs - Claude Code - random suffix)
  const generateSessionName = (terminalType: string, label?: string, command?: string): string => {
    // Special cases: TFE, LazyGit, etc. use their command as abbreviation
    let abbrev: string
    if (command === 'tfe') {
      abbrev = 'tfe'
    } else if (command === 'lazygit') {
      abbrev = 'lg'
    } else if (command === 'micro') {
      abbrev = 'micro'
    } else {
      abbrev = terminalTypeAbbreviations[terminalType] || terminalType.slice(0, 4)
    }

    // Use random 3-char suffix to avoid collisions (like "tt-cc-a3k")
    // This ensures unique names even if localStorage is cleared but tmux sessions remain
    const suffix = Math.random().toString(36).substring(2, 5)
    return `tt-${abbrev}-${suffix}`
  }

  const handleSpawnTerminal = async (option: SpawnOption) => {
    setShowSpawnMenu(false)

    try {
      // Generate requestId FIRST
      const requestId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Generate short session name (e.g., "tt-cc-1", "tt-tfe-1")
      const sessionName = useTmux ? generateSessionName(option.terminalType, option.label, option.command) : undefined

      // Create placeholder terminal IMMEDIATELY (before spawn)
      const newTerminal: StoredTerminal = {
        id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: option.label,
        terminalType: option.terminalType,
        command: option.command, // Store original command for matching during reconnection
        icon: option.icon,
        workingDir: option.workingDir || '~',
        theme: option.defaultTheme,
        background: option.defaultBackground || THEME_BACKGROUNDS[option.defaultTheme || 'default'] || 'dark-neutral',
        transparency: option.defaultTransparency,
        fontSize: option.defaultFontSize || useSettingsStore.getState().terminalDefaultFontSize,
        fontFamily: option.defaultFontFamily,
        sessionName, // Store session name for persistence
        createdAt: Date.now(),
        status: 'spawning',
        requestId, // Store requestId for matching with WebSocket response
      }

      // Store in ref FIRST (synchronous, no race condition)
      pendingSpawns.current.set(requestId, newTerminal)

      // Then add to state (async)
      addTerminal(newTerminal)
      console.log('[SimpleTerminalApp] Created placeholder terminal with requestId:', requestId, 'sessionName:', sessionName)

      // Build config
      const config: any = {
        terminalType: option.terminalType,
        name: option.label,
        workingDir: option.workingDir || '~',
        theme: option.defaultTheme,
        transparency: option.defaultTransparency,
        size: { width: 800, height: 600 },
        useTmux,  // Pass tmux setting from store
        sessionName,  // Short session name like "tt-cc-1"
        resumable: useTmux,  // CRITICAL: Make sessions persistent when using tmux!
      }

      // Convert command to commands array (like opustrator)
      // TUI tools use toolName, others use commands array
      if (option.terminalType === 'tui-tool') {
        config.toolName = option.command
      } else if (option.command) {
        config.commands = [option.command]
        config.startCommand = option.command  // For reconnection
      }

      console.log('[SimpleTerminalApp] Spawning with config (useTmux:', useTmux, '):', config)

      // Send spawn request (now we already have the placeholder in state)
      // We can await here safely because placeholder is already created
      const returnedRequestId = await SimpleSpawnService.spawn({ config, requestId })

      if (!returnedRequestId) {
        console.error('Failed to spawn terminal')
        updateTerminal(newTerminal.id, { status: 'error' })
        return
      }

      // Status will be updated to 'active' when WebSocket receives terminal-spawned
    } catch (error) {
      console.error('Error spawning terminal:', error)
    }
  }

  const handleReconnectTerminal = async (terminal: StoredTerminal, option: SpawnOption) => {
    try {
      // Generate requestId for reconnection
      const requestId = `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Create updated terminal object
      const updatedTerminal = {
        ...terminal,
        status: 'spawning' as const,
        requestId,
        agentId: undefined, // Clear old agentId (will get new one from backend)
      }

      // Update terminal state
      updateTerminal(terminal.id, {
        status: 'spawning',
        requestId,
        agentId: undefined,
      })

      // Store UPDATED terminal in pending spawns ref (with requestId!)
      pendingSpawns.current.set(requestId, updatedTerminal)

      console.log(`[SimpleTerminalApp] Reconnecting terminal ${terminal.id} to session ${terminal.sessionName}`)

      // Build config with EXISTING sessionName (backend will detect and reconnect)
      const config: any = {
        terminalType: option.terminalType,
        name: option.label,
        workingDir: terminal.workingDir || option.workingDir || '~',
        theme: terminal.theme || option.defaultTheme,
        background: terminal.background || option.defaultBackground || THEME_BACKGROUNDS[terminal.theme || 'default'] || 'dark-neutral',
        transparency: terminal.transparency ?? option.defaultTransparency,
        fontSize: terminal.fontSize ?? option.defaultFontSize ?? useSettingsStore.getState().terminalDefaultFontSize,
        fontFamily: terminal.fontFamily ?? option.defaultFontFamily,
        size: { width: 800, height: 600 },
        useTmux: true, // Must be true for reconnection
        sessionName: terminal.sessionName, // CRITICAL: Use existing session name!
        resumable: true, // CRITICAL: Must be resumable for persistence!
      }

      // Add command/toolName
      if (option.terminalType === 'tui-tool') {
        config.toolName = option.command
      } else if (option.command) {
        config.commands = [option.command]
        config.startCommand = option.command
      }

      console.log('[SimpleTerminalApp] Reconnecting with config:', config)

      // Send spawn request (backend will detect existing session and reconnect)
      const returnedRequestId = await SimpleSpawnService.spawn({ config, requestId })

      if (!returnedRequestId) {
        console.error('Failed to reconnect terminal')
        updateTerminal(terminal.id, { status: 'error' })
        return
      }

      // Status will be updated to 'active' when WebSocket receives terminal-spawned
    } catch (error) {
      console.error('Error reconnecting terminal:', error)
      updateTerminal(terminal.id, { status: 'error' })
    }
  }

  const handleCloseTerminal = (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (terminal && terminal.agentId) {
      // Close via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'close',
          terminalId: terminal.agentId,
        }))
      }
    }
    removeTerminal(terminalId)
  }

  const handleClearAllSessions = async () => {
    if (!confirm('⚠️ Clear all sessions and localStorage?\n\nThis will:\n• Kill all active tmux sessions\n• Close all terminals\n• Clear all stored data\n\nThis cannot be undone!')) {
      return
    }

    console.log('[SimpleTerminalApp] Clearing all sessions...')

    // Close all active terminals via WebSocket
    storedTerminals.forEach(terminal => {
      if (terminal.agentId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'close',
          terminalId: terminal.agentId,
        }))
      }
    })

    // Kill all terminal-tabs tmux sessions (in case some are orphaned)
    // Pattern 'tt-*' only matches sessions like: tt-bash-a3k, tt-cc-x9z, etc.
    // Safe: 'terminal-tabs', 'pyradio', 'tfe' won't match (don't start with "tt-")
    try {
      await fetch('/api/tmux/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: 'tt-*' })
      })
      console.log('[SimpleTerminalApp] 🧹 Killed all terminal-tabs tmux sessions')
    } catch (err) {
      console.warn('[SimpleTerminalApp] Failed to cleanup tmux sessions:', err)
    }

    // Clear all terminals from store (will also clear localStorage via persist)
    clearAllTerminals()

    // Clear global settings including cached font size (opustrator-settings)
    localStorage.removeItem('opustrator-settings')

    console.log('[SimpleTerminalApp] ✅ All sessions and settings cleared')

    // Reload page to apply fresh defaults
    window.location.reload()
  }

  const handleCommand = (command: string, terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (terminal && terminal.agentId) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'command',
          terminalId: terminal.agentId,
          command,
        }))
      }
    }
  }

  const activeTerminal = storedTerminals.find(t => t.id === activeTerminalId)
  const activeAgent = activeTerminal?.agentId
    ? agents.find(a => a.id === activeTerminal.agentId)
    : null
  const terminalInfo = activeAgent
    ? TERMINAL_TYPES.find(t => t.value === activeAgent.terminalType)
    : null

  // Footer control handlers - Tab-specific customizations (persisted per-tab)
  // These changes are specific to the active tab and persist through refresh
  // New spawns always use defaults from spawn-options.json
  const handleFontSizeChange = (delta: number) => {
    if (!activeTerminal || !terminalRef.current) return
    const globalDefault = useSettingsStore.getState().terminalDefaultFontSize
    const currentSize = activeTerminal.fontSize || globalDefault
    const newSize = Math.max(10, Math.min(24, currentSize + delta))
    terminalRef.current.updateFontSize(newSize)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(activeTerminal.id, { fontSize: newSize })
  }

  const handleResetToDefaults = () => {
    if (!activeTerminal || !terminalRef.current) return

    // Find the spawn option for this terminal
    // First try to match by label (exact match)
    let spawnOption = spawnOptions.find(opt => opt.label === activeTerminal.name)

    // Fallback: if no exact label match, try matching by terminalType + command
    if (!spawnOption && activeTerminal.command) {
      spawnOption = spawnOptions.find(opt =>
        opt.terminalType === activeTerminal.terminalType &&
        opt.command === activeTerminal.command
      )
    }

    // Last resort: just match by terminalType (but warn, as this might be wrong)
    if (!spawnOption) {
      spawnOption = spawnOptions.find(opt => opt.terminalType === activeTerminal.terminalType)
      if (spawnOption) {
        console.warn(`[SimpleTerminalApp] Could not find exact match for terminal "${activeTerminal.name}", using first ${activeTerminal.terminalType} option: ${spawnOption.label}`)
      }
    }

    if (!spawnOption) {
      console.warn('No spawn option found for terminal:', activeTerminal.name, activeTerminal.terminalType)
      return
    }

    // Reset to spawn option defaults
    const defaults = {
      theme: spawnOption.defaultTheme,
      background: spawnOption.defaultBackground || THEME_BACKGROUNDS[spawnOption.defaultTheme || 'default'] || 'dark-neutral',
      transparency: spawnOption.defaultTransparency,
      fontSize: spawnOption.defaultFontSize || useSettingsStore.getState().terminalDefaultFontSize,
      fontFamily: spawnOption.defaultFontFamily,
    }

    // Update terminal state
    updateTerminal(activeTerminal.id, defaults)

    // Apply to terminal component
    if (defaults.theme) terminalRef.current.updateTheme(defaults.theme)
    if (defaults.background) terminalRef.current.updateBackground(defaults.background)
    if (defaults.transparency !== undefined) terminalRef.current.updateOpacity(defaults.transparency / 100)
    if (defaults.fontSize) terminalRef.current.updateFontSize(defaults.fontSize)
    if (defaults.fontFamily) terminalRef.current.updateFontFamily(defaults.fontFamily)

    console.log(`[SimpleTerminalApp] Reset terminal "${activeTerminal.name}" to spawn-option defaults from "${spawnOption.label}"`, defaults)
  }

  const handleThemeChange = (theme: string) => {
    if (!activeTerminal || !terminalRef.current) return
    terminalRef.current.updateTheme(theme)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(activeTerminal.id, { theme })
    // Give theme change time to apply, then refit
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.refit()
      }
    }, 350)
  }

  const handleBackgroundChange = (background: string) => {
    if (!activeTerminal || !terminalRef.current) return
    terminalRef.current.updateBackground(background)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(activeTerminal.id, { background })
  }

  const handleTransparencyChange = (transparency: number) => {
    if (!activeTerminal || !terminalRef.current) return
    const opacity = transparency / 100
    terminalRef.current.updateOpacity(opacity)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(activeTerminal.id, { transparency })
  }

  const handleFontFamilyChange = (fontFamily: string) => {
    if (!activeTerminal || !terminalRef.current) return
    terminalRef.current.updateFontFamily(fontFamily)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(activeTerminal.id, { fontFamily })
  }

  // Compute dynamic background based on active terminal's background setting
  const appBackgroundStyle: React.CSSProperties = {
    background: activeTerminal?.background
      ? getBackgroundCSS(activeTerminal.background)
      : getBackgroundCSS('dark-neutral'),
    transition: 'background 0.5s ease-in-out',
  }

  // Auto-hide header after 10 seconds of inactivity
  const resetHeaderTimer = () => {
    setHeaderVisible(true)
    if (headerHideTimer.current) {
      clearTimeout(headerHideTimer.current)
    }
    // Don't auto-hide if settings or spawn menu is open
    if (!showSettings && !showSpawnMenu) {
      headerHideTimer.current = setTimeout(() => {
        setHeaderVisible(false)
      }, 10000) // 10 seconds
    }
  }

  // Click handler for header reveal handle
  const handleHeaderReveal = () => {
    resetHeaderTimer()
  }

  // Mouse hover on header to keep it visible
  const handleHeaderHover = () => {
    if (headerVisible) {
      resetHeaderTimer()
    }
  }

  // Touch gesture detection for mobile (swipe down from top)
  const touchStartY = useRef<number>(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY
    const deltaY = currentY - touchStartY.current

    // If swiping down from top 40px by more than 50px, show header
    if (touchStartY.current < 40 && deltaY > 50) {
      resetHeaderTimer()
    }
  }

  // Start the auto-hide timer on mount and when modals close
  useEffect(() => {
    resetHeaderTimer()
    return () => {
      if (headerHideTimer.current) {
        clearTimeout(headerHideTimer.current)
      }
    }
  }, [showSettings, showSpawnMenu])

  // Refit terminal when header visibility changes (gains/loses 47px of vertical space)
  useEffect(() => {
    if (terminalRef.current) {
      // Wait for CSS transition to complete (300ms) then refit
      const timer = setTimeout(() => {
        terminalRef.current?.refit()
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [headerVisible])

  return (
    <div
      className={`simple-terminal-app ${!headerVisible ? 'header-hidden' : ''}`}
      style={appBackgroundStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Header Reveal Handle - Shows when header is hidden */}
      {!headerVisible && (
        <div className="header-reveal-handle" onClick={handleHeaderReveal}>
          <div className="handle-icon">▼</div>
        </div>
      )}

      {/* Header - Auto-hides after 10s, reveals on click or mobile swipe */}
      <div
        className={`app-header ${headerVisible ? 'visible' : 'hidden'}`}
        onMouseEnter={handleHeaderHover}
        onMouseMove={handleHeaderHover}
      >
        <div className="app-title">Terminal Tabs</div>

        {/* Tmux Toggle */}
        <div className="tmux-toggle-container">
          <span className="tmux-toggle-label">tmux</span>
          <button
            className={`tmux-toggle ${useTmux ? 'active' : ''}`}
            onClick={() => updateSettings({ useTmux: !useTmux })}
            title={useTmux ? "Using tmux (persistent sessions)" : "Using raw PTY (no persistence)"}
          >
            <span className="tmux-toggle-slider"></span>
          </button>
        </div>

        <div className="header-actions">
          <button
            className="clear-sessions-button"
            onClick={handleClearAllSessions}
            title="Clear all sessions and localStorage"
          >
            🗑️
          </button>
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            {connectionStatus}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {storedTerminals.map(terminal => (
          <div
            key={terminal.id}
            className={`tab ${terminal.id === activeTerminalId ? 'active' : ''} ${terminal.status === 'spawning' ? 'spawning' : ''}`}
            onClick={() => setActiveTerminal(terminal.id)}
          >
            <span className="tab-icon">
              {terminal.status === 'spawning' ? '⏳' : (terminal.icon || TERMINAL_TYPES.find(t => t.value === terminal.terminalType)?.icon || '💻')}
            </span>
            <span className="tab-label">{terminal.name}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                handleCloseTerminal(terminal.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="tab-add"
          onClick={() => setShowSpawnMenu(!showSpawnMenu)}
        >
          +
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={() => loadSpawnOptions()}
      />

      {/* Spawn Menu */}
      {showSpawnMenu && (
        <div className="spawn-menu">
          <div className="spawn-menu-header">
            <span>Spawn Terminal</span>
            <button onClick={() => setShowSpawnMenu(false)}>✕</button>
          </div>
          <div className="spawn-menu-list">
            {spawnOptions.map((option, idx) => (
              <div
                key={idx}
                className="spawn-option"
                onClick={() => handleSpawnTerminal(option)}
              >
                <span className="spawn-icon">{option.icon}</span>
                <div className="spawn-info">
                  <div className="spawn-label">{option.label}</div>
                  <div className="spawn-description">{option.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal Display */}
      <div className="terminal-display">
        {storedTerminals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📟</div>
            <div className="empty-text">No terminals open</div>
            <button className="spawn-button" onClick={() => setShowSpawnMenu(true)}>
              Spawn Terminal
            </button>
          </div>
        ) : (
          <>
            {/* Render ALL terminals, but hide inactive ones with CSS */}
            {storedTerminals.map((terminal) => {
              const agent = agents.find(a => a.id === terminal.agentId)

              // Don't render Terminal component until status is 'active' and agent exists
              if (!agent || terminal.status !== 'active') {
                return terminal.id === activeTerminalId ? (
                  <div key={terminal.id} className="loading-state">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">
                      {terminal.status === 'spawning' ? 'Connecting to terminal...' :
                       terminal.status === 'error' ? 'Failed to connect' :
                       'Loading...'}
                    </div>
                  </div>
                ) : null
              }

              return (
                <div
                  key={terminal.id}
                  style={{
                    // Use absolute positioning instead of display:none
                    // This allows xterm.js to initialize properly with non-zero dimensions
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    visibility: terminal.id === activeTerminalId ? 'visible' : 'hidden',
                    zIndex: terminal.id === activeTerminalId ? 1 : 0,
                  }}
                  className="terminal-wrapper"
                >
                  <Terminal
                    key={`term-${terminal.id}`}
                    ref={terminal.id === activeTerminalId ? terminalRef : null}
                    agent={agent}
                    onClose={() => handleCloseTerminal(terminal.id)}
                    onCommand={(cmd) => handleCommand(cmd, terminal.id)}
                    wsRef={wsRef}
                    embedded={true}
                    initialTheme={terminal.theme}
                    initialBackground={terminal.background || THEME_BACKGROUNDS[terminal.theme || 'default'] || 'dark-neutral'}
                    initialOpacity={terminal.transparency !== undefined ? terminal.transparency / 100 : 1}
                    initialFontSize={terminal.fontSize}
                    initialFontFamily={terminal.fontFamily}
                    isSelected={terminal.id === activeTerminalId}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* App Footer - Shows active terminal info and controls */}
      {activeTerminal && activeAgent && (
        <div className="app-footer">
          <div className="footer-terminal-info">
            <span className="footer-terminal-icon">
              {activeTerminal.icon || '💻'}
            </span>
            <span className="footer-terminal-name">{activeAgent.name}</span>
            <span className="footer-terminal-type">({activeAgent.terminalType})</span>
            {activeAgent.pid && (
              <span className="footer-terminal-pid">PID: {activeAgent.pid}</span>
            )}
          </div>

          <div className="footer-controls">
            {/* Font Size Controls */}
            <button
              className="footer-control-btn"
              onClick={() => handleFontSizeChange(-1)}
              title="Decrease font size"
              disabled={!activeTerminal.fontSize || activeTerminal.fontSize <= 10}
            >
              −
            </button>
            <span className="font-size-display">{activeTerminal.fontSize || useSettingsStore.getState().terminalDefaultFontSize}px</span>
            <button
              className="footer-control-btn"
              onClick={() => handleFontSizeChange(1)}
              title="Increase font size"
              disabled={!!activeTerminal.fontSize && activeTerminal.fontSize >= 24}
            >
              +
            </button>

            {/* Reset to Defaults Button */}
            <button
              className="footer-control-btn"
              onClick={handleResetToDefaults}
              title="Reset to spawn-option defaults (theme, font, transparency)"
            >
              ↺
            </button>

            {/* Customize Panel Toggle */}
            <button
              className="footer-control-btn"
              onClick={() => setShowCustomizePanel(!showCustomizePanel)}
              title="Customize theme, transparency, font"
            >
              🎨
            </button>
          </div>
        </div>
      )}

      {/* Floating Customize Modal */}
      {showCustomizePanel && activeTerminal && (
        <div className="customize-modal">
            <div className="customize-modal-header">
              <h3>🎨 Customize Terminal</h3>
              <button
                className="customize-close-btn"
                onClick={() => setShowCustomizePanel(false)}
              >
                ✕
              </button>
            </div>

            <div className="customize-modal-body">
              <label>
                Text Color Theme
                <select
                  value={activeTerminal.theme || 'default'}
                  onChange={(e) => handleThemeChange(e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="amber">Amber</option>
                  <option value="matrix">Matrix Green</option>
                  <option value="dracula">Dracula</option>
                  <option value="monokai">Monokai</option>
                  <option value="solarized-dark">Solarized Dark</option>
                  <option value="github-dark">GitHub Dark</option>
                  <option value="cyberpunk">Cyberpunk Neon</option>
                  <option value="holographic">Holographic</option>
                  <option value="vaporwave">Vaporwave</option>
                  <option value="retro">Retro Amber</option>
                  <option value="synthwave">Synthwave</option>
                  <option value="aurora">Aurora Borealis</option>
                </select>
              </label>

              <label>
                Background Gradient
                <select
                  value={activeTerminal.background || 'dark-neutral'}
                  onChange={(e) => handleBackgroundChange(e.target.value)}
                >
                  {Object.entries(backgroundGradients).map(([key, bg]) => (
                    <option key={key} value={key}>
                      {bg.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Transparency: {activeTerminal.transparency || 100}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeTerminal.transparency || 100}
                  onChange={(e) => handleTransparencyChange(parseInt(e.target.value))}
                />
              </label>

              <label>
                Font Family
                <select
                  value={activeTerminal.fontFamily || 'monospace'}
                  onChange={(e) => handleFontFamilyChange(e.target.value)}
                >
                  <option value="monospace">Monospace (Default)</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  <option value="'Fira Code', monospace">Fira Code</option>
                  <option value="'Source Code Pro', monospace">Source Code Pro</option>
                  <option value="'Menlo', monospace">Menlo</option>
                  <option value="'Consolas', monospace">Consolas</option>
                  <option value="'Monaco', monospace">Monaco</option>
                </select>
              </label>
            </div>
          </div>
      )}
    </div>
  )
}

export default SimpleTerminalApp
