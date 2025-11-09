import { Terminal as StoredTerminal, useSimpleTerminalStore } from '../stores/simpleTerminalStore'
import { generateWindowId } from '../utils/windowUtils'

/**
 * Custom hook for managing terminal pop-out to new browser windows.
 *
 * Handles the multi-step process of moving a terminal (and its split panes if any)
 * to a new browser window while maintaining tmux session continuity.
 *
 * Critical 4-step popout flow:
 * 1. Update terminal windowId and clear agentId
 * 2. Switch away from terminal in current window
 * 3. Detach from tmux sessions via API
 * 4. Wait for localStorage sync (600ms), then open new window
 *
 * @param currentWindowId - ID of current browser window
 * @param storedTerminals - Array of all stored terminals
 * @param activeTerminalId - ID of currently active terminal
 * @param visibleTerminals - Array of visible terminals in current window
 * @param useTmux - Whether tmux is enabled
 * @param wsRef - WebSocket reference for non-tmux detach messages
 * @param updateTerminal - Function to update terminal properties
 * @param setActiveTerminal - Function to set active terminal
 * @returns Object with handlePopOutTab function
 */
export function usePopout(
  currentWindowId: string,
  storedTerminals: StoredTerminal[],
  activeTerminalId: string | null,
  visibleTerminals: StoredTerminal[],
  useTmux: boolean,
  wsRef: React.RefObject<WebSocket | null>,
  updateTerminal: (id: string, updates: Partial<StoredTerminal>) => void,
  setActiveTerminal: (id: string | null) => void
) {
  /**
   * Move tab to new window (or existing window if specified)
   *
   * @param terminalId - ID of terminal to pop out
   * @param targetWindowId - Optional target window ID (generates new if not provided)
   */
  const handlePopOutTab = async (terminalId: string, targetWindowId?: string) => {
    const terminal = storedTerminals.find(t => t.id === terminalId)
    if (!terminal) return

    // Generate new window ID if not specified
    const newWindowId = targetWindowId || generateWindowId()

    console.log(`[usePopout] Popping out ${terminal.name} to window: ${newWindowId}`)

    // Collect all session names to detach (terminal + split panes)
    const sessionsToDetach: string[] = []
    if (terminal.sessionName) {
      sessionsToDetach.push(terminal.sessionName)
    }
    if (terminal.splitLayout && terminal.splitLayout.panes.length > 0) {
      terminal.splitLayout.panes.forEach(pane => {
        const paneTerminal = storedTerminals.find(t => t.id === pane.terminalId)
        if (paneTerminal?.sessionName) {
          sessionsToDetach.push(paneTerminal.sessionName)
        }
      })
    }

    // Step 1: Update state - move to new window and clear agent IDs
    console.log(`[usePopout] Step 1: Updating state (windowId=${newWindowId}, detaching ${sessionsToDetach.length} sessions)`)
    updateTerminal(terminalId, {
      agentId: undefined,
      status: 'spawning',
      windowId: newWindowId,
    })

    // Update split panes
    if (terminal.splitLayout && terminal.splitLayout.panes.length > 0) {
      terminal.splitLayout.panes.forEach(pane => {
        updateTerminal(pane.terminalId, {
          agentId: undefined,
          status: 'spawning',
          windowId: newWindowId,
        })
      })
    }

    // Step 2: Switch away from this terminal in current window
    if (activeTerminalId === terminalId) {
      const remainingTerminals = visibleTerminals.filter(t =>
        t.id !== terminalId &&
        (t.windowId || 'main') === currentWindowId
      )
      if (remainingTerminals.length > 0) {
        setActiveTerminal(remainingTerminals[0].id)
        console.log(`[usePopout] Step 2: Switched to ${remainingTerminals[0].name}`)
      } else {
        setActiveTerminal(null)
        console.log(`[usePopout] Step 2: No remaining terminals, cleared active`)
      }
    }

    // Step 3: Detach from tmux sessions using API (for tmux terminals)
    if (sessionsToDetach.length > 0 && useTmux) {
      console.log(`[usePopout] Step 3: Detaching from ${sessionsToDetach.length} tmux sessions via API`)
      // Detach from all sessions concurrently
      await Promise.all(
        sessionsToDetach.map(async (sessionName) => {
          try {
            const response = await fetch(`/api/tmux/detach/${sessionName}`, {
              method: 'POST',
            })
            const result = await response.json()
            if (result.success) {
              console.log(`[usePopout] ✓ Detached from tmux session: ${sessionName}`)
            } else {
              console.warn(`[usePopout] Failed to detach from ${sessionName}:`, result.error)
            }
          } catch (error) {
            console.error(`[usePopout] Error detaching from ${sessionName}:`, error)
          }
        })
      )
    } else {
      // For non-tmux terminals, send WebSocket detach
      const agentsToDetach: string[] = []
      if (terminal.agentId) agentsToDetach.push(terminal.agentId)
      if (terminal.splitLayout && terminal.splitLayout.panes.length > 0) {
        terminal.splitLayout.panes.forEach(pane => {
          const paneTerminal = storedTerminals.find(t => t.id === pane.terminalId)
          if (paneTerminal?.agentId) agentsToDetach.push(paneTerminal.agentId)
        })
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && agentsToDetach.length > 0) {
        console.log(`[usePopout] Step 3: Sending ${agentsToDetach.length} WebSocket detach messages`)
        agentsToDetach.forEach(agentId => {
          wsRef.current!.send(JSON.stringify({
            type: 'detach',
            terminalId: agentId,
          }))
        })
      }
    }

    // Step 4: Wait for state to sync and detaches to process, then open new window
    // New window will see updated windowId in localStorage and reconnect automatically
    // CRITICAL: Must wait for Zustand localStorage sync (debounced with 100ms delay)
    // to complete before opening new window, otherwise new window won't see updated windowId
    setTimeout(() => {
      console.log(`[usePopout] Step 4: Opening new window`)
      // Pass both windowId AND the terminalId to activate in the new window
      const url = `${window.location.origin}${window.location.pathname}?window=${newWindowId}&active=${terminalId}`
      const newWin = window.open(url, `tabz-${newWindowId}`)

      if (!newWin) {
        console.error('[usePopout] Failed to open new window (popup blocked?)')
      }
    }, 600) // Increased from 400ms to ensure localStorage sync completes (100ms debounce + 500ms buffer)
  }

  return {
    handlePopOutTab
  }
}
