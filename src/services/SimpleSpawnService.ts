/**
 * SimpleSpawnService - Minimal spawning for tab-based terminals
 */

interface SpawnConfig {
  terminalType: string
  name?: string
  workingDir?: string
  theme?: string
  transparency?: number
  size?: { width: number; height: number }
}

class SimpleSpawnService {
  private static instance: SimpleSpawnService
  private wsRef: React.MutableRefObject<WebSocket | null> | null = null

  static getInstance(): SimpleSpawnService {
    if (!SimpleSpawnService.instance) {
      SimpleSpawnService.instance = new SimpleSpawnService()
    }
    return SimpleSpawnService.instance
  }

  initialize(wsRef: React.MutableRefObject<WebSocket | null>) {
    this.wsRef = wsRef
  }

  private getWebSocket(): WebSocket | null {
    if (this.wsRef?.current && this.wsRef.current.readyState === WebSocket.OPEN) {
      return this.wsRef.current
    }
    return null
  }

  async spawn(options: { config: SpawnConfig }): Promise<string | null> {
    try {
      const ws = this.getWebSocket()
      if (!ws) {
        console.error('[SimpleSpawnService] No WebSocket connection available')
        return null
      }

      const spawnConfig = {
        ...options.config,
        platform: 'local',
        size: options.config.size || { width: 800, height: 600 },
      }

      const requestId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const spawnMessage = {
        type: 'spawn',
        requestId,
        config: spawnConfig,
      }

      ws.send(JSON.stringify(spawnMessage))

      // Return immediately - terminal will appear via WebSocket 'terminal-spawned' message
      return requestId
    } catch (error) {
      console.error('[SimpleSpawnService] Error spawning terminal:', error)
      return null
    }
  }
}

export default SimpleSpawnService.getInstance()
