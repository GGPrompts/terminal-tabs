import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Terminal, Clock, Settings, Plus } from 'lucide-react'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '../components/ui/command'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { getLocal, SyncedSession, getActiveSessionCount } from '../shared/storage'
import { sendMessage } from '../shared/messaging'
import { formatTimestamp } from '../shared/utils'
import spawnOptionsData from '../spawn-options.json'
import '../styles/globals.css'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
}

function ExtensionPopup() {
  const [recentSessions, setRecentSessions] = useState<SyncedSession[]>([])
  const [activeSessionCount, setActiveSessionCount] = useState(0)
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    // Load recent sessions from storage
    getLocal(['recentSessions']).then(({ recentSessions }) => {
      setRecentSessions(recentSessions || [])
    })

    // Get active session count
    getActiveSessionCount().then(count => {
      setActiveSessionCount(count)
    })

    // Load spawn options from imported JSON
    setSpawnOptions(spawnOptionsData.spawnOptions || [])
  }, [])

  const handleSessionSelect = (sessionName: string) => {
    sendMessage({
      type: 'OPEN_SESSION',
      sessionName,
    })
    window.close() // Close popup
  }

  const handleSpawn = (spawnOption: SpawnOption) => {
    sendMessage({
      type: 'SPAWN_TERMINAL',
      spawnOption: spawnOption.terminalType,
      command: spawnOption.command,
    })
    window.close()
  }

  const handleOpenSettings = () => {
    // TODO: Create options page
    // For now, just open side panel
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    window.close()
  }

  const handleOpenSidePanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    window.close()
  }

  // Filter spawn options based on search
  const filteredSpawnOptions = spawnOptions.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
    option.description.toLowerCase().includes(searchValue.toLowerCase())
  )

  const filteredRecentSessions = recentSessions.filter(session =>
    session.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  return (
    <div className="w-[400px] h-[500px] bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Terminal Tabs</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeSessionCount > 0 && (
            <Badge variant="secondary">
              {activeSessionCount} active
            </Badge>
          )}
          <button
            onClick={handleOpenSettings}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Command Palette */}
      <Command className="rounded-none border-0">
        <CommandInput
          placeholder="Search sessions or spawn new terminal..."
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Recent Sessions */}
          {filteredRecentSessions.length > 0 && (
            <>
              <CommandGroup heading="Recent Sessions">
                {filteredRecentSessions.map(session => (
                  <CommandItem
                    key={session.name}
                    onSelect={() => handleSessionSelect(session.name)}
                    className="cursor-pointer"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    <div className="flex-1">
                      <div className="font-medium">{session.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {session.workingDir} • {formatTimestamp(session.lastActive)}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Quick Spawn */}
          <CommandGroup heading="Quick Spawn">
            <CommandItem
              onSelect={handleOpenSidePanel}
              className="cursor-pointer text-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              <div className="flex-1">
                <div className="font-medium">Open Side Panel</div>
                <div className="text-xs text-muted-foreground">
                  Full terminal interface in side panel
                </div>
              </div>
            </CommandItem>

            {filteredSpawnOptions.slice(0, 8).map(option => (
              <CommandItem
                key={option.terminalType}
                onSelect={() => handleSpawn(option)}
                className="cursor-pointer"
              >
                <span className="mr-2 text-lg">{option.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-2 border-t bg-background">
        <div className="text-xs text-center text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘K</kbd> or <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+K</kbd> in any page
        </div>
      </div>
    </div>
  )
}

// Mount the popup
ReactDOM.createRoot(document.getElementById('popup-root')!).render(
  <React.StrictMode>
    <ExtensionPopup />
  </React.StrictMode>
)
