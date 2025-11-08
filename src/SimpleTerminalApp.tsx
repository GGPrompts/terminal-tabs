import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { SettingsModal } from './components/SettingsModal'
import { Agent, TERMINAL_TYPES } from './types'
import { useSimpleTerminalStore, Terminal as StoredTerminal } from './stores/simpleTerminalStore'
import SimpleSpawnService from './services/SimpleSpawnService'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  defaultTheme?: string
  defaultTransparency?: number
}

function SimpleTerminalApp() {
  const [webSocketAgents, setWebSocketAgents] = useState<Agent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [showSpawnMenu, setShowSpawnMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const wsRef = useRef<WebSocket | null>(null)
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
    fetch('/spawn-options.json')
      .then(res => res.json())
      .then(data => {
        if (data.spawnOptions) {
          setSpawnOptions(data.spawnOptions)
        }
      })
      .catch(err => console.error('Failed to load spawn options:', err))
  }

  useEffect(() => {
    loadSpawnOptions()
  }, [])

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

      // Clear any stale terminals from localStorage on fresh connection
      // These are terminals from previous sessions that no longer exist on backend
      if (storedTerminals.length > 0) {
        clearAllTerminals()
      }
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
    }
  }

  const handleSpawnTerminal = async (option: SpawnOption) => {
    setShowSpawnMenu(false)

    try {
      // Generate requestId FIRST
      const requestId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Create placeholder terminal IMMEDIATELY (before spawn)
      const newTerminal: StoredTerminal = {
        id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: option.label,
        terminalType: option.terminalType,
        icon: option.icon,
        workingDir: option.workingDir || '~',
        theme: option.defaultTheme,
        transparency: option.defaultTransparency,
        createdAt: Date.now(),
        status: 'spawning',
        requestId, // Store requestId for matching with WebSocket response
      }

      // Store in ref FIRST (synchronous, no race condition)
      pendingSpawns.current.set(requestId, newTerminal)

      // Then add to state (async)
      addTerminal(newTerminal)
      console.log('[SimpleTerminalApp] Created placeholder terminal with requestId:', requestId)

      // Build config
      const config: any = {
        terminalType: option.terminalType,
        name: option.label,
        workingDir: option.workingDir || '~',
        theme: option.defaultTheme,
        transparency: option.defaultTransparency,
        size: { width: 800, height: 600 },
      }

      // Convert command to commands array (like opustrator)
      // TUI tools use toolName, others use commands array
      if (option.terminalType === 'tui-tool') {
        config.toolName = option.command
      } else if (option.command) {
        config.commands = [option.command]
        config.startCommand = option.command  // For reconnection
      }

      console.log('[SimpleTerminalApp] Spawning with config:', config)

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

  return (
    <div className="simple-terminal-app">
      {/* Header */}
      <div className="app-header">
        <div className="app-title">Terminal Tabs</div>
        <div className="header-actions">
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
        ) : activeAgent ? (
          <Terminal
            agent={activeAgent}
            onClose={() => handleCloseTerminal(activeTerminal!.id)}
            onCommand={(cmd) => handleCommand(cmd, activeTerminal!.id)}
            wsRef={wsRef}
            embedded={true}
          />
        ) : (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div className="loading-text">Connecting to terminal...</div>
          </div>
        )}
      </div>

      {/* App Footer - Shows active terminal info */}
      {activeTerminal && activeAgent && (
        <div className="app-footer">
          <div className="footer-terminal-info">
            <span className="footer-terminal-icon">
              {terminalInfo?.icon || '💻'}
            </span>
            <span className="footer-terminal-name">{activeAgent.name}</span>
            <span className="footer-terminal-type">({activeAgent.terminalType})</span>
            {activeAgent.pid && (
              <span className="footer-terminal-pid">PID: {activeAgent.pid}</span>
            )}
          </div>
          <div className="footer-actions">
            <button
              className="footer-action-btn footer-close"
              onClick={() => handleCloseTerminal(activeTerminal.id)}
              title="Close terminal"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SimpleTerminalApp
