import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { SplitLayout } from './components/SplitLayout'
import { SettingsModal } from './components/SettingsModal'
import { Agent, TERMINAL_TYPES } from './types'
import { useSimpleTerminalStore, Terminal as StoredTerminal } from './stores/simpleTerminalStore'
import { useSettingsStore } from './stores/useSettingsStore'
import SimpleSpawnService from './services/SimpleSpawnService'
import { backgroundGradients, getBackgroundCSS } from './styles/terminal-backgrounds'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

// Drop zone type
type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center' | null

// SortableTab component - makes each tab draggable with drop zones
interface SortableTabProps {
  terminal: StoredTerminal
  isActive: boolean
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
  dropZone: DropZone
  isDraggedOver: boolean
  mousePosition: React.MutableRefObject<{ x: number; y: number }>
}

function SortableTab({ terminal, isActive, onActivate, onClose, dropZone, isDraggedOver, mousePosition }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: terminal.id,
    // Disable layout animations to prevent tabs from shifting during drag
    animateLayoutChanges: () => false,
  })

  const style = {
    // ONLY show transform for the item being dragged
    // Other tabs stay completely static (no shifting)
    transform: isDragging ? CSS.Transform.toString(transform) : undefined,
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Helper to get all terminals in the store (we'll pass this as a prop later)
  const { terminals: allTerminals } = useSimpleTerminalStore()

  // Check if this tab has splits (can't merge into it via any edge)
  const hasSplits = terminal.splitLayout && terminal.splitLayout.type !== 'single'

  // Determine if we're in an edge zone or center zone for visual feedback
  const [isEdgeZone, setIsEdgeZone] = React.useState(false)
  React.useEffect(() => {
    if (isDraggedOver && dropZone) {
      const tabElement = document.querySelector(`[data-tab-id="${terminal.id}"]`)
      if (tabElement) {
        const rect = tabElement.getBoundingClientRect()
        // Use current mouse position from parent
        const xPercent = (mousePosition.current.x - rect.left) / rect.width
        const yPercent = (mousePosition.current.y - rect.top) / rect.height
        const edgeThreshold = 0.20

        const inEdge =
          yPercent < edgeThreshold ||
          yPercent > 1 - edgeThreshold ||
          xPercent < edgeThreshold ||
          xPercent > 1 - edgeThreshold

        setIsEdgeZone(inEdge)
      }
    }
  }, [isDraggedOver, dropZone, terminal.id])

  // Show blocked overlay when trying to use ANY edge zone on a split tab
  const isBlocked = isDraggedOver && hasSplits && isEdgeZone

  // Render split icon with arrow indicator
  const renderTabIcon = () => {
    if (terminal.status === 'spawning') {
      return <span className="tab-icon-single">⏳</span>
    }

    // Check if this is a split terminal
    if (terminal.splitLayout && terminal.splitLayout.type !== 'single' && terminal.splitLayout.panes.length > 0) {
      const isVertical = terminal.splitLayout.type === 'vertical'
      const splitArrow = isVertical ? '↔' : '↕'

      // Get icons from both panes
      const paneIcons = terminal.splitLayout.panes.map(pane => {
        const paneTerminal = allTerminals.find(t => t.id === pane.terminalId)
        return paneTerminal?.icon || '💻'
      })

      return (
        <span className="tab-icon-split">
          <span className="split-arrow">{splitArrow}</span>
          {paneIcons.map((icon, idx) => (
            <span key={idx} className="split-emoji">{icon}</span>
          ))}
        </span>
      )
    }

    // Regular single terminal
    return (
      <span className="tab-icon-single">
        {terminal.icon || TERMINAL_TYPES.find(t => t.value === terminal.terminalType)?.icon || '💻'}
      </span>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-tab-id={terminal.id}
      className={`tab ${isActive ? 'active' : ''} ${terminal.status === 'spawning' ? 'spawning' : ''} ${isDraggedOver ? 'drag-over' : ''} ${isBlocked ? 'merge-blocked' : ''}`}
      onClick={onActivate}
      {...attributes}
      {...listeners}
    >
      {renderTabIcon()}
      <span className="tab-label">{terminal.name}</span>
      <button
        className="tab-close"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ✕
      </button>

      {/* Drop Zone Overlay - shows when dragging over this tab */}
      {isDraggedOver && dropZone && !isBlocked && (
        <div className={`drop-zone-overlay ${!isEdgeZone ? 'center-reorder' : ''}`}>
          {isEdgeZone && (
            <>
              {dropZone === 'left' && <div className="drop-zone-left"></div>}
              {dropZone === 'right' && <div className="drop-zone-right"></div>}
              {dropZone === 'top' && <div className="drop-zone-top"></div>}
              {dropZone === 'bottom' && <div className="drop-zone-bottom"></div>}
            </>
          )}
        </div>
      )}

      {/* Blocked Overlay - shows when trying to split into a split tab */}
      {isBlocked && (
        <div className="merge-blocked-overlay">
          <div className="blocked-icon">🚫</div>
          <div className="blocked-text">Can't split into split tab<br/>(Use center to reorder)</div>
        </div>
      )}
    </div>
  )
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

  // Drag-and-drop state for drop zones
  const [draggedTerminalId, setDraggedTerminalId] = useState<string | null>(null)
  const [dropZoneState, setDropZoneState] = useState<{ terminalId: string; zone: DropZone } | null>(null)
  const mousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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
    focusedTerminalId,
    addTerminal,
    removeTerminal,
    updateTerminal,
    setActiveTerminal,
    clearAllTerminals,
    reorderTerminals,
    setFocusedTerminal,
  } = useSimpleTerminalStore()

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (allows clicks to work)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Use pointer-only collision detection (no sortable auto-reordering)
  // We handle reordering manually in handleDragEnd
  const customCollisionDetection = pointerWithin

  // Filter out hidden terminals (those that are part of splits)
  const visibleTerminals = useMemo(() => {
    return storedTerminals.filter(t => !t.isHidden)
  }, [storedTerminals])

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

  // Expose store to window for testing (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).terminalStore = useSimpleTerminalStore;
      console.log('[Dev] Terminal store exposed to window.terminalStore');
    }
  }, []);

  // Track mouse position for drop zone detection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosition.current = { x: e.clientX, y: e.clientY }

      // If dragging, continuously update drop zone
      if (draggedTerminalId && dropZoneState) {
        const zone = detectDropZone(dropZoneState.terminalId)

        // PREVENT MERGE INTO EXISTING SPLITS: Block edge zones (splits) if target has splits
        const targetTerminal = storedTerminals.find(t => t.id === dropZoneState.terminalId)
        if (targetTerminal?.splitLayout && targetTerminal.splitLayout.type !== 'single') {
          // Check if we're in an edge zone (trying to split)
          const tabElement = document.querySelector(`[data-tab-id="${dropZoneState.terminalId}"]`)
          if (tabElement) {
            const rect = tabElement.getBoundingClientRect()
            const xPercent = (mousePosition.current.x - rect.left) / rect.width
            const yPercent = (mousePosition.current.y - rect.top) / rect.height
            const edgeThreshold = 0.20

            const isEdgeZone =
              yPercent < edgeThreshold ||
              yPercent > 1 - edgeThreshold ||
              xPercent < edgeThreshold ||
              xPercent > 1 - edgeThreshold

            if (isEdgeZone) {
              // In edge zone trying to split - don't update zone
              return
            }
          }
        }

        // Only update if zone actually changed (avoid unnecessary re-renders)
        if (zone !== dropZoneState.zone) {
          setDropZoneState({ terminalId: dropZoneState.terminalId, zone })
        }
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [draggedTerminalId, dropZoneState, storedTerminals])

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
        if (visibleTerminals.length > 0) {
          const currentIndex = visibleTerminals.findIndex(t => t.id === activeTerminalId)
          const nextIndex = (currentIndex + 1) % visibleTerminals.length
          setActiveTerminal(visibleTerminals[nextIndex].id)
        }
        return
      }

      // Ctrl+Shift+Tab - Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (visibleTerminals.length > 0) {
          const currentIndex = visibleTerminals.findIndex(t => t.id === activeTerminalId)
          const prevIndex = currentIndex <= 0 ? visibleTerminals.length - 1 : currentIndex - 1
          setActiveTerminal(visibleTerminals[prevIndex].id)
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
        if (tabIndex < visibleTerminals.length) {
          setActiveTerminal(visibleTerminals[tabIndex].id)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSpawnMenu, activeTerminalId, visibleTerminals, spawnOptions])

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

      // CRITICAL FIX: Clear old agents when disconnecting
      // This prevents frontend from trying to send messages to old backend IDs
      setWebSocketAgents([])
      processedAgentIds.current.clear()

      // Also clear agentIds from all terminals (will be re-assigned on reconnect)
      storedTerminals.forEach(terminal => {
        if (terminal.agentId || terminal.status === 'active') {
          updateTerminal(terminal.id, {
            agentId: undefined,
            status: 'spawning', // Will be updated to 'active' after reconnection
          })
        }
      })

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

            // Log if this is a split-related terminal
            if (existingTerminal.splitLayout && existingTerminal.splitLayout.type !== 'single') {
              console.log('[SimpleTerminalApp] ✅ Split container agent connected:', message.data.id)
            }
            if (existingTerminal.isHidden) {
              console.log('[SimpleTerminalApp] ✅ Hidden terminal agent connected:', message.data.id)
            }

            // Clear from pending spawns ref
            if (message.requestId) {
              pendingSpawns.current.delete(message.requestId)
              console.log('[SimpleTerminalApp] Cleared from pendingSpawns ref')
            }

            // Update existing terminal with agent info - PRESERVE splitLayout and isHidden
            updateTerminal(existingTerminal.id, {
              agentId: message.data.id,
              sessionName: message.data.sessionName,
              status: 'active',
              requestId: undefined, // Clear requestId after matching
              // Explicitly preserve split-related properties
              splitLayout: existingTerminal.splitLayout,
              isHidden: existingTerminal.isHidden,
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

          // Find terminal with this agentId
          const terminal = storedTerminals.find(t => t.agentId === message.data.id)
          if (terminal) {
            console.log(`[SimpleTerminalApp] Terminal exited: ${terminal.name}`)

            // If this is a hidden terminal (part of a split), handle specially
            if (terminal.isHidden) {
              console.log(`[SimpleTerminalApp] Exited terminal is part of a split, removing from split`)
              // Find the split container that has this pane
              const splitContainer = storedTerminals.find(t =>
                t.splitLayout?.panes?.some(p => p.terminalId === terminal.id)
              )

              if (splitContainer && splitContainer.splitLayout) {
                const remainingPanes = splitContainer.splitLayout.panes.filter(
                  p => p.terminalId !== terminal.id
                )

                if (remainingPanes.length === 1) {
                  // Only 1 pane left - convert to single terminal
                  console.log(`[SimpleTerminalApp] Only 1 pane remaining, converting to single terminal`)
                  updateTerminal(splitContainer.id, {
                    splitLayout: { type: 'single', panes: [] }
                  })
                  // Unhide the remaining pane
                  const remainingPaneTerminalId = remainingPanes[0].terminalId
                  updateTerminal(remainingPaneTerminalId, { isHidden: false })
                } else if (remainingPanes.length > 1) {
                  // Still have multiple panes
                  updateTerminal(splitContainer.id, {
                    splitLayout: {
                      ...splitContainer.splitLayout,
                      panes: remainingPanes
                    }
                  })
                }
              }
            }

            // Remove the terminal from store
            removeTerminal(terminal.id)
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
            terminalType: t.terminalType,
            isHidden: t.isHidden
          })))
          console.log('[SimpleTerminalApp] 📦 Spawn options loaded:', currentSpawnOptions.length)

          // Track which sessions we've already started reconnecting (prevent duplicates)
          const reconnectingSessionsSet = new Set<string>()

          // Process stored terminals
          storedTerminals.forEach(terminal => {
            if (terminal.sessionName && activeSessions.has(terminal.sessionName)) {
              // Skip if we're already reconnecting this session
              if (reconnectingSessionsSet.has(terminal.sessionName)) {
                console.log(`[SimpleTerminalApp] ⏭️ Skipping duplicate reconnection for session: ${terminal.sessionName}`)
                return
              }
              reconnectingSessionsSet.add(terminal.sessionName)
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

  // Generate short session name like "tt-cc-a3k" (Tabz - Claude Code - random suffix)
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
      // Log split layout preservation
      if (terminal.splitLayout && terminal.splitLayout.type !== 'single') {
        console.log(`[SimpleTerminalApp] 🔄 Reconnecting split container:`, terminal.id, {
          splitType: terminal.splitLayout.type,
          panes: terminal.splitLayout.panes.map(p => ({
            terminalId: p.terminalId,
            position: p.position
          }))
        })
      }

      if (terminal.isHidden) {
        console.log(`[SimpleTerminalApp] 🔄 Reconnecting hidden terminal (part of split):`, terminal.id)
      }

      // Generate requestId for reconnection
      const requestId = `reconnect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Create updated terminal object - PRESERVE splitLayout and isHidden!
      const updatedTerminal = {
        ...terminal,
        status: 'spawning' as const,
        requestId,
        agentId: undefined, // Clear old agentId (will get new one from backend)
        // splitLayout is preserved via spread operator
        // isHidden is preserved via spread operator
      }

      // Update terminal state - EXPLICITLY preserve splitLayout and isHidden
      updateTerminal(terminal.id, {
        status: 'spawning',
        requestId,
        agentId: undefined,
        // Explicitly preserve these critical properties
        splitLayout: terminal.splitLayout,
        isHidden: terminal.isHidden,
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
        fontFamily: terminal.fontFamily ?? option.defaultFontFamily ?? useSettingsStore.getState().terminalDefaultFontFamily ?? 'monospace',
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

  // Pop out pane to new tab (undo split)
  const handlePopOutPane = (paneTerminalId: string) => {
    // Find which split container has this pane
    const splitContainer = storedTerminals.find(t =>
      t.splitLayout?.panes?.some(p => p.terminalId === paneTerminalId)
    )

    if (!splitContainer || !splitContainer.splitLayout) {
      console.warn('[SimpleTerminalApp] No split container found for pane:', paneTerminalId)
      return
    }

    const paneTerminal = storedTerminals.find(t => t.id === paneTerminalId)
    if (!paneTerminal) {
      console.warn('[SimpleTerminalApp] Pane terminal not found:', paneTerminalId)
      return
    }

    console.log(`[SimpleTerminalApp] Popping out pane ${paneTerminalId} to new tab`)

    // Unhide the pane terminal (make it visible in tab bar)
    updateTerminal(paneTerminalId, { isHidden: false })

    // Remove pane from split
    const remainingPanes = splitContainer.splitLayout.panes.filter(
      p => p.terminalId !== paneTerminalId
    )

    if (remainingPanes.length === 1) {
      // Only 1 pane left - convert split container back to single terminal
      console.log(`[SimpleTerminalApp] Only 1 pane remaining, converting split to single terminal`)
      updateTerminal(splitContainer.id, {
        splitLayout: { type: 'single', panes: [] }
      })
      // Unhide the remaining pane
      const remainingPaneTerminalId = remainingPanes[0].terminalId
      updateTerminal(remainingPaneTerminalId, { isHidden: false })
    } else if (remainingPanes.length > 1) {
      // Still have multiple panes
      updateTerminal(splitContainer.id, {
        splitLayout: {
          ...splitContainer.splitLayout,
          panes: remainingPanes
        }
      })
    }

    // Set the popped-out terminal as active
    setActiveTerminal(paneTerminalId)

    console.log(`[SimpleTerminalApp] ✅ Popped out pane to new tab: ${paneTerminal.name}`)
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

    // Clear global settings including cached font size (tabz-settings)
    localStorage.removeItem('tabz-settings')

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

  // Detect drop zone based on actual mouse position over element
  // NEW MODEL: All 4 edges = split, center = reorder
  const detectDropZone = (overTabId: string): DropZone => {
    // Get the DOM element for the tab being hovered over
    const tabElement = document.querySelector(`[data-tab-id="${overTabId}"]`)
    if (!tabElement) return 'center'

    const rect = tabElement.getBoundingClientRect()
    const mouseX = mousePosition.current.x
    const mouseY = mousePosition.current.y

    // Calculate relative position within the tab
    const relativeX = mouseX - rect.left
    const relativeY = mouseY - rect.top

    // Calculate percentages (0-1)
    const xPercent = relativeX / rect.width
    const yPercent = relativeY / rect.height

    // Edge zones for SPLITS (20% on all sides)
    const edgeThreshold = 0.20

    // Check all 4 edges (priority: top/bottom first, then left/right)
    if (yPercent < edgeThreshold) return 'top'
    if (yPercent > 1 - edgeThreshold) return 'bottom'
    if (xPercent < edgeThreshold) return 'left'
    if (xPercent > 1 - edgeThreshold) return 'right'

    // Center area (60% x 60%) is for REORDERING
    // Left half of center vs right half of center
    return xPercent < 0.5 ? 'left' : 'right'
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedTerminalId(event.active.id as string)
  }

  // Handle drag over - update drop zone visual
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event

    if (!over || !draggedTerminalId) {
      setDropZoneState(null)
      return
    }

    // Don't show drop zone when dragging over self
    if (over.id === draggedTerminalId) {
      setDropZoneState(null)
      return
    }

    // PREVENT MERGE INTO EXISTING SPLITS: Block edge zones if target has splits
    const targetTerminal = storedTerminals.find(t => t.id === over.id)
    if (targetTerminal?.splitLayout && targetTerminal.splitLayout.type !== 'single') {
      const zone = detectDropZone(over.id as string)
      // Check if detected zone is in an edge (trying to split)
      const tabElement = document.querySelector(`[data-tab-id="${over.id}"]`)
      if (tabElement) {
        const rect = tabElement.getBoundingClientRect()
        const xPercent = (mousePosition.current.x - rect.left) / rect.width
        const yPercent = (mousePosition.current.y - rect.top) / rect.height
        const edgeThreshold = 0.20

        const isEdgeZone =
          yPercent < edgeThreshold ||
          yPercent > 1 - edgeThreshold ||
          xPercent < edgeThreshold ||
          xPercent > 1 - edgeThreshold

        if (isEdgeZone) {
          // In edge zone - don't allow (block split into split tab)
          // Force to center-left (default reorder position)
          setDropZoneState({ terminalId: over.id as string, zone: 'left' })
          return
        }
      }
    }

    const zone = detectDropZone(over.id as string)
    setDropZoneState({ terminalId: over.id as string, zone })
  }

  // Handle merge - create split layout
  const handleMerge = (sourceTabId: string, targetTabId: string, dropZone: DropZone) => {
    if (!dropZone || dropZone === 'center') {
      console.error('[SimpleTerminalApp] Invalid drop zone for merge:', dropZone)
      return
    }

    // PREVENT MERGE INTO EXISTING SPLITS: Check if target already has splits
    const targetTerminal = storedTerminals.find(t => t.id === targetTabId)
    if (targetTerminal?.splitLayout && targetTerminal.splitLayout.type !== 'single') {
      console.warn('[SimpleTerminalApp] Cannot merge into tab that already has splits:', targetTabId)
      console.log('[SimpleTerminalApp] 💡 Tip: Pop out panes to new tabs first, or drag to reorder tabs instead')
      return
    }

    const splitType = (dropZone === 'left' || dropZone === 'right') ? 'vertical' : 'horizontal'

    console.log(`[SimpleTerminalApp] Merging ${sourceTabId} into ${targetTabId} (${dropZone} → ${splitType} split)`)

    // Determine pane positions based on drop zone
    const sourcePosition = dropZone // Source goes where we dropped (left/right/top/bottom)
    const targetPosition =
      dropZone === 'left' ? 'right' :
      dropZone === 'right' ? 'left' :
      dropZone === 'top' ? 'bottom' : 'top'

    // Update target tab to have split layout
    updateTerminal(targetTabId, {
      splitLayout: {
        type: splitType,
        panes: [
          {
            id: `pane-${Date.now()}-1`,
            terminalId: targetTabId,
            size: 50,
            position: targetPosition,
          },
          {
            id: `pane-${Date.now()}-2`,
            terminalId: sourceTabId,
            size: 50,
            position: sourcePosition,
          },
        ],
      },
    })

    // Mark source terminal as hidden (part of split, don't show in tab bar)
    // DON'T remove it - the split layout needs it to exist!
    updateTerminal(sourceTabId, {
      isHidden: true,
    })

    setActiveTerminal(targetTabId)
    // Focus the newly merged terminal
    setFocusedTerminal(sourceTabId)

    console.log(`[SimpleTerminalApp] ✅ Created ${splitType} split: ${targetTabId} (${targetPosition}) + ${sourceTabId} (${sourcePosition})`)
  }

  // Handle drag end - reorder tabs or merge
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Save current drop zone state before clearing
    const currentDropZone = dropZoneState

    // Clear drag state
    setDraggedTerminalId(null)
    setDropZoneState(null)

    if (!over || active.id === over.id) {
      return
    }

    // NEW MODEL: All 4 edges = split, center (left/right halves) = reorder
    if (currentDropZone && currentDropZone.zone) {
      // Check if this is an edge zone (split) or center zone (reorder)
      const targetElement = document.querySelector(`[data-tab-id="${over.id}"]`)
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        const mouseX = mousePosition.current.x
        const mouseY = mousePosition.current.y
        const xPercent = (mouseX - rect.left) / rect.width
        const yPercent = (mouseY - rect.top) / rect.height
        const edgeThreshold = 0.20

        // Determine if we're in an edge zone or center zone
        const isEdgeZone =
          yPercent < edgeThreshold ||
          yPercent > 1 - edgeThreshold ||
          xPercent < edgeThreshold ||
          xPercent > 1 - edgeThreshold

        if (isEdgeZone) {
          // Edge zone = create split
          handleMerge(active.id as string, over.id as string, currentDropZone.zone)
          return
        } else {
          // Center zone = reorder tabs
          const oldIndex = visibleTerminals.findIndex(t => t.id === active.id)
          const newIndex = visibleTerminals.findIndex(t => t.id === over.id)

          if (oldIndex !== -1 && newIndex !== -1) {
            // If dropping on right half of center, insert AFTER the target
            const insertIndex = currentDropZone.zone === 'right' ? newIndex + 1 : newIndex

            // Create new order
            const reordered = [...visibleTerminals]
            const [removed] = reordered.splice(oldIndex, 1)
            // Adjust insert index if we removed an item before it
            const adjustedInsertIndex = oldIndex < insertIndex ? insertIndex - 1 : insertIndex
            reordered.splice(adjustedInsertIndex, 0, removed)

            // Preserve hidden terminals
            const hiddenTerminals = storedTerminals.filter(t => t.isHidden)
            const newOrder = [...reordered, ...hiddenTerminals]
            reorderTerminals(newOrder)
            console.log(`[SimpleTerminalApp] Reordered tabs: ${active.id} moved from ${oldIndex} to ${adjustedInsertIndex}`)
          }
          return
        }
      }
    }
  }

  // Determine which terminal to display in footer
  // If a pane in split is focused, use that; otherwise use active tab
  const displayTerminal = useMemo(() => {
    if (focusedTerminalId) {
      return storedTerminals.find(t => t.id === focusedTerminalId)
    }
    return storedTerminals.find(t => t.id === activeTerminalId)
  }, [focusedTerminalId, activeTerminalId, storedTerminals])

  const activeTerminal = storedTerminals.find(t => t.id === activeTerminalId)
  const displayAgent = displayTerminal?.agentId
    ? agents.find(a => a.id === displayTerminal.agentId)
    : null
  const terminalInfo = displayAgent
    ? TERMINAL_TYPES.find(t => t.value === displayAgent.terminalType)
    : null

  // Footer control handlers - Tab-specific customizations (persisted per-tab)
  // These changes are specific to the focused/active terminal and persist through refresh
  // New spawns always use defaults from spawn-options.json
  const handleFontSizeChange = (delta: number) => {
    if (!displayTerminal || !terminalRef.current) return
    const globalDefault = useSettingsStore.getState().terminalDefaultFontSize
    const currentSize = displayTerminal.fontSize || globalDefault
    const newSize = Math.max(10, Math.min(24, currentSize + delta))
    terminalRef.current.updateFontSize(newSize)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { fontSize: newSize })
  }

  const handleResetToDefaults = () => {
    if (!displayTerminal || !terminalRef.current) return

    // Find the spawn option for this terminal
    // First try to match by label (exact match)
    let spawnOption = spawnOptions.find(opt => opt.label === displayTerminal.name)

    // Fallback: if no exact label match, try matching by terminalType + command
    if (!spawnOption && displayTerminal.command) {
      spawnOption = spawnOptions.find(opt =>
        opt.terminalType === displayTerminal.terminalType &&
        opt.command === displayTerminal.command
      )
    }

    // Last resort: just match by terminalType (but warn, as this might be wrong)
    if (!spawnOption) {
      spawnOption = spawnOptions.find(opt => opt.terminalType === displayTerminal.terminalType)
      if (spawnOption) {
        console.warn(`[SimpleTerminalApp] Could not find exact match for terminal "${displayTerminal.name}", using first ${displayTerminal.terminalType} option: ${spawnOption.label}`)
      }
    }

    if (!spawnOption) {
      console.warn('No spawn option found for terminal:', displayTerminal.name, displayTerminal.terminalType)
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
    updateTerminal(displayTerminal.id, defaults)

    // Apply to terminal component
    if (defaults.theme) terminalRef.current.updateTheme(defaults.theme)
    if (defaults.background) terminalRef.current.updateBackground(defaults.background)
    if (defaults.transparency !== undefined) terminalRef.current.updateOpacity(defaults.transparency / 100)
    if (defaults.fontSize) terminalRef.current.updateFontSize(defaults.fontSize)
    if (defaults.fontFamily) terminalRef.current.updateFontFamily(defaults.fontFamily)

    console.log(`[SimpleTerminalApp] Reset terminal "${displayTerminal.name}" to spawn-option defaults from "${spawnOption.label}"`, defaults)
  }

  const handleThemeChange = (theme: string) => {
    if (!displayTerminal || !terminalRef.current) return
    terminalRef.current.updateTheme(theme)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { theme })
    // Give theme change time to apply, then refit
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.refit()
      }
    }, 350)
  }

  const handleBackgroundChange = (background: string) => {
    if (!displayTerminal || !terminalRef.current) return
    terminalRef.current.updateBackground(background)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { background })
    // No refit needed - background is a React layer, not xterm.js
  }

  const handleTransparencyChange = (transparency: number) => {
    if (!displayTerminal || !terminalRef.current) return
    const opacity = transparency / 100
    terminalRef.current.updateOpacity(opacity)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { transparency })
    // No refit needed - transparency is CSS opacity on React layer, not xterm.js
  }

  const handleFontFamilyChange = (fontFamily: string) => {
    if (!displayTerminal || !terminalRef.current) return
    terminalRef.current.updateFontFamily(fontFamily)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { fontFamily })
    // Refit after font family change (especially important for Claude Code/TUI apps)
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.refit()
      }
    }, 350)
  }

  // Compute dynamic background based on active terminal's background setting
  const appBackgroundStyle: React.CSSProperties = {
    background: activeTerminal?.background
      ? getBackgroundCSS(activeTerminal.background)
      : getBackgroundCSS('dark-neutral'),
    transition: 'background 0.5s ease-in-out',
  }

  // Click handler for header reveal handle
  const handleHeaderReveal = () => {
    setHeaderVisible(true)
  }

  // Toggle header visibility
  const toggleHeader = () => {
    setHeaderVisible(!headerVisible)
  }

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
    >
      {/* Header Reveal Handle - Shows when header is hidden */}
      {!headerVisible && (
        <div className="header-reveal-handle" onClick={handleHeaderReveal}>
          <div className="handle-icon">▼</div>
        </div>
      )}

      {/* Header */}
      <div
        className={`app-header ${headerVisible ? 'visible' : 'hidden'}`}
      >
        <div className="app-title">Tab<span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>&gt;_</span></div>

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
            onClick={toggleHeader}
            title="Hide header"
          >
            ⌃
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
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleTerminals.map(t => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="tab-bar">
            {visibleTerminals.map(terminal => {
              return (
                <SortableTab
                  key={terminal.id}
                  terminal={terminal}
                  isActive={terminal.id === activeTerminalId}
                  onActivate={() => setActiveTerminal(terminal.id)}
                  onClose={(e) => {
                    e.stopPropagation()
                    handleCloseTerminal(terminal.id)
                  }}
                  dropZone={dropZoneState?.terminalId === terminal.id ? dropZoneState.zone : null}
                  isDraggedOver={dropZoneState?.terminalId === terminal.id}
                  mousePosition={mousePosition}
                />
              )
            })}
            <button
              className="tab-add"
              onClick={() => setShowSpawnMenu(!showSpawnMenu)}
            >
              +
            </button>
          </div>
        </SortableContext>
      </DndContext>

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
        {visibleTerminals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📟</div>
            <div className="empty-text">No terminals open</div>
            <button className="spawn-button" onClick={() => setShowSpawnMenu(true)}>
              Spawn Terminal
            </button>
          </div>
        ) : (
          <>
            {/* Render ONLY visible terminals (hidden terminals are rendered inside SplitLayout as panes) */}
            {visibleTerminals.map((terminal) => {
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
                  <SplitLayout
                    terminal={terminal}
                    terminals={storedTerminals}
                    agents={webSocketAgents}
                    onClose={handleCloseTerminal}
                    onPopOut={handlePopOutPane}
                    onCommand={handleCommand}
                    wsRef={wsRef}
                    terminalRef={terminalRef}
                    activeTerminalId={activeTerminalId}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* App Footer - Shows focused/active terminal info and controls */}
      {displayTerminal && displayAgent && (
        <div className="app-footer">
          <div className="footer-terminal-info">
            <span className="footer-terminal-icon">
              {displayTerminal.icon || '💻'}
            </span>
            <span className="footer-terminal-name">{displayAgent.name}</span>
            <span className="footer-terminal-type">({displayAgent.terminalType})</span>
            {displayAgent.pid && (
              <span className="footer-terminal-pid">PID: {displayAgent.pid}</span>
            )}
          </div>

          <div className="footer-controls">
            {/* Font Size Controls */}
            <button
              className="footer-control-btn"
              onClick={() => handleFontSizeChange(-1)}
              title="Decrease font size"
              disabled={!displayTerminal.fontSize || displayTerminal.fontSize <= 10}
            >
              −
            </button>
            <span className="font-size-display">{displayTerminal.fontSize || useSettingsStore.getState().terminalDefaultFontSize}px</span>
            <button
              className="footer-control-btn"
              onClick={() => handleFontSizeChange(1)}
              title="Increase font size"
              disabled={!!displayTerminal.fontSize && displayTerminal.fontSize >= 24}
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

            {/* Tmux Controls - only show for tmux sessions */}
            {displayTerminal.sessionName && terminalRef.current && (
              <>
                <span style={{ marginLeft: '12px', marginRight: '6px', opacity: 0.6, fontSize: '0.85em' }}>
                  tmux:
                </span>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02%')}
                  title="Split Vertical (Ctrl+B %)"
                >
                  ⊞
                </button>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02"')}
                  title="Split Horizontal (Ctrl+B &quot;)"
                >
                  ⊟
                </button>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02z')}
                  title="Zoom Pane (Ctrl+B z)"
                >
                  🔍
                </button>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02c')}
                  title="New Window (Ctrl+B c)"
                >
                  ➕
                </button>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02p')}
                  title="Previous Window (Ctrl+B p)"
                >
                  ◀
                </button>
                <button
                  className="footer-control-btn"
                  onClick={() => terminalRef.current?.sendKeys('\x02n')}
                  title="Next Window (Ctrl+B n)"
                >
                  ▶
                </button>
              </>
            )}

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
      {showCustomizePanel && displayTerminal && (
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
                  value={displayTerminal.theme || 'default'}
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
                  value={displayTerminal.background || 'dark-neutral'}
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
                Transparency: {displayTerminal.transparency || 100}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={displayTerminal.transparency || 100}
                  onChange={(e) => handleTransparencyChange(parseInt(e.target.value))}
                />
              </label>

              <label>
                Font Family
                <select
                  value={displayTerminal.fontFamily || 'monospace'}
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
