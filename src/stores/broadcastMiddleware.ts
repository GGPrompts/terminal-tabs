/**
 * BroadcastChannel Middleware for Zustand
 *
 * Synchronizes state across browser windows/tabs in real-time.
 * Eliminates race conditions by broadcasting synchronously after state updates.
 *
 * Architecture:
 * - Wraps Zustand state creator
 * - Listens for broadcasts from other windows
 * - Broadcasts after every state mutation (no setTimeout delays!)
 * - Uses replace mode to prevent infinite broadcast loops
 *
 * Benefits:
 * - No setTimeout race conditions
 * - Guaranteed ordering (broadcast after set)
 * - Centralized sync logic (not scattered across components)
 * - Easier to test
 *
 * @see CLAUDE.md "Option B: Move Sync Logic to Zustand Middleware"
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand'

type BroadcastMessage = {
  type: 'state-changed' | 'reload-all'
  payload?: string  // JSON-stringified state
  state?: any
  from: string
  at: number
}

/**
 * BroadcastChannel middleware that syncs state across windows.
 *
 * CRITICAL: This middleware intercepts ALL setState calls and broadcasts
 * changes to other windows. Uses replace mode to prevent infinite loops.
 *
 * @param currentWindowId - Unique ID for this window (prevents echo)
 * @returns Middleware function
 */
export const broadcastMiddleware = <T extends object>(
  currentWindowId: string
): (<
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, Mcs>) => {
  return (config) => (set, get, api) => {
    // Setup BroadcastChannel for cross-window communication
    // CRITICAL: Check if BroadcastChannel is available (might be mocked or unavailable in tests)
    let channel: BroadcastChannel | null = null

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('tabz-sync')

        // Listen for messages from other windows
        channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
          const data = event.data

          // Ignore messages from our own window (prevents echo)
          if (data.from === currentWindowId) {
            console.log('[BroadcastMiddleware] ⏭️ Ignoring broadcast from self')
            return
          }

          // Handle reload-all message
          if (data.type === 'reload-all') {
            console.log('[BroadcastMiddleware] 🔄 Received reload-all message from another window')
            if (typeof window !== 'undefined') {
              window.location.reload()
            }
            return
          }

          // Handle state-changed message
          if (data.type === 'state-changed' && data.payload) {
            try {
              const parsed = JSON.parse(data.payload)
              const incomingState = parsed?.state

              if (incomingState) {
                console.log('[BroadcastMiddleware] 🔄 Applying state from another window:', {
                  from: data.from,
                  terminalsCount: incomingState.terminals?.length || 0,
                  detachedCount: incomingState.terminals?.filter((t: any) => t.status === 'detached').length || 0
                })

                // Apply state using replace mode to prevent infinite broadcast loop
                // replace = true means this setState won't trigger our broadcast logic below
                api.setState(incomingState, true)
              }
            } catch (error) {
              console.error('[BroadcastMiddleware] Failed to parse payload:', error)
            }
          }
        }

        console.log('[BroadcastMiddleware] 📡 Initialized for window:', currentWindowId)

        // Cleanup on unmount
        if (typeof window !== 'undefined') {
          const cleanup = () => channel?.close()
          window.addEventListener('beforeunload', cleanup)
        }
      } catch (error) {
        console.warn('[BroadcastMiddleware] Failed to initialize BroadcastChannel:', error)
        channel = null
      }
    } else {
      console.log('[BroadcastMiddleware] ⚠️ BroadcastChannel not available (test environment?)')
    }

    // Wrap the original config's set function
    return config(
      (args, replace) => {
        // Call original set
        set(args, replace)

        // Broadcast to other windows (only for user-initiated changes, not incoming syncs)
        // If replace=true, this is an incoming broadcast, so don't re-broadcast
        if (!replace && channel) {
          const state = get()

          try {
            // Only broadcast serializable data (exclude functions)
            const serializable = {
              terminals: (state as any).terminals,
              activeTerminalId: (state as any).activeTerminalId,
              focusedTerminalId: (state as any).focusedTerminalId,
            }

            // Broadcast synchronously after state update (NO setTimeout!)
            // Send as JSON-stringified payload for proper serialization
            channel.postMessage({
              type: 'state-changed',
              payload: JSON.stringify({ state: serializable }),
              from: currentWindowId,
              at: Date.now()
            } as BroadcastMessage)

            console.log('[BroadcastMiddleware] 📡 Broadcasted state change to other windows:', {
              terminalsCount: serializable.terminals?.length || 0,
              detachedCount: serializable.terminals?.filter((t: any) => t.status === 'detached').length || 0
            })
          } catch (error) {
            console.warn('[BroadcastMiddleware] Failed to broadcast message:', error)
          }
        }
      },
      get,
      api
    )
  }
}
