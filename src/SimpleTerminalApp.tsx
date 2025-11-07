import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { Agent, TERMINAL_TYPES } from './App'
import { useSimpleTerminalStore, Terminal as StoredTerminal } from './stores/simpleTerminalStore'
import UnifiedSpawnService from './services/UnifiedSpawnService'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  defaultSize?: { width: number; height: number }
  defaultTheme?: string
  defaultTransparency?: number
}

function SimpleTerminalApp() {
  const [webSocketAgents, setWebSocketAgents] = useState<Agent[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [showSpawnMenu, setShowSpawnMenu] = useState(false)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const processedAgentIds = useRef<Set<string>>(new Set())

  const {
    terminals: storedTerminals,
    activeTerminalId,
    addTerminal,
    removeTerminal,
    updateTerminal,
    setActiveTerminal,
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

  // Load spawn options
  useEffect(() => {
    // TEMPORARY: Clear localStorage on mount for fresh start
    localStorage.clear()
    console.log('🧹 Cleared localStorage for fresh start')

    console.log('📋 Loading spawn options...')
    fetch('/spawn-options.json')
      .then(res => res.json())
      .then(data => {
        if (data.spawnOptions) {
          console.log('✅ Loaded', data.spawnOptions.length, 'spawn options:', data.spawnOptions)
          setSpawnOptions(data.spawnOptions)
        }
      })
      .catch(err => console.error('❌ Failed to load spawn options:', err))
  }, [])

  // Initialize WebSocket
  useEffect(() => {
    UnifiedSpawnService.initialize(wsRef)
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
    console.log('📨 WS Message received:', message.type, message)
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

          // Check if this agent already has a stored terminal
          const existingTerminal = storedTerminals.find(t => t.agentId === message.data.id)
          if (!existingTerminal) {
            // Create new stored terminal
            const newTerminal: StoredTerminal = {
              id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: message.data.name || message.data.terminalType,
              terminalType: message.data.terminalType,
              agentId: message.data.id,
              workingDir: message.data.workingDir,
              sessionName: message.data.sessionName,
              createdAt: Date.now(),
              status: 'active',
            }
            addTerminal(newTerminal)
          } else {
            // Update existing terminal
            updateTerminal(existingTerminal.id, {
              agentId: message.data.id,
              status: 'active',
            })
          }
        }
        break

      case 'terminal-output':
        if (message.terminalId && message.data) {
          console.log('📤 Dispatching terminal-output event:', {
            terminalId: message.terminalId,
            dataLength: message.data.length,
            activeAgent: activeAgent?.id,
          })
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
    console.log('🚀 handleSpawnTerminal called with:', option)
    setShowSpawnMenu(false)

    try {
      const config = {
        terminalType: option.terminalType,
        name: option.label,
        workingDir: '/home/matt',  // Default working directory
        theme: option.defaultTheme,
        transparency: option.defaultTransparency,
        size: option.defaultSize || { width: 800, height: 600 },
      }

      // UnifiedSpawnService.spawn() returns Promise<string | null> (terminal ID)
      const terminalId = await UnifiedSpawnService.spawn({ config })

      if (terminalId) {
        console.log('✅ Terminal spawned successfully:', terminalId)
      } else {
        console.error('❌ Failed to spawn terminal')
      }
    } catch (error) {
      console.error('❌ Error spawning terminal:', error)
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

  return (
    <div className="simple-terminal-app">
      {/* Header */}
      <div className="app-header">
        <div className="app-title">Terminal Tabs</div>
        <div className="header-actions">
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
            className={`tab ${terminal.id === activeTerminalId ? 'active' : ''}`}
            onClick={() => setActiveTerminal(terminal.id)}
          >
            <span className="tab-icon">
              {TERMINAL_TYPES.find(t => t.value === terminal.terminalType)?.icon || '💻'}
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
            embedded={false}
          />
        ) : (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div className="loading-text">Connecting to terminal...</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SimpleTerminalApp
