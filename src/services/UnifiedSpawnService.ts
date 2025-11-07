/**
 * UnifiedSpawnService - Single entry point for all terminal spawning
 *
 * Consolidates spawn logic from:
 * - UnifiedChat.tsx direct spawning
 * - Sidebar.tsx onSpawn prop
 * - useTerminalSpawn.ts hook
 *
 * All spawn requests go through this service to ensure consistency
 */

import { useCanvasStore } from '../stores/canvasStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { calculateSafeSpawnPosition } from '../utils/positionUtils'
import eventListenerManager from '../utils/EventListenerManager'

export interface SpawnConfig {
  terminalType: string
  name?: string
  workingDir?: string
  startCommand?: string
  commands?: string[]
  toolName?: string
  isTUITool?: boolean
  embedded?: boolean
  resumable?: boolean
  icon?: string
  color?: string
  position?: { x: number, y: number }
  size?: { width: number, height: number }  // Terminal dimensions in pixels
  useTmux?: boolean  // Enable tmux session spawning
  sessionName?: string  // Desired tmux session name
  preventDuplicate?: boolean  // Prevent spawning if terminal with same name exists
}

export interface TerminalTemplate {
  name: string
  displayName?: string
  terminalType: string
  icon?: string
  color?: string
  workingDir?: string
  startCommand?: string
  commands?: string[]
  toolName?: string
  isTUITool?: boolean
  resumable?: boolean
  quickAccess?: boolean
}

class UnifiedSpawnService {
  private static instance: UnifiedSpawnService
  private wsRef: React.MutableRefObject<WebSocket | null> | null = null
  private spawningTerminals = new Set<string>()

  static getInstance(): UnifiedSpawnService {
    if (!UnifiedSpawnService.instance) {
      UnifiedSpawnService.instance = new UnifiedSpawnService()
    }
    return UnifiedSpawnService.instance
  }

  /**
   * Initialize with WebSocket reference
   */
  initialize(wsRef: React.MutableRefObject<WebSocket | null>) {
    this.wsRef = wsRef
  }

  /**
   * Check if a terminal of this type is already running
   */
  checkExisting(terminalType: string): string | null {
    const terminals = Array.from(useCanvasStore.getState().terminals.values())
    const existing = terminals.find(t =>
      t.terminalType === terminalType &&
      t.isOn !== false
    )
    return existing?.id || null
  }

  /**
   * Check if a specific named terminal is already running
   */
  checkExistingByName(name: string): string | null {
    const terminals = Array.from(useCanvasStore.getState().terminals.values())
    const existing = terminals.find(t =>
      t.name === name &&
      t.isOn !== false
    )
    return existing?.id || null
  }

  /**
   * Load template from library
   */
  async loadTemplate(templatePath: string): Promise<TerminalTemplate | null> {
    try {
      // Ensure we have an absolute path
      const fullPath = templatePath.startsWith('/')
        ? templatePath
        : `/home/matt/workspace/opustrator/${templatePath}`

      const response = await fetch(`/api/files/read?path=${encodeURIComponent(fullPath)}`)
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`)
      }
      const data = await response.json()
      return JSON.parse(data.content) as TerminalTemplate
    } catch (err) {
      // console.error('[UnifiedSpawnService] Error loading template:', err)
      return null
    }
  }

  /**
   * Get WebSocket connection (from ref or window)
   */
  private getWebSocket(): WebSocket | null {
    // Try ref first
    if (this.wsRef?.current && this.wsRef.current.readyState === WebSocket.OPEN) {
      return this.wsRef.current
    }

    // Try window fallback
    const windowWs = (window as any).ws
    if (windowWs && windowWs.readyState === WebSocket.OPEN) {
      return windowWs
    }

    // Try to create new connection as last resort
    // console.warn('[UnifiedSpawnService] No active WebSocket found')
    return null
  }

  /**
   * Main spawn method - all spawning goes through here
   */
  async spawn(options: {
    templatePath?: string
    config?: SpawnConfig
    workingDir?: string
    embedded?: boolean
    withDocs?: boolean
    position?: { x: number, y: number }
    allowDuplicate?: boolean
  }): Promise<string | null> {
    try {
      // Zoom reset is handled by App.tsx handleSpawn and handlePanToTerminal

      let spawnConfig: SpawnConfig

      // Load from template or use provided config
      if (options.templatePath) {
        const template = await this.loadTemplate(options.templatePath)
        if (!template) {
          // console.error('[UnifiedSpawnService] Failed to load template:', options.templatePath)
          return null
        }

        spawnConfig = {
          terminalType: template.terminalType,
          name: template.name,
          workingDir: options.workingDir || template.workingDir || '/home/matt/workspace',
          startCommand: template.startCommand,
          commands: template.commands,
          toolName: template.toolName,
          isTUITool: template.isTUITool,
          embedded: options.embedded || false,
          resumable: template.resumable,
          icon: template.icon,
          color: template.color
        }
      } else if (options.config) {
        spawnConfig = {
          ...options.config,
          embedded: options.embedded || options.config.embedded || false,
          workingDir: options.workingDir || options.config.workingDir || '/home/matt/workspace'
        }
      } else {
        // console.error('[UnifiedSpawnService] No template path or config provided')
        return null
      }

      // Check for existing instance unless duplicate is allowed
      // NOTE: Since backend now generates unique names, this check is less critical
      // but we keep it for terminals that explicitly shouldn't have duplicates
      if (!options.allowDuplicate && spawnConfig.name && spawnConfig.preventDuplicate) {
        const existingId = this.checkExistingByName(spawnConfig.name)
        if (existingId) {
          // Focus the existing terminal
          const terminal = useCanvasStore.getState().terminals.get(existingId)
          if (terminal && terminal.position) {
            // Pan to terminal if position is known
            const panToTerminal = (window as any).panToTerminal
            if (panToTerminal) {
              panToTerminal(existingId)
            }
          }
          return existingId
        }
      }

      // Prevent duplicate spawns
      const spawnKey = `${spawnConfig.terminalType}_${spawnConfig.name}`
      if (this.spawningTerminals.has(spawnKey)) {
        return null
      }
      this.spawningTerminals.add(spawnKey)
      // Clean up spawn key after 5 seconds to allow re-spawning if needed
      setTimeout(() => this.spawningTerminals.delete(spawnKey), 5000)

      // Get WebSocket
      const ws = this.getWebSocket()
      if (!ws) {
        // console.error('[UnifiedSpawnService] No WebSocket connection available')
        this.spawningTerminals.delete(spawnKey)
        return null
      }

      // Ensure size is set - fall back to global settings if not provided
      if (!spawnConfig.size) {
        const globalSettings = useSettingsStore.getState()
        spawnConfig.size = globalSettings.defaultTerminalSize || { width: 800, height: 600 }
        console.log('[UnifiedSpawnService] No size provided, using global settings:', spawnConfig.size)
      } else {
        console.log('[UnifiedSpawnService] Using provided size:', spawnConfig.size)
      }

      // Ensure theme is set - fall back to global settings if not provided
      if (!spawnConfig.theme) {
        const globalSettings = useSettingsStore.getState()
        spawnConfig.theme = globalSettings.terminalDefaultTheme || 'matrix'
        console.log('[UnifiedSpawnService] No theme provided, using global settings:', spawnConfig.theme)
      } else {
        console.log('[UnifiedSpawnService] Using provided theme:', spawnConfig.theme)
      }

      // Ensure transparency is set - fall back to global settings if not provided
      if (spawnConfig.transparency === undefined) {
        const globalSettings = useSettingsStore.getState()
        spawnConfig.transparency = globalSettings.terminalDefaultTransparency ?? 10
        console.log('[UnifiedSpawnService] No transparency provided, using global settings:', spawnConfig.transparency)
      } else {
        console.log('[UnifiedSpawnService] Using provided transparency:', spawnConfig.transparency)
      }

      // Calculate spawn position if not provided
      if (!spawnConfig.position) {
        // Get current viewport from App.tsx window global (NOT Zustand - viewport is transient React state for performance)
        // Zustand viewport is always { x: 0, y: 0, zoom: 1 } (not persisted per CLAUDE.md)
        const getCanvasOffset = (window as any).getCanvasOffset
        const currentViewport = getCanvasOffset ? getCanvasOffset() : { x: 0, y: 0, zoom: 1 }

        const terminals = useCanvasStore.getState().terminals
        const existingPositions = Array.from(terminals.values()).map(t => t.position)

        // viewport.x and viewport.y are the canvas offset (negative pan values)
        // We need to pass them as is for calculateSafeSpawnPosition
        spawnConfig.position = options.position || calculateSafeSpawnPosition(
          spawnConfig.size,  // Use the terminal's size for positioning
          { x: currentViewport.x, y: currentViewport.y },  // Use current viewport from window global
          currentViewport.zoom,
          existingPositions
        )

      }

      // Generate a unique request ID to track this spawn
      const requestId = `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Build spawn message
      const spawnMessage = {
        type: 'spawn',
        requestId,
        config: {
          ...spawnConfig,
          platform: 'local' // Always use local platform
        }
      }

      // Send spawn message
      ws.send(JSON.stringify(spawnMessage))

      // Listen for spawn completion or error
      return new Promise((resolve) => {
        // Match terminal by name prefix to handle numbered variations (e.g., "gemini" vs "gemini-2")
        const expectedName = spawnConfig.name || spawnConfig.terminalType

        // Track the timeout so we can clear it if spawn succeeds
        let timeoutHandle: NodeJS.Timeout | null = null

        // Listen for spawn error with our request ID
        const errorListenerId = eventListenerManager.addOnceListener(
          ws,
          (msg) => msg.type === 'spawn-error' && msg.requestId === requestId,
          (msg) => {
            // Clear the timeout since we got an error response
            if (timeoutHandle) {
              clearTimeout(timeoutHandle)
              timeoutHandle = null
            }
            console.error(`[UnifiedSpawnService] Spawn failed for ${expectedName}:`, msg.error)
            this.spawningTerminals.delete(spawnKey)
            eventListenerManager.removeListener(successListenerId)
            resolve(null) // Return null to indicate failure
          },
          15000
        )

        // Listen for successful spawn
        const successListenerId = eventListenerManager.addOnceListener(
          ws,
          (msg) => {
            if (msg.type !== 'terminal-spawned') return false

            // Match by requestId if available, otherwise fall back to name matching
            if (msg.requestId === requestId) return true

            const spawnedName = msg.data?.name
            if (!spawnedName || !expectedName) return false

            // Case-insensitive comparison for better matching
            const spawnedLower = spawnedName.toLowerCase()
            const expectedLower = expectedName.toLowerCase()

            // Exact match or prefix match with dash and number (e.g., "gemini-2", "pyradio-3")
            return spawnedLower === expectedLower ||
                   (spawnedLower.startsWith(expectedLower + '-') && /^[a-zA-Z0-9_-]+-\d+$/.test(spawnedLower))
          },
          async (msg) => {
            // Clear the timeout since spawn succeeded
            if (timeoutHandle) {
              clearTimeout(timeoutHandle)
              timeoutHandle = null
            }

            this.spawningTerminals.delete(spawnKey)

            // Check for widget documentation (auto-docs)
            if (options.withDocs && !spawnConfig.embedded) {
              const docLookupName = spawnConfig.toolName || spawnConfig.name || spawnConfig.terminalType

              try {
                const docsResponse = await fetch(`http://localhost:8127/api/files/widget-docs/${docLookupName}`)
                if (docsResponse.ok) {
                  const docsData = await docsResponse.json()
                  if (docsData.docs && docsData.docs.length > 0) {
                    await this.attachWidgetDocs(msg.data.id, docsData.docs, spawnConfig.position!)
                  }
                }
              } catch (err) {
                console.warn('[UnifiedSpawnService] Failed to fetch widget docs:', err)
              }
            }


            // Clean up error listener since spawn succeeded
            eventListenerManager.removeListener(errorListenerId)
            resolve(msg.data.name || msg.data.id)
          },
          15000 // 15 second timeout (increased for slower spawns)
        )

        // Add explicit timeout handling with better error message
        timeoutHandle = setTimeout(() => {
          eventListenerManager.removeListener(successListenerId)
          eventListenerManager.removeListener(errorListenerId)
          console.warn(`[UnifiedSpawnService] Spawn response timeout for: ${expectedName}. Terminal likely spawned but response was delayed.`)
          this.spawningTerminals.delete(spawnKey)
          // Resolve with null to indicate timeout
          resolve(null)
        }, 15100) // Slightly after the listener timeout of 15 seconds
      })

    } catch (error) {
      console.error('[UnifiedSpawnService] Spawn error:', error)
      return null
    }
  }

  /**
   * Spawn from template file
   */
  async spawnFromTemplate(
    templatePath: string,
    options?: {
      workingDir?: string
      embedded?: boolean
      withDocs?: boolean
      position?: { x: number, y: number }
    }
  ): Promise<string | null> {
    return this.spawn({
      templatePath,
      ...options
    })
  }

  /**
   * Spawn with config object
   */
  async spawnWithConfig(
    config: SpawnConfig,
    options?: {
      embedded?: boolean
      withDocs?: boolean
      position?: { x: number, y: number }
    }
  ): Promise<string | null> {
    return this.spawn({
      config,
      ...options
    })
  }

  /**
   * Attach widget documentation cards (auto-docs from widget-docs API)
   */
  async attachWidgetDocs(terminalId: string, docs: any[], terminalPosition: { x: number, y: number }): Promise<void> {
    try {
      // Get default file viewer size from settings
      const { defaultFileViewerSize } = useSettingsStore.getState()

      const terminalWidth = 800  // Default terminal width
      const cardWidth = defaultFileViewerSize.width
      const cardHeight = defaultFileViewerSize.height
      const gap = 20
      const cascadeOffset = 30

      // Update terminal's attachedDoc property with the first document
      if (docs.length > 0) {
        const firstDoc = docs[0]
        const terminalsMap = useCanvasStore.getState().terminals
        const terminalEntry = terminalsMap.get(terminalId) ||
                             Array.from(terminalsMap.values()).find(t => t.agentId === terminalId)
      }

      // Create cards for each documentation file
      docs.forEach((doc, index) => {
        const cardId = `widget-doc-${terminalId}-${index}-${Date.now()}`

        // Calculate position based on layout pattern
        let cardPosition = { x: 0, y: 0 }

        if (index === 0) {
          // First card goes to the right of terminal
          cardPosition = {
            x: terminalPosition.x + terminalWidth + gap,
            y: terminalPosition.y
          }
        } else if (index < 4) {
          // Next 3 cards cascade diagonally
          cardPosition = {
            x: terminalPosition.x + terminalWidth + gap + (cascadeOffset * index),
            y: terminalPosition.y + (cascadeOffset * index)
          }
        } else {
          // Wrap to next row for additional cards
          const row = Math.floor((index - 4) / 3) + 1
          const col = (index - 4) % 3
          cardPosition = {
            x: terminalPosition.x + terminalWidth + gap + (cascadeOffset * col),
            y: terminalPosition.y + (cardHeight + gap) * row + (cascadeOffset * col)
          }
        }

        // Determine if this is a YAML file
        const isYaml = doc.type === 'yaml' || doc.filename.endsWith('.yml') || doc.filename.endsWith('.yaml')

        // For YAML files, wrap in markdown code block for syntax highlighting
        const displayContent = isYaml
          ? `\`\`\`yaml\n${doc.content}\n\`\`\``
          : doc.content

        // Add the card with proper formatting
        useCanvasStore.getState().addCard({
          id: cardId,
          title: doc.filename.replace(/\.(md|markdown|yml|yaml)$/, ''),
          content: displayContent,
          backContent: doc.path, // Store the file path on the back
          variant: isYaml ? 'purple' : 'info', // Use purple for config files, info for docs
          position: cardPosition,
          size: { width: cardWidth, height: cardHeight },
          editable: true, // Allow editing like normal file cards
          isMarkdown: true, // Flag this as markdown for proper rendering (YAML will be in code block)
        })
      })

    } catch (err) {
      console.error('[UnifiedSpawnService] Error creating widget documentation cards:', err)
    }
  }

  /**
   * Attach documentation to a terminal (explicit attachedDoc)
   */
  async attachDocs(terminalId: string, docPaths: string[]): Promise<void> {
    try {
      // Wait briefly for terminal to be in store
      await new Promise(resolve => setTimeout(resolve, 100))

      // Try to find terminal by ID or agentId
      const terminalsMap = useCanvasStore.getState().terminals
      const terminalEntry = terminalsMap.get(terminalId) ||
                           Array.from(terminalsMap.values()).find(t => t.agentId === terminalId)

      if (!terminalEntry) {
        console.warn('[UnifiedSpawnService] Terminal not found for doc attachment:', terminalId)
        return
      }

      const { defaultFileViewerSize } = useSettingsStore.getState()

      for (let i = 0; i < docPaths.length; i++) {
        const docPath = docPaths[i]

        // Fetch document content
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(docPath)}`)
        if (!response.ok) continue

        const data = await response.json()
        const content = data.content
        const cardId = `doc-${terminalId}-${i}-${Date.now()}`
        const isMarkdown = docPath.endsWith('.md') || docPath.endsWith('.markdown')

        // Calculate position relative to terminal
        const gap = 20
        const cascadeOffset = 30
        const terminalWidth = terminalEntry.size?.width || 800

        let cardPosition = { x: 0, y: 0 }
        if (i === 0) {
          // First card goes to the right of terminal
          cardPosition = {
            x: (terminalEntry.position?.x || 0) + terminalWidth + gap,
            y: terminalEntry.position?.y || 0
          }
        } else {
          // Cascade subsequent cards
          cardPosition = {
            x: (terminalEntry.position?.x || 0) + terminalWidth + gap + (cascadeOffset * i),
            y: (terminalEntry.position?.y || 0) + (cascadeOffset * i)
          }
        }

        // Add documentation card
        useCanvasStore.getState().addCard({
          id: cardId,
          title: docPath.split('/').pop() || 'Documentation',
          content,
          backContent: docPath,
          variant: 'info',
          position: cardPosition,
          size: { width: defaultFileViewerSize.width, height: defaultFileViewerSize.height },
          editable: true,
          isMarkdown
        })
      }

    } catch (error) {
      console.error('[UnifiedSpawnService] Error attaching docs:', error)
    }
  }
}

export default UnifiedSpawnService.getInstance()
