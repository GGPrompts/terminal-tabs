import React, { useState, useCallback } from 'react'
import { useCanvasStore } from '../stores/canvasStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { calculateSafeSpawnPosition } from '../utils/positionUtils'
import eventListenerManager from '../utils/EventListenerManager'
import UnifiedSpawnService from '../services/UnifiedSpawnService'

interface TerminalTemplate {
  name: string
  displayName: string
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

interface SpawnConfig {
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
}

interface SpawnTemplateOptions {
  embedded?: boolean
  workingDir?: string
  beforeSpawn?: (config: SpawnConfig) => void
  afterSpawn?: (terminalName: string | null, config: SpawnConfig) => void
  debugLabel?: string
}

/**
 * Terminal Launch Directory Priority System
 *
 * The launch directory for new terminals follows this priority (highest to lowest):
 *
 * 1. File tree right-click context - When using "Spawn Terminal Here" from context menu
 * 2. Offline terminal edited directory - If user explicitly changed it while terminal was offline
 * 3. Page-specific launch directory selector:
 *    - Terminals page: Uses the launch directory selected in Terminals tab header
 *    - Command Dispatcher: Uses its own independent launch directory selector
 * 4. Template default directory - From JSON template file (as fallback)
 * 5. System fallback - /home/matt/workspace
 *
 * Note: "Launch Directory" = where terminals start from
 *       "Working Directory" = your current project context (future feature)
 *
 * The library/terminals/ directory contains templates for reference only,
 * not for direct launching. Click on templates to open the viewer/editor.
 */
export function useTerminalSpawn(wsRef?: React.MutableRefObject<WebSocket | null>) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTemplate = useCallback(async (templatePath: string): Promise<TerminalTemplate | null> => {
    try {
      // Ensure we have an absolute path
      const fullPath = templatePath.startsWith('/')
        ? templatePath
        : `/home/matt/workspace/opustrator/${templatePath}`;

      const response = await fetch(`/api/files/read?path=${encodeURIComponent(fullPath)}`)
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`)
      }
      const data = await response.json()
      // API returns { path, content, fileName, fileSize }
      return JSON.parse(data.content) as TerminalTemplate
    } catch (err) {
      console.error('Error loading template:', err)
      setError(err instanceof Error ? err.message : 'Failed to load template')
      return null
    }
  }, [])

  const spawnFromTemplate = useCallback(async (
    templatePath: string,
    options?: SpawnTemplateOptions
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      const template = await loadTemplate(templatePath)
      if (!template) {
        throw new Error('Failed to load terminal template')
      }

      const config: SpawnConfig = {
        terminalType: template.terminalType,
        name: template.name,
        workingDir: options?.workingDir || template.workingDir || '/home/matt/workspace',
        startCommand: template.startCommand,
        commands: template.commands,
        toolName: template.toolName,
        isTUITool: template.isTUITool,
        embedded: options?.embedded || false,
        resumable: template.resumable,
        icon: template.icon,
        color: template.color
      }

      if (options?.debugLabel) {
      } else {
      }

      options?.beforeSpawn?.(config)

      const terminalName = await spawnTerminal(config)

      if (options?.debugLabel) {
      }

      options?.afterSpawn?.(terminalName, config)

      return terminalName
    } finally {
      setIsLoading(false)
    }
  }, [loadTemplate])

  const spawnTerminal = useCallback(async (config: SpawnConfig) => {
    setIsLoading(true)
    setError(null)

    try {

      // Force a viewport update if we're in the browser context
      // Get the actual canvas offset from the window if available
      const currentViewport = useCanvasStore.getState().viewport

      if (typeof window !== 'undefined' && (window as any).getCanvasOffset) {
        const actualCanvasOffset = (window as any).getCanvasOffset()
        if (actualCanvasOffset) {
          useCanvasStore.getState().setViewport({
            x: actualCanvasOffset.x,
            y: actualCanvasOffset.y,
            zoom: actualCanvasOffset.zoom || 1
          })
        }
      } else {
      }

      // Use UnifiedSpawnService for all spawning
      const terminalName = await UnifiedSpawnService.spawn({
        config,
        workingDir: config.workingDir,
        embedded: config.embedded,
        withDocs: false, // Disabled auto-docs to prevent duplicate attachments on refresh
      })

      return terminalName
    } catch (err) {
      console.error('Error spawning terminal:', err)
      setError(err instanceof Error ? err.message : 'Failed to spawn terminal')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [wsRef])

  const handleWidgetDocs = useCallback(async (terminalId: string, docs: any[], terminalPosition: { x: number, y: number }) => {
    try {
      // Get default file viewer size from settings
      const { defaultFileViewerSize } = useSettingsStore.getState()

      const terminalWidth = 800  // Default terminal width
      const cardWidth = defaultFileViewerSize.width
      const cardHeight = defaultFileViewerSize.height
      const gap = 20
      const cascadeOffset = 30

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
      console.error('Error creating widget documentation cards:', err)
    }
  }, [])

  return {
    spawnTerminal,
    spawnFromTemplate,
    isLoading,
    error
  }
}
