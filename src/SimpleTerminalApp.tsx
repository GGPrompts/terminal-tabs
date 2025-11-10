import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { SplitLayout } from './components/SplitLayout'
import { SettingsModal } from './components/SettingsModal'
import { TabContextMenu } from './components/TabContextMenu'
import { FontFamilyDropdown } from './components/FontFamilyDropdown'
import { BackgroundGradientDropdown } from './components/BackgroundGradientDropdown'
import { TextColorThemeDropdown } from './components/TextColorThemeDropdown'
import { Agent, TERMINAL_TYPES } from './types'
import { useSimpleTerminalStore, Terminal as StoredTerminal } from './stores/simpleTerminalStore'
import { useSettingsStore } from './stores/useSettingsStore'
import SimpleSpawnService from './services/SimpleSpawnService'
import { backgroundGradients, getBackgroundCSS } from './styles/terminal-backgrounds'
import { THEME_BACKGROUNDS, TERMINAL_TYPE_ABBREVIATIONS, COMMAND_ABBREVIATIONS } from './constants/terminalConfig'
import { generateWindowId, getCurrentWindowId, updateUrlWithWindowId } from './utils/windowUtils'
import { refreshTerminalDisplay } from './utils/terminalRefresh'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useTerminalSpawning } from './hooks/useTerminalSpawning'
import { usePopout } from './hooks/usePopout'
import { useDragDrop } from './hooks/useDragDrop'
import { useWebSocketManager } from './hooks/useWebSocketManager'
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
  onContextMenu: (e: React.MouseEvent, terminalId: string) => void
  dropZone: DropZone
  isDraggedOver: boolean
  mousePosition: React.MutableRefObject<{ x: number; y: number }>
}

function SortableTab({ terminal, isActive, onActivate, onClose, onContextMenu, dropZone, isDraggedOver, mousePosition }: SortableTabProps) {
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

  // Update edge zone continuously during drag using requestAnimationFrame
  React.useEffect(() => {
    if (isDraggedOver && dropZone) {
      let rafId: number

      const updateEdgeZone = () => {
        const tabElement = document.querySelector(`[data-tab-id="${terminal.id}"]`)
        if (tabElement) {
          const rect = tabElement.getBoundingClientRect()
          // Use current mouse position from parent
          const xPercent = (mousePosition.current.x - rect.left) / rect.width
          const yPercent = (mousePosition.current.y - rect.top) / rect.height
          const edgeThreshold = 0.15

          const inEdge =
            yPercent < edgeThreshold ||
            yPercent > 1 - edgeThreshold ||
            xPercent < edgeThreshold ||
            xPercent > 1 - edgeThreshold

          setIsEdgeZone(inEdge)
        }

        // Continue updating while dragging
        if (isDraggedOver) {
          rafId = requestAnimationFrame(updateEdgeZone)
        }
      }

      rafId = requestAnimationFrame(updateEdgeZone)

      return () => {
        if (rafId) cancelAnimationFrame(rafId)
      }
    } else {
      // Clear edge zone when not being dragged over
      setIsEdgeZone(false)
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
      className={`tab ${isActive ? 'active' : ''} ${terminal.status === 'spawning' ? 'spawning' : ''} ${isDraggedOver ? 'drag-over' : ''} ${isBlocked ? 'merge-blocked' : ''} ${terminal.isDetached ? 'detached' : ''}`}
      onClick={onActivate}
      onContextMenu={(e) => onContextMenu(e, terminal.id)}
      {...attributes}
      {...listeners}
    >
      {renderTabIcon()}
      <span className="tab-label">{terminal.name}</span>

      {/* Only show buttons for non-detached tabs */}
      {!terminal.isDetached && (
        <>
          <button
            className="tab-close"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            title="Close terminal (kill session)"
          >
            ✕
          </button>
        </>
      )}

      {/* Drop Zone Overlay - shows when dragging over this tab for splits */}
      {isDraggedOver && dropZone && !isBlocked && isEdgeZone && (
        <div className="drop-zone-overlay">
          {dropZone === 'left' && <div className="drop-zone-left"></div>}
          {dropZone === 'right' && <div className="drop-zone-right"></div>}
          {dropZone === 'top' && <div className="drop-zone-top"></div>}
          {dropZone === 'bottom' && <div className="drop-zone-bottom"></div>}
        </div>
      )}

      {/* Reorder Indicator - vertical line showing insertion point for reordering */}
      {isDraggedOver && dropZone && !isBlocked && !isEdgeZone && (
        <div className={`reorder-indicator ${dropZone}`}></div>
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

function SimpleTerminalApp() {
  const [showSpawnMenu, setShowSpawnMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)

  // Settings
  const { useTmux, updateSettings } = useSettingsStore()
  const [showCustomizePanel, setShowCustomizePanel] = useState(false)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const spawnOptionsRef = useRef<SpawnOption[]>([]) // Ref to avoid closure issues

  // Spawn menu search and multi-select
  const [spawnSearchText, setSpawnSearchText] = useState('')
  const [selectedSpawnOptions, setSelectedSpawnOptions] = useState<Set<number>>(new Set())

  // Split mode state - tracks when creating a split from context menu
  const [splitMode, setSplitMode] = useState<{
    active: boolean
    direction?: 'vertical' | 'horizontal'
    terminalId?: string
    detectedCwd?: string
  }>({ active: false })

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean
    x: number
    y: number
    terminalId: string | null
  }>({
    show: false,
    x: 0,
    y: 0,
    terminalId: null,
  })
  const terminalRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null) // Needed by both spawning and WebSocket hooks
  const pendingSpawns = useRef<Map<string, StoredTerminal>>(new Map()) // Track pending spawns by requestId

  // Multi-window support: each browser window/tab has a unique ID
  const [currentWindowId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const windowId = getCurrentWindowId(urlParams)
    updateUrlWithWindowId(windowId)
    return windowId
  })

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

  // Filter terminals by current window ID
  // Each window only shows terminals that belong to it (or have no windowId yet = default to main window)
  const visibleTerminals = useMemo(() => {
    const filtered = storedTerminals.filter(t => {
      // Hidden terminals (split panes) are never visible in tab bar
      if (t.isHidden) return false

      // Detached terminals (windowId === null) appear in ALL windows
      if (t.isDetached && !t.windowId) return true

      // Terminals without a windowId belong to the main window (backwards compatibility)
      const terminalWindow = t.windowId || 'main'

      // Show only terminals that belong to this window
      return terminalWindow === currentWindowId
    })

    return filtered
  }, [storedTerminals, currentWindowId])

  // Drag-and-drop logic (extracted to custom hook)
  const {
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    customCollisionDetection,
    draggedTerminalId,
    dropZoneState,
    mousePosition
  } = useDragDrop(
    storedTerminals,
    visibleTerminals,
    updateTerminal,
    reorderTerminals,
    setActiveTerminal,
    setFocusedTerminal
  )

  // Expose store to window for testing (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).terminalStore = useSimpleTerminalStore;
      console.log('[Dev] Terminal store exposed to window.terminalStore');
    }
  }, []);

  // Set browser tab title based on window and active terminal
  useEffect(() => {
    if (currentWindowId === 'main') {
      document.title = 'Tabz'
    } else {
      // For popped-out windows, show active terminal name or window number
      const activeTerminal = storedTerminals.find(t => t.id === activeTerminalId)
      if (activeTerminal && visibleTerminals.length > 0) {
        document.title = `Tabz - ${activeTerminal.name}`
      } else {
        // Extract a simple number from window ID for clean display
        const windowMatch = currentWindowId.match(/window-(\d+)/)
        const windowNum = windowMatch ? Math.floor(parseInt(windowMatch[1]) / 1000000000) : '?'
        document.title = `Tabz ${windowNum}`
      }
    }
  }, [currentWindowId, activeTerminalId, storedTerminals, visibleTerminals.length])

  // Listen for storage events from other windows (trash button clears all)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Detect when terminals are cleared from another window
      if (e.key === 'simple-terminal-storage' && e.newValue) {
        try {
          const newState = JSON.parse(e.newValue)
          // If another window cleared all terminals, reload this window too
          if (newState.state?.terminals && newState.state.terminals.length === 0 && storedTerminals.length > 0) {
            console.log('[SimpleTerminalApp] 🗑️ Detected trash action from another window, reloading...')
            setTimeout(() => window.location.reload(), 500)
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [storedTerminals.length])

  // Check for ?active=xxx parameter to set initial active terminal (for popout windows)
  // CRITICAL: Watch full storedTerminals array, not just length, to catch windowId changes
  const activeFromUrlRef = useRef<string | null>(null)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const activeFromUrl = urlParams.get('active')

    // Only process if we have a URL param and haven't processed it yet
    if (!activeFromUrl || activeFromUrlRef.current === activeFromUrl) {
      return
    }

    console.log(`[SimpleTerminalApp] Setting active terminal from URL: ${activeFromUrl}`)

    // Find this terminal in our stored terminals
    const terminal = storedTerminals.find(t => t.id === activeFromUrl)
    if (terminal) {
      // Check if it belongs to this window
      const terminalWindow = terminal.windowId || 'main'
      if (terminalWindow === currentWindowId) {
        setActiveTerminal(activeFromUrl)
        activeFromUrlRef.current = activeFromUrl
        // Clean up URL parameter
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('active')
        window.history.replaceState({}, '', newUrl)
        console.log(`[SimpleTerminalApp] ✓ Activated terminal: ${terminal.name}`)
      } else {
        console.warn(`[SimpleTerminalApp] Terminal ${activeFromUrl} belongs to different window: ${terminalWindow}, current: ${currentWindowId}`)
      }
    } else {
      console.warn(`[SimpleTerminalApp] Terminal ${activeFromUrl} not found yet, waiting for localStorage sync...`)
    }
  }, [storedTerminals, currentWindowId]) // Re-run when terminals change (not just length!)

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

  // Terminal spawning logic (extracted to custom hook)
  const { handleSpawnTerminal: spawnTerminal, handleReconnectTerminal, generateSessionName } = useTerminalSpawning(
    currentWindowId,
    useTmux,
    wsRef,
    pendingSpawns
  )

  // WebSocket connection management (extracted to custom hook)
  // Must be called after useTerminalSpawning to use handleReconnectTerminal
  // CRITICAL: Pass wsRef so Terminal components can send input via same WebSocket!
  const { webSocketAgents, connectionStatus, setWebSocketAgents } = useWebSocketManager(
    currentWindowId,
    storedTerminals,
    activeTerminalId,
    spawnOptions,
    spawnOptionsRef,
    useTmux,
    pendingSpawns,
    wsRef, // CRITICAL: Share wsRef with hook so terminals can send input!
    updateTerminal,
    removeTerminal,
    setActiveTerminal,
    handleReconnectTerminal
  )

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

  // Wrapper to close spawn menu before spawning
  const handleSpawnTerminal = async (option: SpawnOption) => {
    setShowSpawnMenu(false)

    // If in split mode, inject detected cwd and create split after spawning
    if (splitMode.active && splitMode.terminalId && splitMode.direction) {
      const targetTerminal = storedTerminals.find(t => t.id === splitMode.terminalId)
      if (!targetTerminal) {
        console.error('[SimpleTerminalApp] Split target terminal not found')
        setSplitMode({ active: false })
        return
      }

      // Create modified option with detected cwd (if option doesn't already have one)
      const modifiedOption = {
        ...option,
        workingDir: option.workingDir || splitMode.detectedCwd
      }

      // Get current terminal count to identify the new terminal reliably
      const terminalCountBefore = useSimpleTerminalStore.getState().terminals.length

      // Spawn the terminal
      await spawnTerminal(modifiedOption)

      // The new terminal is added immediately to the store
      // Find it by comparing before/after counts
      setTimeout(() => {
        const currentTerminals = useSimpleTerminalStore.getState().terminals

        // Find the newly added terminal (should be the one that wasn't there before)
        const newTerminal = currentTerminals.find((t, idx) => idx >= terminalCountBefore)

        if (!newTerminal) {
          console.error('[SimpleTerminalApp] Could not find newly spawned terminal for split')
          setSplitMode({ active: false })
          return
        }

        if (splitMode.terminalId && splitMode.direction) {
          // Create the split layout (similar to handleMerge in useDragDrop.ts)
          const splitType = splitMode.direction
          const sourcePosition = splitMode.direction === 'vertical' ? 'right' : 'bottom'
          const targetPosition = splitMode.direction === 'vertical' ? 'left' : 'top'

          // CRITICAL: Keep the agentId and sessionName on the container!
          // The container won't reconnect (we skip it in useWebSocketManager), but it keeps
          // its agent alive so the first pane (which references the container) can find it
          updateTerminal(splitMode.terminalId, {
            splitLayout: {
              type: splitType,
              panes: [
                {
                  id: `pane-${Date.now()}-1`,
                  terminalId: splitMode.terminalId, // Reference container itself (it keeps its agent)
                  size: 50,
                  position: targetPosition,
                },
                {
                  id: `pane-${Date.now()}-2`,
                  terminalId: newTerminal.id,
                  size: 50,
                  position: sourcePosition,
                },
              ],
            },
            status: 'active', // Container is active (has split layout)
            // DON'T clear sessionName or agentId - keep them for the first pane to use
          })

          // Mark new terminal as hidden (part of split)
          updateTerminal(newTerminal.id, {
            isHidden: true,
          })

          // Keep focus on the parent terminal (the tab with the split layout)
          // This prevents showing a blank screen since the new terminal is hidden
          setActiveTerminal(splitMode.terminalId)
          // Focus the newly spawned terminal
          setFocusedTerminal(newTerminal.id)

          console.log(`[SimpleTerminalApp] Created ${splitType} split: ${splitMode.terminalId} (container keeps agent) with panes ${splitMode.terminalId} (${targetPosition}) + ${newTerminal.id} (${sourcePosition})`)
        }

        // Clear split mode
        setSplitMode({ active: false })
      }, 100)
    } else {
      // Normal spawn (not in split mode)
      await spawnTerminal(option)
    }
  }

  // Multi-window popout logic (extracted to custom hook)
  const { handlePopOutTab } = usePopout(
    currentWindowId,
    storedTerminals,
    activeTerminalId,
    visibleTerminals,
    useTmux,
    wsRef,
    updateTerminal,
    setActiveTerminal
  )

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

  const handleDetachTab = async (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (!terminal?.sessionName) {
      console.warn('[handleDetachTab] Terminal has no session, cannot detach')
      return
    }

    try {
      console.log(`⊟ Detaching terminal: ${terminal.name} (${terminal.sessionName})`)

      // Call backend to detach from tmux session
      const response = await fetch(`http://localhost:8127/api/tmux/detach/${terminal.sessionName}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to detach: ${response.statusText}`)
      }

      // Update terminal state: mark as detached, clear windowId to show in all windows
      updateTerminal(terminalId, {
        isDetached: true,
        windowId: null,  // null = show in all windows!
        lastActiveTime: Date.now(),
        lastAttachedWindowId: currentWindowId,
        agentId: undefined  // Clear WebSocket agent ID
      })

      // Close WebSocket agent if exists
      const agent = webSocketAgents.find(a => a.id === terminal.agentId)
      if (agent?.ws) {
        agent.ws.send(JSON.stringify({
          type: 'disconnect',
          id: terminal.agentId
        }))
      }

      // Remove agent from the array
      const updatedAgents = webSocketAgents.filter(a => a.id !== terminal.agentId)
      setWebSocketAgents(updatedAgents)

      // If this was the active tab, switch to another non-detached tab
      if (activeTerminalId === terminalId) {
        const nextTab = visibleTerminals.find(t => t.id !== terminalId && !t.isDetached)
        setActiveTerminal(nextTab?.id || null)
      }

      console.log(`✅ Detached terminal: ${terminal.name}`)
    } catch (error) {
      console.error('[handleDetachTab] Error detaching terminal:', error)
      alert(`Failed to detach terminal: ${error}`)
    }
  }

  const handleReattachTab = async (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (!terminal?.sessionName || !terminal.isDetached) {
      console.warn('[handleReattachTab] Terminal is not detached or has no session')
      return
    }

    console.log(`🔄 Reattaching terminal: ${terminal.name} (${terminal.sessionName})`)

    // Update terminal state FIRST: mark as active, assign to current window
    updateTerminal(terminalId, {
      isDetached: false,
      windowId: currentWindowId,
      status: 'spawning',  // Will be updated to 'active' after reconnection
      lastActiveTime: Date.now(),
      agentId: undefined,  // Clear old agent ID so it gets a fresh one
    })

    // Set as active tab
    setActiveTerminal(terminalId)

    // Wait for state update to propagate, then manually trigger reconnection
    // (popout works because new window triggers fresh query, but same window needs manual trigger)
    setTimeout(() => {
      // Find spawn option for this terminal type
      const option = terminal.command
        ? spawnOptions.find(opt => opt.command === terminal.command)
        : spawnOptions.find(opt => opt.terminalType === terminal.terminalType)

      if (option) {
        // Get updated terminal from store (has windowId set now)
        const updatedTerminal = useSimpleTerminalStore.getState().terminals.find(t => t.id === terminalId)
        if (updatedTerminal) {
          console.log(`🔄 Manually triggering reconnection for ${updatedTerminal.name}`)
          handleReconnectTerminal(updatedTerminal, option).catch(err => {
            console.error('[handleReattachTab] Reconnection failed:', err)
            // Revert on failure
            updateTerminal(terminalId, {
              isDetached: true,
              windowId: null,
              status: 'active'
            })
          })
        }
      } else {
        console.error('[handleReattachTab] No spawn option found for terminal type:', terminal.terminalType)
      }
    }, 100) // Small delay to ensure state update completes
  }

  const handleTabClick = (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)

    if (terminal?.isDetached) {
      // Detached tab clicked → reattach it
      handleReattachTab(terminalId)
    } else {
      // Normal tab clicked → set as active
      setActiveTerminal(terminalId)
    }
  }

  // Keyboard shortcuts (extracted to custom hook)
  // Must be called after handleSpawnTerminal and handleCloseTerminal are defined
  useKeyboardShortcuts(
    showSpawnMenu,
    activeTerminalId,
    visibleTerminals,
    spawnOptions,
    setShowSpawnMenu,
    setActiveTerminal,
    handleSpawnTerminal,
    handleCloseTerminal
  )

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

    // Close all active terminals via WebSocket (including hidden pane terminals from all windows)
    const allTerminalIds = new Set<string>()

    storedTerminals.forEach(terminal => {
      if (terminal.agentId) {
        allTerminalIds.add(terminal.agentId)
      }

      // Also collect pane terminals from splits
      if (terminal.splitLayout && terminal.splitLayout.panes.length > 0) {
        terminal.splitLayout.panes.forEach(pane => {
          const paneTerminal = storedTerminals.find(t => t.id === pane.terminalId)
          if (paneTerminal?.agentId) {
            allTerminalIds.add(paneTerminal.agentId)
          }
        })
      }
    })

    // Send close messages for all terminals
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      allTerminalIds.forEach(agentId => {
        wsRef.current!.send(JSON.stringify({
          type: 'close',
          terminalId: agentId,
        }))
      })
      console.log(`[SimpleTerminalApp] Sent close messages for ${allTerminalIds.size} terminals`)
    }

    // Wait a bit for close messages to be sent
    await new Promise(resolve => setTimeout(resolve, 300))

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

    // Close WebSocket connection gracefully
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Clear all terminals from store (will also clear localStorage via persist)
    clearAllTerminals()

    // Clear global settings including cached font size (tabz-settings)
    localStorage.removeItem('tabz-settings')

    console.log('[SimpleTerminalApp] ✅ All sessions and settings cleared')

    // Wait a bit more before reload to ensure everything is cleaned up
    await new Promise(resolve => setTimeout(resolve, 200))

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

  // Determine which terminal to display in footer
  // If a pane in split is focused, use that; otherwise use active tab
  const displayTerminal = useMemo(() => {
    if (focusedTerminalId) {
      return storedTerminals.find(t => t.id === focusedTerminalId)
    }
    return storedTerminals.find(t => t.id === activeTerminalId)
  }, [focusedTerminalId, activeTerminalId, storedTerminals])

  const activeTerminal = storedTerminals.find(t => t.id === activeTerminalId)

  // Check if the focused terminal is part of a split (find parent terminal with splitLayout)
  const parentSplitTerminal = useMemo(() => {
    if (!focusedTerminalId) return null
    return storedTerminals.find(t =>
      t.splitLayout &&
      t.splitLayout.type !== 'single' &&
      t.splitLayout.panes.some(p => p.terminalId === focusedTerminalId)
    )
  }, [focusedTerminalId, storedTerminals])

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

  const handleRefresh = () => {
    if (!displayTerminal || !terminalRef.current) return

    // Get xterm instance from the terminal ref
    const xtermInstance = terminalRef.current.getXtermInstance?.()
    if (!xtermInstance) {
      console.warn('[SimpleTerminalApp] Cannot refresh - no xterm instance')
      return
    }

    // Use the resize trick to force complete redraw (fixes stuck TUI tools)
    refreshTerminalDisplay(xtermInstance, wsRef.current, displayTerminal.agentId || '')
    console.log(`[SimpleTerminalApp] Refreshed terminal "${displayTerminal.name}"`)
  }

  const handleClosePane = (paneTerminalId: string) => {
    // Find the parent terminal (the one with splitLayout)
    const parentTerminal = storedTerminals.find(t =>
      t.splitLayout &&
      t.splitLayout.type !== 'single' &&
      t.splitLayout.panes.some(p => p.terminalId === paneTerminalId)
    )

    if (!parentTerminal || !parentTerminal.splitLayout || parentTerminal.splitLayout.type === 'single') {
      console.warn('[SimpleTerminalApp] Could not find parent terminal for pane:', paneTerminalId)
      return
    }

    const remainingPanes = parentTerminal.splitLayout.panes.filter(p => p.terminalId !== paneTerminalId)

    if (remainingPanes.length === 1) {
      // Only 1 pane left - convert to single terminal
      console.log('[SimpleTerminalApp] Only 1 pane remaining after close, converting to single terminal')
      updateTerminal(parentTerminal.id, {
        splitLayout: { type: 'single', panes: [] }
      })
      // Unhide the remaining pane
      const remainingPaneTerminalId = remainingPanes[0].terminalId
      updateTerminal(remainingPaneTerminalId, { isHidden: false })
    } else if (remainingPanes.length > 1) {
      // Still have multiple panes
      updateTerminal(parentTerminal.id, {
        splitLayout: {
          ...parentTerminal.splitLayout,
          panes: remainingPanes
        }
      })
    }

    // Close the pane's terminal (will trigger backend cleanup)
    handleCloseTerminal(paneTerminalId)
  }

  // Context Menu Handlers
  const handleTabContextMenu = (e: React.MouseEvent, terminalId: string) => {
    e.preventDefault()
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      terminalId,
    })
  }

  const handleContextMenuClose = () => {
    setContextMenu({ show: false, x: 0, y: 0, terminalId: null })
  }

  const handleSplitVertical = async () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal) return

    // Fetch current working directory
    let detectedCwd = '~'
    if (terminal.agentId) {
      try {
        console.log(`[SimpleTerminalApp] Fetching cwd for agentId: ${terminal.agentId}`)
        const response = await fetch(`/api/terminals/${terminal.agentId}/cwd`)
        const result = await response.json()
        console.log(`[SimpleTerminalApp] CWD API response:`, result)
        if (result.success && result.data && result.data.cwd) {
          detectedCwd = result.data.cwd
        }
      } catch (error) {
        console.warn('[SimpleTerminalApp] Failed to fetch cwd, using default:', error)
      }
    } else {
      console.warn('[SimpleTerminalApp] Terminal has no agentId, cannot fetch cwd')
    }

    // Set split mode and open spawn menu
    setSplitMode({
      active: true,
      direction: 'vertical',
      terminalId: contextMenu.terminalId,
      detectedCwd,
    })
    setSelectedSpawnOptions(new Set()) // Clear any multi-select state
    setShowSpawnMenu(true)
    handleContextMenuClose()
  }

  const handleSplitHorizontal = async () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal) return

    // Fetch current working directory
    let detectedCwd = '~'
    if (terminal.agentId) {
      try {
        console.log(`[SimpleTerminalApp] Fetching cwd for agentId: ${terminal.agentId}`)
        const response = await fetch(`/api/terminals/${terminal.agentId}/cwd`)
        const result = await response.json()
        console.log(`[SimpleTerminalApp] CWD API response:`, result)
        if (result.success && result.data && result.data.cwd) {
          detectedCwd = result.data.cwd
        }
      } catch (error) {
        console.warn('[SimpleTerminalApp] Failed to fetch cwd, using default:', error)
      }
    } else {
      console.warn('[SimpleTerminalApp] Terminal has no agentId, cannot fetch cwd')
    }

    // Set split mode and open spawn menu
    setSplitMode({
      active: true,
      direction: 'horizontal',
      terminalId: contextMenu.terminalId,
      detectedCwd,
    })
    setSelectedSpawnOptions(new Set()) // Clear any multi-select state
    setShowSpawnMenu(true)
    handleContextMenuClose()
  }

  const handleRenameTab = () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal) return

    const newName = prompt('Enter new tab name:', terminal.name)
    if (newName && newName.trim()) {
      updateTerminal(contextMenu.terminalId, { name: newName.trim() })
    }
  }

  const handleRefreshNameFromTmux = async () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal || !terminal.agentId) return

    // Find the agent to get session name
    const agent = agents.find(a => a.id === terminal.agentId)
    if (!agent?.sessionName) {
      alert('This terminal does not have a tmux session')
      return
    }

    try {
      // Fetch both pane title and Tabz metadata from tmux
      const [infoResponse, metadataResponse] = await Promise.all([
        fetch(`/api/tmux/sessions/${agent.sessionName}/info`),
        fetch(`/api/tmux/sessions/${agent.sessionName}/metadata`)
      ])

      const infoResult = await infoResponse.json()
      const metadataResult = await metadataResponse.json()

      if (!infoResult.success) {
        alert('Failed to fetch pane info from tmux')
        return
      }

      // Build update object with pane title + metadata (if available)
      const updates: Partial<Terminal> = {
        name: infoResult.data.paneTitle
      }

      // If session has Tabz metadata, restore it
      if (metadataResult.success && metadataResult.hasMetadata) {
        const metadata = metadataResult.data

        // Only update metadata fields if they exist in tmux
        if (metadata.terminalType) updates.terminalType = metadata.terminalType
        if (metadata.icon) updates.icon = metadata.icon
        if (metadata.command) updates.command = metadata.command
        if (metadata.theme) updates.theme = metadata.theme
        if (metadata.background) updates.background = metadata.background
        if (metadata.fontSize) updates.fontSize = metadata.fontSize

        // If metadata.name exists, prefer it over paneTitle
        if (metadata.name) updates.name = metadata.name

        console.log(`✅ Restored full metadata from tmux:`, metadata)
      } else {
        console.log(`ℹ️ No Tabz metadata found, updated name only`)
      }

      updateTerminal(contextMenu.terminalId, updates)
      console.log(`[SimpleTerminalApp] Updated terminal from tmux:`, updates)
    } catch (error) {
      console.error('[SimpleTerminalApp] Error fetching tmux info:', error)
      alert('Error fetching terminal info from tmux')
    }
  }

  const handleThemeChange = (theme: string) => {
    if (!displayTerminal || !terminalRef.current) {
      console.warn('[SimpleTerminalApp] handleThemeChange called but displayTerminal or terminalRef.current is null', { displayTerminal: displayTerminal?.id, hasRef: !!terminalRef.current })
      return
    }
    console.log('[SimpleTerminalApp] Changing theme to:', theme, 'for terminal:', displayTerminal.id)
    terminalRef.current.updateTheme(theme)
    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { theme })
    // Note: Theme refresh is handled by useTerminalTheme hook in Terminal.tsx
    // No tmux-level refresh needed - it would interfere with running applications
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
    if (!displayTerminal || !terminalRef.current) {
      console.warn('[SimpleTerminalApp] handleFontFamilyChange called but displayTerminal or terminalRef.current is null', {
        displayTerminal: displayTerminal?.id,
        hasRef: !!terminalRef.current,
        focusedTerminalId,
        activeTerminalId
      })
      return
    }
    console.log('[SimpleTerminalApp] ===== FONT FAMILY CHANGE =====')
    console.log('[SimpleTerminalApp] Changing font family to:', fontFamily)
    console.log('[SimpleTerminalApp] For terminal:', displayTerminal.id, displayTerminal.name)
    console.log('[SimpleTerminalApp] Session name:', displayTerminal.sessionName)
    console.log('[SimpleTerminalApp] terminalRef exists:', !!terminalRef.current)

    // Try to update font
    try {
      terminalRef.current.updateFontFamily(fontFamily)
      console.log('[SimpleTerminalApp] ✓ updateFontFamily called successfully')
    } catch (error) {
      console.error('[SimpleTerminalApp] ✗ Error calling updateFontFamily:', error)
    }

    // Save to this terminal's state (persisted in localStorage)
    updateTerminal(displayTerminal.id, { fontFamily })
    console.log('[SimpleTerminalApp] ✓ Saved to localStorage')
    // Note: Font refresh is handled by useTerminalFont hook in Terminal.tsx
    // No tmux-level refresh needed - it would interfere with running applications
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

        {/* Header Collapse Button - absolutely centered in header */}
        <button
          className="header-collapse-button"
          onClick={toggleHeader}
          title="Hide header"
        >
          ▲
        </button>
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
                    onActivate={() => handleTabClick(terminal.id)}
                    onClose={(e) => {
                      e.stopPropagation()
                      handleCloseTerminal(terminal.id)
                    }}
                    onContextMenu={handleTabContextMenu}
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
            <span>
              {splitMode.active && splitMode.terminalId
                ? `Split ${splitMode.direction === 'vertical' ? '→' : '↓'} (${
                    storedTerminals.find(t => t.id === splitMode.terminalId)?.name || 'Terminal'
                  })`
                : 'Spawn Terminal'
              }
            </span>
            <button onClick={() => {
              setShowSpawnMenu(false)
              setSplitMode({ active: false })
              setSpawnSearchText('')
              setSelectedSpawnOptions(new Set())
            }}>✕</button>
          </div>

          {/* Search Filter */}
          <div className="spawn-menu-search">
            <input
              type="text"
              placeholder="Search terminals... (filter by name, description, or project)"
              value={spawnSearchText}
              onChange={(e) => setSpawnSearchText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="spawn-menu-list">
            {spawnOptions
              .map((option, originalIdx) => ({ option, originalIdx }))
              .filter(({ option }) => {
                if (!spawnSearchText) return true
                const searchLower = spawnSearchText.toLowerCase()
                return (
                  option.label.toLowerCase().includes(searchLower) ||
                  option.description?.toLowerCase().includes(searchLower) ||
                  option.command?.toLowerCase().includes(searchLower)
                )
              })
              .map(({ option, originalIdx }) => {
              const globalWorkingDir = useSettingsStore.getState().workingDirectory || '~'
              // When in split mode, use detected cwd as fallback before global default
              const effectiveWorkingDir = option.workingDir ||
                                         (splitMode.active ? splitMode.detectedCwd : undefined) ||
                                         globalWorkingDir
              const isUsingDefault = !option.workingDir && !splitMode.active
              const isDetected = !option.workingDir && splitMode.active && splitMode.detectedCwd
              const isSelected = selectedSpawnOptions.has(originalIdx)

              return (
                <div
                  key={originalIdx}
                  className={`spawn-option ${isSelected ? 'selected' : ''}`}
                >
                  {/* Only show checkboxes when NOT in split mode */}
                  {!splitMode.active && (
                    <input
                      type="checkbox"
                      className="spawn-checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation()
                        const newSelected = new Set(selectedSpawnOptions)
                        if (isSelected) {
                          newSelected.delete(originalIdx)
                        } else {
                          newSelected.add(originalIdx)
                        }
                        setSelectedSpawnOptions(newSelected)
                      }}
                    />
                  )}
                  <div
                    className="spawn-option-content"
                    onClick={() => {
                      if (splitMode.active || selectedSpawnOptions.size === 0) {
                        // Split mode OR no selections - spawn single terminal immediately
                        handleSpawnTerminal(option)
                      } else {
                        // Has selections - toggle this one
                        const newSelected = new Set(selectedSpawnOptions)
                        if (isSelected) {
                          newSelected.delete(originalIdx)
                        } else {
                          newSelected.add(originalIdx)
                        }
                        setSelectedSpawnOptions(newSelected)
                      }
                    }}
                  >
                    <span className="spawn-icon">{option.icon}</span>
                    <div className="spawn-info">
                      <div className="spawn-label">{option.label}</div>
                      <div className="spawn-description">{option.description}</div>
                      <div className="spawn-workingdir">
                        📁 {effectiveWorkingDir}
                        {isUsingDefault && <span className="workingdir-default"> (default)</span>}
                        {isDetected && <span className="workingdir-default"> (detected from {storedTerminals.find(t => t.id === splitMode.terminalId)?.name || 'terminal'})</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bulk Spawn Button - only show when NOT in split mode */}
          {!splitMode.active && selectedSpawnOptions.size > 0 && (
            <div className="spawn-menu-footer">
              <button
                className="spawn-selected-btn"
                onClick={() => {
                  // Spawn all selected terminals
                  selectedSpawnOptions.forEach(idx => {
                    handleSpawnTerminal(spawnOptions[idx])
                  })
                  // Close menu and clear selections
                  setShowSpawnMenu(false)
                  setSplitMode({ active: false })
                  setSpawnSearchText('')
                  setSelectedSpawnOptions(new Set())
                }}
              >
                Spawn {selectedSpawnOptions.size} Terminal{selectedSpawnOptions.size > 1 ? 's' : ''}
              </button>
            </div>
          )}
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
                    terminals={storedTerminals.filter(t => {
                      // Only pass terminals from this window to prevent cross-window rendering
                      const terminalWindow = t.windowId || 'main'
                      return terminalWindow === currentWindowId
                    })}
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
          <div className="footer-left">
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

              {/* Refresh Button */}
              <button
                className="footer-control-btn"
                onClick={handleRefresh}
                title="Refresh display (fixes stuck terminals)"
              >
                🔄
              </button>

              {/* Split Pane Controls - Only show when focused terminal is part of a split */}
              {focusedTerminalId && parentSplitTerminal && (
                <>
                  <span className="footer-separator">│</span>
                  <button
                    className="footer-control-btn"
                    onClick={() => handlePopOutPane(focusedTerminalId)}
                    title="Pop out focused pane to new tab"
                  >
                    ↗
                  </button>
                  <button
                    className="footer-control-btn"
                    onClick={() => handleClosePane(focusedTerminalId)}
                    title="Close focused pane"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="footer-right">
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
                <TextColorThemeDropdown
                  value={displayTerminal.theme || 'default'}
                  onChange={handleThemeChange}
                  openUpward={true}
                />
              </label>

              <label>
                Background Gradient
                <BackgroundGradientDropdown
                  value={displayTerminal.background || 'dark-neutral'}
                  onChange={handleBackgroundChange}
                  openUpward={true}
                />
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
                <FontFamilyDropdown
                  value={displayTerminal.fontFamily || 'monospace'}
                  onChange={handleFontFamilyChange}
                  openUpward={true}
                />
              </label>
            </div>
          </div>
      )}

      {/* Tab Context Menu */}
      {contextMenu.show && contextMenu.terminalId && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          terminalId={contextMenu.terminalId}
          terminalName={storedTerminals.find(t => t.id === contextMenu.terminalId)?.name || 'Terminal'}
          agentId={storedTerminals.find(t => t.id === contextMenu.terminalId)?.agentId || null}
          sessionName={agents.find(a => a.id === storedTerminals.find(t => t.id === contextMenu.terminalId)?.agentId)?.sessionName}
          onClose={handleContextMenuClose}
          onSplitVertical={handleSplitVertical}
          onSplitHorizontal={handleSplitHorizontal}
          onRename={handleRenameTab}
          onRefreshName={handleRefreshNameFromTmux}
          onDetach={() => handleDetachTab(contextMenu.terminalId!)}
          onPopOut={() => handlePopOutTab(contextMenu.terminalId!)}
          onCloseTab={() => handleCloseTerminal(contextMenu.terminalId!)}
        />
      )}
    </div>
  )
}

export default SimpleTerminalApp
