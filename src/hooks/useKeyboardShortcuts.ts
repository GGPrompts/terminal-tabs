import { useEffect, useRef } from 'react'
import { Terminal as StoredTerminal } from '../stores/simpleTerminalStore'

/**
 * Custom hook for handling keyboard shortcuts in the terminal app.
 *
 * Manages global keyboard event listeners for:
 * - Escape: Close spawn menu
 * - Ctrl+T: Spawn first option (default) or toggle spawn menu
 * - Ctrl+W: Close active tab
 * - Ctrl+Tab: Next tab
 * - Ctrl+Shift+Tab: Previous tab
 * - Ctrl+Shift+T: Reopen last closed tab
 * - Ctrl+1-9: Jump to tab N
 *
 * @param showSpawnMenu - Whether spawn menu is currently visible
 * @param activeTerminalId - ID of currently active terminal
 * @param visibleTerminals - Array of visible terminals in current window
 * @param spawnOptions - Array of available spawn options
 * @param setShowSpawnMenu - Function to toggle spawn menu visibility
 * @param setActiveTerminal - Function to set active terminal
 * @param handleSpawnTerminal - Function to spawn a new terminal
 * @param handleCloseTerminal - Function to close a terminal
 */
export function useKeyboardShortcuts(
  showSpawnMenu: boolean,
  activeTerminalId: string | null,
  visibleTerminals: StoredTerminal[],
  spawnOptions: any[],
  setShowSpawnMenu: (show: boolean) => void,
  setActiveTerminal: (id: string | null) => void,
  handleSpawnTerminal: (option: any) => void,
  handleCloseTerminal: (id: string) => void
) {
  // Track last closed terminal for Ctrl+Shift+T
  const lastClosedTerminalRef = useRef<{ terminalType: string; icon?: string; name: string } | null>(null)

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
          setShowSpawnMenu(!showSpawnMenu)
        }
        return
      }

      // Ctrl+W - Close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeTerminalId) {
          const terminal = visibleTerminals.find(t => t.id === activeTerminalId)
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
  }, [showSpawnMenu, activeTerminalId, visibleTerminals, spawnOptions, setShowSpawnMenu, setActiveTerminal, handleSpawnTerminal, handleCloseTerminal])
}
