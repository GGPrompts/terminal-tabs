import { useState } from 'react';
import { TmuxSessionList } from '@/components/TmuxSessionList';
import { TmuxSessionCard } from '@/components/TmuxSessionCard';
import { MinimalTerminalView } from '@/components/MinimalTerminalView';
import { TmuxControlPanel } from '@/components/TmuxControlPanel';
import { TmuxKeyboardShortcuts } from '@/components/TmuxKeyboardShortcuts';
import { useTmuxSessions } from '@/hooks/useTmuxSessions';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, LayoutList, Terminal as TerminalIcon } from 'lucide-react';

type ViewMode = 'list' | 'grid';

export function SimpleTmuxApp() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Track terminalId for each session (sessionName -> terminalId)
  const [sessionTerminals, setSessionTerminals] = useState<Record<string, string>>({});

  const { sessions, refresh } = useTmuxSessions();

  const handleAttachSession = (sessionName: string) => {
    console.log('[SimpleTmuxApp] Attaching to session:', sessionName);
    setActiveSession(sessionName);
  };

  const handleDetachSession = () => {
    console.log('[SimpleTmuxApp] Detaching from session');
    setActiveSession(null);
    refresh();
  };

  const handleKillSession = async (sessionName: string) => {
    console.log('[SimpleTmuxApp] Killing session:', sessionName);
    try {
      const response = await fetch(`/api/tmux/sessions/${sessionName}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to kill session');
      }

      // If we were viewing this session, close it
      if (activeSession === sessionName) {
        setActiveSession(null);
      }

      // Refresh session list
      refresh();
    } catch (err) {
      console.error('Failed to kill session:', err);
      alert(`Failed to kill session: ${err}`);
    }
  };

  const handleCreateSession = async (name: string, templateLabel: string) => {
    console.log('[SimpleTmuxApp] Creating session:', name, 'with template:', templateLabel);
    try {
      // Load spawn options to get full template config
      const optionsResponse = await fetch('/spawn-options.json');
      const optionsData = await optionsResponse.json();
      const template = optionsData.spawnOptions?.find((t: any) => t.label === templateLabel);

      if (!template) {
        throw new Error(`Template not found: ${templateLabel}`);
      }

      // Load global defaults
      const globalDefaults = optionsData.globalDefaults || {};

      // Create spawn config for /api/agents endpoint
      // Backend automatically uses tmux for resumable terminals
      const spawnConfig = {
        name: name,
        terminalType: template.terminalType,
        workingDir: template.workingDir || globalDefaults.workingDirectory,
        // Add any template-specific options
        ...(template.command && { prompt: template.command }),
      };

      console.log('[SimpleTmuxApp] Spawn config:', spawnConfig);

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(spawnConfig)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create session');
      }

      const data = await response.json();
      console.log('[SimpleTmuxApp] Session created:', data);

      // Store terminalId for this session
      if (data.data?.id) {
        setSessionTerminals(prev => ({
          ...prev,
          [name]: data.data.id
        }));
        console.log('[SimpleTmuxApp] Stored terminalId:', data.data.id, 'for session:', name);
      }

      // Refresh session list
      refresh();

      // Auto-attach to new session
      setActiveSession(name);
    } catch (err) {
      console.error('Failed to create session:', err);
      alert(`Failed to create session: ${err}`);
    }
  };

  const handleKillAllSessions = async () => {
    console.log('[SimpleTmuxApp] Killing all sessions');
    try {
      // Kill each session individually
      await Promise.all(
        sessions.map(session =>
          fetch(`/api/tmux/sessions/${session.sessionName}`, {
            method: 'DELETE'
          })
        )
      );

      // Clear active session
      setActiveSession(null);

      // Refresh session list
      refresh();
    } catch (err) {
      console.error('Failed to kill all sessions:', err);
      alert(`Failed to kill all sessions: ${err}`);
    }
  };

  const handleRenameSession = async (sessionName: string) => {
    const newName = prompt('Enter new session name:', sessionName);
    if (!newName || newName === sessionName) {
      return;
    }

    try {
      const response = await fetch(`/api/tmux/sessions/${sessionName}/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName })
      });

      if (!response.ok) {
        throw new Error('Failed to rename session');
      }

      // If we were viewing this session, update the active session name
      if (activeSession === sessionName) {
        setActiveSession(newName);
      }

      // Refresh session list
      refresh();
    } catch (err) {
      console.error('Failed to rename session:', err);
      alert(`Failed to rename session: ${err}`);
    }
  };

  const handleCreateWindow = async (sessionName: string) => {
    console.log('[SimpleTmuxApp] Creating window in session:', sessionName);
    try {
      const response = await fetch(`/api/tmux/sessions/${sessionName}/window`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to create window');
      }

      // Refresh session list
      refresh();
    } catch (err) {
      console.error('Failed to create window:', err);
      alert(`Failed to create window: ${err}`);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-96 border-r flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-6 w-6" />
              <h1 className="text-xl font-bold">Tabz Tmux</h1>
            </div>
            <TmuxKeyboardShortcuts />
          </div>

          <div className="flex items-center gap-2">
            <TmuxControlPanel
              onCreateSession={handleCreateSession}
              onKillAllSessions={handleKillAllSessions}
            />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === 'list' ? (
            <TmuxSessionList
              onAttachSession={handleAttachSession}
              onKillSession={handleKillSession}
            />
          ) : (
            <div className="grid gap-4">
              {sessions.map(session => (
                <TmuxSessionCard
                  key={session.sessionName}
                  session={session}
                  onAttach={handleAttachSession}
                  onRename={handleRenameSession}
                  onKill={handleKillSession}
                  onCreateWindow={handleCreateWindow}
                />
              ))}
              {sessions.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                  <p>No active tmux sessions</p>
                  <p className="text-sm mt-2">Create a new session to get started</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground text-center">
            <p>{sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <MinimalTerminalView
            sessionName={activeSession}
            terminalId={sessionTerminals[activeSession]}
            onDetach={handleDetachSession}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/10">
            <div className="text-center space-y-4">
              <TerminalIcon className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <div>
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  No Session Selected
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Select a session from the sidebar or create a new one
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
