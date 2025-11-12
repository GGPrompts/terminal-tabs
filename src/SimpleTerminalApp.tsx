import React, { useState, useEffect, useRef, useMemo } from 'react'
import './SimpleTerminalApp.css'
import { Terminal } from './components/Terminal'
import { SplitLayout } from './components/SplitLayout'
import { SettingsModal } from './components/SettingsModal'
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

// Extend Window interface for handlePopOutTab
declare global {
  interface Window {
    handlePopOutTab?: (terminalId: string) => void
  }
}

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  workingDirOverride?: string // Override from spawn menu (highest priority)
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
  isFocused: boolean
  isSplitActive: boolean
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent, terminalId: string) => void
  dropZone: DropZone
  isDraggedOver: boolean
  mousePosition: React.MutableRefObject<{ x: number; y: number }>
  splitPosition?: 'single' | 'left' | 'middle' | 'right'
}

function SortableTab({ terminal, isActive, isFocused, isSplitActive, onActivate, onClose, onContextMenu, dropZone, isDraggedOver, mousePosition, splitPosition = 'single' }: SortableTabProps) {
  // LOCK SPLIT PANES: Disable dragging for terminals that are part of a split (but not the container)
  const isPartOfSplit = splitPosition !== 'single'
  const isDraggable = !isPartOfSplit

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
    // Disable dragging for split pane tabs (lock them together)
    disabled: !isDraggable,
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
      style={{
        ...style,
        cursor: isDraggable ? 'grab' : 'default', // Show non-draggable cursor for split panes
      }}
      data-tab-id={terminal.id}
      className={`tab ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''} ${isSplitActive ? 'split-active' : ''} ${terminal.status === 'spawning' ? 'spawning' : ''} ${terminal.status === 'detached' ? 'detached' : ''} ${isDraggedOver ? 'drag-over' : ''} ${isBlocked ? 'merge-blocked' : ''} ${splitPosition !== 'single' ? `split-${splitPosition}` : ''} ${isPartOfSplit ? 'locked' : ''}`}
      onClick={onActivate}
      onContextMenu={(e) => onContextMenu(e, terminal.id)}
      {...attributes}
      {...(isDraggable ? listeners : {})}
    >
      {terminal.status === 'detached' ? (
        <span className="tab-icon-single">📌</span>
      ) : (
        <span className="tab-icon-single">{terminal.icon || '💻'}</span>
      )}
      <span className="tab-label">{terminal.name}</span>
      <button
        className="tab-close"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ✕
      </button>

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

      {/* Blocked Overlay - shows when trying to split into/from split panes */}
      {isBlocked && (
        <div className="merge-blocked-overlay">
          <div className="blocked-icon">🔒</div>
          <div className="blocked-text">Split panes are locked<br/>(Use "Unsplit" in context menu)</div>
        </div>
      )}
    </div>
  )
}

function SimpleTerminalApp() {
  const [showSpawnMenu, setShowSpawnMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean
    x: number
    y: number
    terminalId: string | null
  }>({ show: false, x: 0, y: 0, terminalId: null })

  // Settings
  const { useTmux, updateSettings } = useSettingsStore()
  const [showCustomizePanel, setShowCustomizePanel] = useState(false)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const spawnOptionsRef = useRef<SpawnOption[]>([]) // Ref to avoid closure issues

  // Multi-select spawn options
  const [spawnSearchText, setSpawnSearchText] = useState('')
  const [spawnWorkingDirOverride, setSpawnWorkingDirOverride] = useState('')
  const [selectedSpawnOptions, setSelectedSpawnOptions] = useState<Set<number>>(new Set())

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
  // EXCEPT: Detached terminals show in ALL windows so they can be re-attached anywhere
  // NEW: Split panes now show as tabs (styled to look merged)
  const visibleTerminals = useMemo(() => {
    const filtered = storedTerminals.filter(t => {
      // Detached terminals show in ALL windows (can re-attach from any monitor)
      if (t.status === 'detached') return true

      // Terminals without a windowId belong to the main window (backwards compatibility)
      const terminalWindow = t.windowId || 'main'

      // Show only terminals that belong to this window
      return terminalWindow === currentWindowId
    })

    return filtered
  }, [storedTerminals, currentWindowId])

  // Detect split tab positions for merged styling
  const splitTabInfo = useMemo(() => {
    const info = new Map<string, { position: 'single' | 'left' | 'middle' | 'right', splitContainerId: string }>()

    visibleTerminals.forEach(terminal => {
      // Check if this terminal is part of a split (find container)
      const splitContainer = visibleTerminals.find(t =>
        t.splitLayout?.panes?.some(p => p.terminalId === terminal.id)
      )

      if (splitContainer?.splitLayout && splitContainer.splitLayout.type !== 'single') {
        const panes = splitContainer.splitLayout.panes
        const paneIndex = panes.findIndex(p => p.terminalId === terminal.id)

        if (paneIndex !== -1) {
          let position: 'left' | 'middle' | 'right'
          if (panes.length === 2) {
            position = paneIndex === 0 ? 'left' : 'right'
          } else {
            position = paneIndex === 0 ? 'left' : paneIndex === panes.length - 1 ? 'right' : 'middle'
          }

          info.set(terminal.id, { position, splitContainerId: splitContainer.id })
        }
      } else {
        info.set(terminal.id, { position: 'single', splitContainerId: '' })
      }
    })

    return info
  }, [visibleTerminals])

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
    if (process.env.NODE_ENV === 'development') {
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

  // Wrapper to spawn terminal (optionally close menu)
  const handleSpawnTerminal = async (option: SpawnOption, closeMenu = true) => {
    if (closeMenu) {
      setShowSpawnMenu(false)
      setSpawnWorkingDirOverride('')
      setSelectedSpawnOptions(new Set())
    }
    // Pass working dir override through option
    const optionWithOverride = spawnWorkingDirOverride
      ? { ...option, workingDirOverride: spawnWorkingDirOverride }
      : option
    await spawnTerminal(optionWithOverride)
  }

  // Bulk spawn with staggered delays for better reliability
  const handleBulkSpawn = async () => {
    const selectedIndices = Array.from(selectedSpawnOptions)
    console.log(`[SimpleTerminalApp] Bulk spawning ${selectedIndices.length} terminals with 150ms stagger`)

    // Close menu and clear selections
    setShowSpawnMenu(false)
    const workingDirOverride = spawnWorkingDirOverride
    setSpawnWorkingDirOverride('')
    setSelectedSpawnOptions(new Set())

    // Spawn terminals with 150ms delay between each
    for (let i = 0; i < selectedIndices.length; i++) {
      const idx = selectedIndices[i]
      const option = spawnOptions[idx]
      console.log(`[SimpleTerminalApp] Spawning ${i + 1}/${selectedIndices.length}: ${option.label}`)

      // Apply working dir override if set
      const optionWithOverride = workingDirOverride
        ? { ...option, workingDirOverride }
        : option
      await spawnTerminal(optionWithOverride)

      // Add delay except after last terminal
      if (i < selectedIndices.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    console.log(`[SimpleTerminalApp] ✅ Bulk spawn complete: ${selectedIndices.length} terminals`)
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

  // Expose handlePopOutTab to window for SortableTab to use
  useEffect(() => {
    window.handlePopOutTab = handlePopOutTab
    return () => {
      delete window.handlePopOutTab
    }
  }, [handlePopOutTab])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu.show) return

    const handleClick = () => {
      setContextMenu({ show: false, x: 0, y: 0, terminalId: null })
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.show])

  // Handle right-click on tab
  const handleTabContextMenu = (e: React.MouseEvent, terminalId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      terminalId
    })
  }

  // Handle "Unsplit" context menu option
  const handleContextUnsplit = () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal) return

    // Determine which pane to pop out
    let paneToPopOut: string | null = null

    if (terminal.splitLayout && terminal.splitLayout.type !== 'single') {
      // Terminal is a container - use focusedTerminalId
      paneToPopOut = focusedTerminalId
    } else {
      // Terminal is a pane - use its own ID
      paneToPopOut = terminal.id
    }

    if (paneToPopOut) {
      handlePopOutPane(paneToPopOut)
    }
    setContextMenu({ show: false, x: 0, y: 0, terminalId: null })
  }

  // Handle "Pop out to new window" context menu option
  const handleContextPopOut = () => {
    if (!contextMenu.terminalId) return
    handlePopOutTab(contextMenu.terminalId)
    setContextMenu({ show: false, x: 0, y: 0, terminalId: null })
  }

  // Handle "Detach" context menu option
  const handleContextDetach = async () => {
    if (!contextMenu.terminalId) return
    const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
    if (!terminal || !terminal.sessionName) return

    console.log(`[SimpleTerminalApp] Detaching from tmux session: ${terminal.sessionName}`)

    // Check if this terminal is part of a split
    const splitContainer = storedTerminals.find(t =>
      t.splitLayout?.panes?.some(p => p.terminalId === terminal.id)
    )

    if (splitContainer && splitContainer.splitLayout) {
      // Terminal is part of a split - remove it from the split first
      console.log(`[SimpleTerminalApp] Detaching split pane ${terminal.id} from split ${splitContainer.id}`)

      const remainingPanes = splitContainer.splitLayout.panes.filter(
        p => p.terminalId !== terminal.id
      )

      if (remainingPanes.length === 1) {
        // Only 1 pane left - convert split container back to single terminal
        console.log(`[SimpleTerminalApp] Only 1 pane remaining, converting split to single terminal`)
        updateTerminal(splitContainer.id, {
          splitLayout: { type: 'single', panes: [] }
        })

        // Unhide the remaining pane if it was hidden (backwards compatibility)
        const remainingPaneTerminal = storedTerminals.find(t => t.id === remainingPanes[0].terminalId)
        if (remainingPaneTerminal?.isHidden) {
          updateTerminal(remainingPanes[0].terminalId, {
            isHidden: false
          })
        }

        // Set the remaining pane as active
        setActiveTerminal(remainingPanes[0].terminalId)
      } else if (remainingPanes.length > 1) {
        // Still have multiple panes
        updateTerminal(splitContainer.id, {
          splitLayout: {
            ...splitContainer.splitLayout,
            panes: remainingPanes
          }
        })

        // Keep the split active, focus the first remaining pane
        setActiveTerminal(splitContainer.id)
        setFocusedTerminal(remainingPanes[0].terminalId)
      }
    }

    try {
      const response = await fetch(`/api/tmux/detach/${terminal.sessionName}`, {
        method: 'POST',
      })
      const result = await response.json()

      if (result.success) {
        console.log(`[SimpleTerminalApp] ✓ Detached from session: ${terminal.sessionName}`)

        // Close the PTY process via WebSocket (but keep terminal in store)
        if (terminal.agentId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log(`[SimpleTerminalApp] Closing PTY for agent: ${terminal.agentId}`)
          wsRef.current.send(JSON.stringify({
            type: 'close',
            terminalId: terminal.agentId,
          }))
        }

        // Mark terminal as detached (keeps in localStorage, shows as grayed tab)
        updateTerminal(contextMenu.terminalId, {
          status: 'detached',
          agentId: undefined, // Clear PTY connection
        })
      } else {
        console.error(`[SimpleTerminalApp] Failed to detach:`, result.error)
      }
    } catch (error) {
      console.error(`[SimpleTerminalApp] Error detaching from session:`, error)
    }

    setContextMenu({ show: false, x: 0, y: 0, terminalId: null })
  }

  // Handle re-attaching a detached terminal
  const handleReattachTerminal = async (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (!terminal || terminal.status !== 'detached') return

    console.log(`[SimpleTerminalApp] Re-attaching terminal ${terminal.name} to session ${terminal.sessionName}`)

    // Find matching spawn option
    const option = spawnOptions.find(opt =>
      opt.command === terminal.command ||
      opt.terminalType === terminal.terminalType
    )

    if (!option) {
      console.error(`[SimpleTerminalApp] No spawn option found for terminal type: ${terminal.terminalType}`)
      return
    }

    // Assign to current window when re-attaching
    updateTerminal(terminalId, {
      windowId: currentWindowId,
      status: 'spawning',
    })

    // Use existing reconnect logic
    await handleReconnectTerminal(terminal, option)

    // Set as active after reconnecting
    setActiveTerminal(terminalId)
  }

  const handleCloseTerminal = (terminalId: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)

    // Check if this terminal is part of a split
    const splitContainer = storedTerminals.find(t =>
      t.splitLayout?.panes?.some(p => p.terminalId === terminalId)
    )

    if (splitContainer && splitContainer.splitLayout) {
      // Terminal is part of a split - clean up the split first
      console.log(`[SimpleTerminalApp] Closing pane ${terminalId} from split ${splitContainer.id}`)

      const remainingPanes = splitContainer.splitLayout.panes.filter(
        p => p.terminalId !== terminalId
      )

      if (remainingPanes.length === 1) {
        // Only 1 pane left - convert split container back to single terminal
        console.log(`[SimpleTerminalApp] Only 1 pane remaining, converting split to single terminal`)
        updateTerminal(splitContainer.id, {
          splitLayout: { type: 'single', panes: [] }
        })

        // Unhide the remaining pane if it was hidden (backwards compatibility)
        const remainingPaneTerminal = storedTerminals.find(t => t.id === remainingPanes[0].terminalId)
        if (remainingPaneTerminal?.isHidden) {
          updateTerminal(remainingPanes[0].terminalId, {
            isHidden: false
          })
        }

        // Set the remaining pane as active
        setActiveTerminal(remainingPanes[0].terminalId)
      } else if (remainingPanes.length > 1) {
        // Still have multiple panes
        updateTerminal(splitContainer.id, {
          splitLayout: {
            ...splitContainer.splitLayout,
            panes: remainingPanes
          }
        })

        // Keep the split active, focus the first remaining pane
        setActiveTerminal(splitContainer.id)
        setFocusedTerminal(remainingPanes[0].terminalId)
      } else {
        // No panes left - close the container too
        if (splitContainer.agentId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'close',
            terminalId: splitContainer.agentId,
          }))
        }
        removeTerminal(splitContainer.id)
      }
    }

    // Close the terminal via WebSocket
    if (terminal && terminal.agentId) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'close',
          terminalId: terminal.agentId,
        }))
      }
    }

    // Remove the terminal from store
    removeTerminal(terminalId)
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

    console.log(`[SimpleTerminalApp] Popping out pane ${paneTerminalId} to new tab (unsplit)`)

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
    } else if (remainingPanes.length > 1) {
      // Still have multiple panes
      updateTerminal(splitContainer.id, {
        splitLayout: {
          ...splitContainer.splitLayout,
          panes: remainingPanes
        }
      })
    }

    // Clear isHidden flag from popped-out terminal (backwards compatibility with old splits)
    if (paneTerminal.isHidden) {
      updateTerminal(paneTerminalId, {
        isHidden: false
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
            items={visibleTerminals
              .filter(t => {
                const isHidden = t.isHidden === true
                if (isHidden) return false

                // Include panes (even if they also have splitLayout)
                const splitInfo = splitTabInfo.get(t.id)
                if (splitInfo && splitInfo.position !== 'single') return true

                // Exclude containers that are not panes
                const hasSplitLayout = t.splitLayout && t.splitLayout.type !== 'single'
                if (hasSplitLayout) return false

                return true
              })
              .map(t => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="tab-bar">
              {visibleTerminals
                .filter(terminal => {
                  // HIDE terminals marked as hidden (backwards compatibility with old split approach)
                  const isHidden = terminal.isHidden === true
                  if (isHidden) return false

                  // SHOW terminals that are panes in a split (even if they also have splitLayout)
                  const splitInfo = splitTabInfo.get(terminal.id)
                  if (splitInfo && splitInfo.position !== 'single') {
                    return true // This is a pane - show it
                  }

                  // HIDE split containers that are NOT also panes
                  const hasSplitLayout = terminal.splitLayout && terminal.splitLayout.type !== 'single'
                  if (hasSplitLayout) {
                    return false // Container only, not a pane - hide it
                  }

                  // SHOW regular terminals
                  return true
                })
                .map(terminal => {
                  const splitInfo = splitTabInfo.get(terminal.id)
                  const isSplit = splitInfo && splitInfo.position !== 'single'

                  // Check if any sibling in the split is active
                  const isSplitActive = isSplit && visibleTerminals.some(t => {
                    const siblingInfo = splitTabInfo.get(t.id)
                    return siblingInfo?.splitContainerId === splitInfo.splitContainerId && t.id === activeTerminalId
                  })

                return (
                  <SortableTab
                    key={terminal.id}
                    terminal={terminal}
                    isActive={terminal.id === activeTerminalId}
                    isFocused={terminal.id === focusedTerminalId}
                    isSplitActive={!!isSplitActive}
                    onActivate={() => {
                      // If detached, re-attach. Otherwise, just set as active
                      if (terminal.status === 'detached') {
                        handleReattachTerminal(terminal.id)
                      } else {
                        // If this tab is part of a split, set activeTerminalId to the container
                        // (so the split view renders), and set focusedTerminalId to this pane
                        if (splitInfo && splitInfo.splitContainerId) {
                          setActiveTerminal(splitInfo.splitContainerId)
                          setFocusedTerminal(terminal.id)
                        } else {
                          // Regular tab - just set as active
                          setActiveTerminal(terminal.id)
                        }
                      }
                    }}
                    onClose={(e) => {
                      e.stopPropagation()
                      handleCloseTerminal(terminal.id)
                    }}
                    onContextMenu={handleTabContextMenu}
                    dropZone={dropZoneState?.terminalId === terminal.id ? dropZoneState.zone : null}
                    isDraggedOver={dropZoneState?.terminalId === terminal.id}
                    mousePosition={mousePosition}
                    splitPosition={splitInfo?.position}
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
            <button onClick={() => {
              setShowSpawnMenu(false)
              setSpawnSearchText('')
              setSpawnWorkingDirOverride('')
              setSelectedSpawnOptions(new Set())
            }}>✕</button>
          </div>

          {/* Working Directory Override Input */}
          <div className="spawn-workingdir-container">
            <label className="spawn-workingdir-label">
              📁 Working Directory (optional override)
            </label>
            <input
              type="text"
              className="spawn-workingdir-input"
              placeholder="Leave empty to use defaults..."
              value={spawnWorkingDirOverride}
              onChange={(e) => setSpawnWorkingDirOverride(e.target.value)}
            />
            {spawnWorkingDirOverride && (
              <button
                className="spawn-workingdir-clear"
                onClick={() => setSpawnWorkingDirOverride('')}
                title="Clear override"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="spawn-search-container">
            <input
              type="text"
              className="spawn-search-input"
              placeholder="Search terminals..."
              value={spawnSearchText}
              onChange={(e) => setSpawnSearchText(e.target.value)}
              autoFocus
            />
          </div>

          {/* Select All / Deselect All */}
          {(() => {
            // Filter options based on search text
            const filteredOptions = spawnOptions
              .map((option, idx) => ({ option, idx }))
              .filter(({ option }) => {
                if (!spawnSearchText) return true
                const searchLower = spawnSearchText.toLowerCase()
                return (
                  option.label.toLowerCase().includes(searchLower) ||
                  option.description?.toLowerCase().includes(searchLower) ||
                  option.command?.toLowerCase().includes(searchLower)
                )
              })

            const filteredIndices = filteredOptions.map(({ idx }) => idx)
            const allSelected = filteredIndices.length > 0 && filteredIndices.every(idx => selectedSpawnOptions.has(idx))

            return (
              <div className="spawn-select-all">
                <label>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      const newSelected = new Set(selectedSpawnOptions)
                      if (allSelected) {
                        // Deselect all filtered
                        filteredIndices.forEach(idx => newSelected.delete(idx))
                      } else {
                        // Select all filtered
                        filteredIndices.forEach(idx => newSelected.add(idx))
                      }
                      setSelectedSpawnOptions(newSelected)
                    }}
                  />
                  <span>{allSelected ? 'Deselect All' : 'Select All'} ({filteredOptions.length})</span>
                </label>
              </div>
            )
          })()}

          <div className="spawn-menu-list">
            {spawnOptions
              .map((option, idx) => ({ option, originalIdx: idx }))
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
              const isSelected = selectedSpawnOptions.has(originalIdx)

              // Calculate effective working directory (3-tier priority)
              const globalWorkingDir = useSettingsStore.getState().workingDirectory || '~'
              const effectiveWorkingDir = spawnWorkingDirOverride || option.workingDir || globalWorkingDir
              const isOverride = !!spawnWorkingDirOverride
              const isCustom = !spawnWorkingDirOverride && !!option.workingDir
              const isDefault = !spawnWorkingDirOverride && !option.workingDir

              return (
                <div
                  key={originalIdx}
                  className={`spawn-option ${isSelected ? 'selected' : ''}`}
                >
                  {/* Checkbox for multi-select */}
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
                  <div
                    className="spawn-option-content"
                    onClick={() => {
                      if (selectedSpawnOptions.size === 0) {
                        // No selections - spawn single terminal immediately
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
                        {isOverride && <span className="workingdir-badge workingdir-override"> (override)</span>}
                        {isCustom && <span className="workingdir-badge workingdir-custom"> (custom)</span>}
                        {isDefault && <span className="workingdir-badge workingdir-default"> (default)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bulk Spawn Button */}
          {selectedSpawnOptions.size > 0 && (
            <div className="spawn-menu-footer">
              <button
                className="spawn-selected-btn"
                onClick={handleBulkSpawn}
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
            {/* Render ONLY visible terminals (exclude split containers and hidden terminals) */}
            {visibleTerminals
              .filter(terminal => {
                const isHidden = terminal.isHidden === true
                if (isHidden) return false

                // Include panes in splits (even if they also have splitLayout)
                const splitInfo = splitTabInfo.get(terminal.id)
                if (splitInfo && splitInfo.position !== 'single') return true

                // Exclude containers that are not also panes
                const hasSplitLayout = terminal.splitLayout && terminal.splitLayout.type !== 'single'
                if (hasSplitLayout) return false

                return true
              })
              .map((terminal) => {
              const agent = agents.find(a => a.id === terminal.agentId)

              // Don't render Terminal component until status is 'active' and agent exists
              if (!agent || terminal.status !== 'active') {
                return terminal.id === activeTerminalId ? (
                  <div key={terminal.id} className="loading-state">
                    {terminal.status === 'detached' ? (
                      <>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📌</div>
                        <div className="loading-text">
                          Terminal detached from session: {terminal.sessionName}
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '14px', color: '#888' }}>
                          Click this tab to re-attach
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="loading-spinner"></div>
                        <div className="loading-text">
                          {terminal.status === 'spawning' ? 'Connecting to terminal...' :
                           terminal.status === 'error' ? 'Failed to connect' :
                           'Loading...'}
                        </div>
                      </>
                    )}
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
                    terminals={visibleTerminals}
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

      {/* Context Menu */}
      {contextMenu.show && contextMenu.terminalId && (
        <div
          className="tab-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 10000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const terminal = storedTerminals.find(t => t.id === contextMenu.terminalId)
            const canDetach = terminal?.sessionName && terminal?.status !== 'detached'

            // Check if this terminal is part of a split (either as container or as pane)
            const isInSplit = terminal && (
              // This terminal is a split container
              (terminal.splitLayout && terminal.splitLayout.type !== 'single') ||
              // OR this terminal is a pane in another container's split
              storedTerminals.some(t => t.splitLayout?.panes?.some(p => p.terminalId === terminal.id))
            )

            return (
              <>
                {canDetach && (
                  <button
                    className="context-menu-item"
                    onClick={handleContextDetach}
                  >
                    Detach
                  </button>
                )}
                {isInSplit && (
                  <button
                    className="context-menu-item"
                    onClick={handleContextUnsplit}
                  >
                    Unsplit
                  </button>
                )}
                <button
                  className="context-menu-item"
                  onClick={handleContextPopOut}
                >
                  Pop out to new window
                </button>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default SimpleTerminalApp
