import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Terminal, Pin, PinOff, Settings, Plus } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { onMessage, sendMessage } from '../shared/messaging'
import { getLocal, setLocal } from '../shared/storage'
import '../styles/globals.css'

interface TerminalSession {
  id: string
  name: string
  type: string
  active: boolean
}

function SidePanelTerminal() {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [currentSession, setCurrentSession] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  useEffect(() => {
    // Load pinned state from storage
    getLocal(['settings']).then(({ settings }) => {
      if (settings?.sidePanelPinned !== undefined) {
        setPinned(settings.sidePanelPinned)
      }
    })

    // Listen for messages from background
    onMessage((message) => {
      if (message.type === 'WS_CONNECTED') {
        setWsConnected(true)
      } else if (message.type === 'WS_DISCONNECTED') {
        setWsConnected(false)
      } else if (message.type === 'WS_MESSAGE') {
        handleWebSocketMessage(message.data)
      }
    })

    // Request initial session list
    sendMessage({ type: 'WS_MESSAGE', data: { type: 'list-sessions' } })
  }, [])

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'session-list':
        setSessions(data.sessions || [])
        break
      case 'terminal-spawned':
        // Add new session
        setSessions(prev => [...prev, {
          id: data.terminalId,
          name: data.sessionName || data.terminalId,
          type: data.spawnOption || 'bash',
          active: false,
        }])
        setCurrentSession(data.terminalId)
        break
      case 'terminal-closed':
        setSessions(prev => prev.filter(s => s.id !== data.terminalId))
        if (currentSession === data.terminalId) {
          setCurrentSession(sessions[0]?.id || null)
        }
        break
    }
  }

  const handleTogglePin = () => {
    const newPinned = !pinned
    setPinned(newPinned)
    setLocal({
      settings: {
        sidePanelPinned: newPinned,
      },
    })
  }

  const handleSpawnTerminal = () => {
    sendMessage({
      type: 'SPAWN_TERMINAL',
      spawnOption: 'bash',
    })
  }

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <h1 className="text-sm font-semibold">Terminal Tabs</h1>
          {wsConnected ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">Disconnected</Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSpawnTerminal}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="New Terminal"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={handleTogglePin}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title={pinned ? 'Unpin' : 'Pin'}
          >
            {pinned ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={handleOpenSettings}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Session Tabs */}
      {sessions.length > 0 && (
        <div className="flex gap-1 p-2 border-b bg-muted/30 overflow-x-auto">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setCurrentSession(session.id)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors
                ${currentSession === session.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent text-foreground'
                }
              `}
            >
              {session.name}
            </button>
          ))}
        </div>
      )}

      {/* Terminal View */}
      <div className="flex-1 relative">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Terminal className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">No active terminals</p>
            <p className="text-sm mb-4">Spawn a terminal to get started</p>
            <button
              onClick={handleSpawnTerminal}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="inline-block h-4 w-4 mr-2" />
              New Terminal
            </button>
          </div>
        ) : (
          <div className="h-full">
            {/* TODO: Integrate actual xterm.js terminal component */}
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Terminal className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Terminal view coming soon...</p>
                <p className="text-xs mt-1">Session: {currentSession}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-card text-xs text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <span>{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</span>
          {pinned && (
            <>
              <span>•</span>
              <span>📌 Pinned</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Mount the sidepanel
ReactDOM.createRoot(document.getElementById('sidepanel-root')!).render(
  <React.StrictMode>
    <SidePanelTerminal />
  </React.StrictMode>
)
