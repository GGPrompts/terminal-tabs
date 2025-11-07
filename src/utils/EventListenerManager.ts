/**
 * EventListenerManager - Centralized management for WebSocket event listeners
 * Prevents memory leaks by tracking and cleaning up listeners
 */

interface ListenerInfo {
  ws: WebSocket
  event: string
  handler: (event: MessageEvent) => void
  cleanup?: NodeJS.Timeout
}

export class EventListenerManager {
  private listeners = new Map<string, ListenerInfo>()
  private static instance: EventListenerManager

  static getInstance(): EventListenerManager {
    if (!EventListenerManager.instance) {
      EventListenerManager.instance = new EventListenerManager()
    }
    return EventListenerManager.instance
  }

  /**
   * Add a WebSocket event listener with automatic cleanup
   */
  addListener(
    ws: WebSocket,
    eventType: string,
    handler: (event: MessageEvent) => void,
    timeout = 5000
  ): string {
    const id = `${Date.now()}_${Math.random()}`

    // Add the event listener
    ws.addEventListener(eventType, handler as any)

    // Set up automatic cleanup after timeout
    const cleanup = timeout > 0 ? setTimeout(() => {
      this.removeListener(id)
    }, timeout) : undefined

    // Store listener info
    this.listeners.set(id, {
      ws,
      event: eventType,
      handler,
      cleanup
    })

    return id
  }

  /**
   * Add a one-time listener that auto-removes after firing
   */
  addOnceListener(
    ws: WebSocket,
    matcher: (data: any) => boolean,
    callback: (data: any) => void,
    timeout = 5000
  ): string {
    const handler = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data)
        if (matcher(message)) {
          callback(message)
          // Auto-remove this listener after it fires
          const listenerId = Array.from(this.listeners.entries())
            .find(([_, info]) => info.handler === handler)?.[0]
          if (listenerId) {
            this.removeListener(listenerId)
          }
        }
      } catch (error) {
        console.error('Error in once listener:', error)
      }
    }

    return this.addListener(ws, 'message', handler, timeout)
  }

  /**
   * Remove a specific listener
   */
  removeListener(id: string): void {
    const listener = this.listeners.get(id)
    if (!listener) return

    // Clear timeout if exists
    if (listener.cleanup) {
      clearTimeout(listener.cleanup)
    }

    // Remove the event listener
    try {
      listener.ws.removeEventListener(listener.event, listener.handler as any)
    } catch (error) {
      // WebSocket might be closed already
    }

    // Remove from tracking
    this.listeners.delete(id)
  }

  /**
   * Remove all listeners for a specific WebSocket
   */
  removeAllForWebSocket(ws: WebSocket): void {
    const toRemove: string[] = []

    this.listeners.forEach((info, id) => {
      if (info.ws === ws) {
        toRemove.push(id)
      }
    })

    toRemove.forEach(id => this.removeListener(id))
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    this.listeners.forEach((_, id) => this.removeListener(id))
    this.listeners.clear()
  }

  /**
   * Get current listener count (for debugging)
   */
  getListenerCount(): number {
    return this.listeners.size
  }
}

export default EventListenerManager.getInstance()