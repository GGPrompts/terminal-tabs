import type { ExtensionMessage } from '../shared/messaging'
import { getActiveSessionCount, addActiveSession, removeActiveSession, addRecentSession } from '../shared/storage'
import { parseUrlToPath } from '../shared/utils'

// WebSocket connection to backend
let ws: WebSocket | null = null
let reconnectTimeout: NodeJS.Timeout | null = null
const RECONNECT_DELAY = 5000
const WS_URL = 'ws://localhost:8128'

// Track connected clients (popup, sidepanel, devtools)
const connectedClients = new Set<chrome.runtime.Port>()

// Initialize background service worker
console.log('Terminal Tabs background service worker starting...')

// WebSocket connection management
function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected')
    return
  }

  console.log('Connecting to backend WebSocket:', WS_URL)
  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    console.log('✅ Background WebSocket connected')
    updateBadge()
    broadcastToClients({ type: 'WS_CONNECTED' })
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      console.log('📨 WS message received:', message.type)

      // Handle terminal output specially - broadcast directly as TERMINAL_OUTPUT
      if (message.type === 'output') {
        broadcastToClients({
          type: 'TERMINAL_OUTPUT',
          terminalId: message.terminalId,
          data: message.data,
        })
      } else {
        // Broadcast other messages as WS_MESSAGE
        broadcastToClients({
          type: 'WS_MESSAGE',
          data: message,
        })
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err)
    }
  }

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting...')
    ws = null
    broadcastToClients({ type: 'WS_DISCONNECTED' })

    // Attempt reconnection
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
    reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY)
  }
}

// Send message to WebSocket
function sendToWebSocket(data: any) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  } else {
    console.warn('WebSocket not connected, cannot send:', data)
  }
}

// Broadcast message to all connected extension pages
function broadcastToClients(message: ExtensionMessage) {
  connectedClients.forEach(port => {
    try {
      port.postMessage(message)
    } catch (err) {
      console.error('Failed to send message to client:', err)
      connectedClients.delete(port)
    }
  })
}

// Update extension badge with active session count
async function updateBadge() {
  const count = await getActiveSessionCount()
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' })
}

// Message handler from extension pages
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  console.log('📬 Message received from extension:', message.type)

  switch (message.type) {
    case 'OPEN_SESSION':
      // Open side panel with specific session
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      sendToWebSocket({
        type: 'attach-terminal',
        sessionName: message.sessionName,
      })
      break

    case 'SPAWN_TERMINAL':
      sendToWebSocket({
        type: 'spawn-terminal',
        command: message.command,
        cwd: message.cwd,
        spawnOption: message.spawnOption,
      })

      // Track as active session
      if (message.spawnOption) {
        addActiveSession(`${message.spawnOption}-${Date.now()}`)
        updateBadge()
      }
      break

    case 'CLOSE_SESSION':
      sendToWebSocket({
        type: 'close-terminal',
        sessionName: message.sessionName,
      })
      removeActiveSession(message.sessionName)
      updateBadge()
      break

    case 'CLOSE_TERMINAL':
      // Close specific terminal by ID
      sendToWebSocket({
        type: 'close-terminal',
        terminalId: message.terminalId,
      })
      break

    case 'TERMINAL_INPUT':
      // Forward terminal input to backend
      sendToWebSocket({
        type: 'command',
        terminalId: message.terminalId,
        command: message.data,
      })
      break

    case 'TERMINAL_RESIZE':
      // Forward terminal resize to backend
      sendToWebSocket({
        type: 'resize',
        terminalId: message.terminalId,
        cols: message.cols,
        rows: message.rows,
      })
      break

    case 'UPDATE_BADGE':
      updateBadge()
      break

    default:
      // Forward other messages to WebSocket
      sendToWebSocket(message)
  }

  return true // Keep message channel open for async response
})

// Port connections from extension pages (persistent communication)
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 Client connected:', port.name)
  connectedClients.add(port)

  port.onDisconnect.addListener(() => {
    console.log('🔌 Client disconnected:', port.name)
    connectedClients.delete(port)
  })

  port.onMessage.addListener((message: ExtensionMessage) => {
    // Handle messages from connected ports
    chrome.runtime.sendMessage(message)
  })
})

// Context menu registration
chrome.runtime.onInstalled.addListener(() => {
  console.log('Installing context menus...')

  // Main context menu
  chrome.contextMenus.create({
    id: 'terminal-tabs',
    title: 'Terminal Tabs',
    contexts: ['all'],
  })

  // Open in terminal (for links)
  chrome.contextMenus.create({
    id: 'open-url-in-terminal',
    parentId: 'terminal-tabs',
    title: 'Open URL in Terminal',
    contexts: ['link'],
  })

  // Run selected text as command
  chrome.contextMenus.create({
    id: 'run-command',
    parentId: 'terminal-tabs',
    title: 'Run in Terminal',
    contexts: ['selection'],
  })

  // Open side panel
  chrome.contextMenus.create({
    id: 'open-sidepanel',
    parentId: 'terminal-tabs',
    title: 'Open Side Panel',
    contexts: ['all'],
  })
})

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId)

  switch (info.menuItemId) {
    case 'open-url-in-terminal':
      if (info.linkUrl) {
        const path = parseUrlToPath(info.linkUrl)
        chrome.runtime.sendMessage({
          type: 'SPAWN_TERMINAL',
          cwd: path || undefined,
          command: `echo "Opened from: ${info.linkUrl}"`,
        })
      }
      break

    case 'run-command':
      if (info.selectionText) {
        chrome.runtime.sendMessage({
          type: 'SPAWN_TERMINAL',
          command: info.selectionText,
        })
      }
      break

    case 'open-sidepanel':
      if (tab?.windowId) {
        chrome.sidePanel.open({ windowId: tab.windowId })
      }
      break
  }
})

// Initialize WebSocket connection
connectWebSocket()

// Keep service worker alive with periodic ping
setInterval(() => {
  console.log('🏓 Background service worker alive')
  if (ws?.readyState !== WebSocket.OPEN) {
    connectWebSocket()
  }
}, 25000) // Chrome service workers can idle after 30s

console.log('✅ Terminal Tabs background service worker initialized')
