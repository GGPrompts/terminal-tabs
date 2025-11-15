import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTerminalInstance } from '@/hooks/useTerminalInstance';
import { useSimpleWebSocket } from '@/hooks/useSimpleWebSocket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Maximize2, RefreshCw } from 'lucide-react';

interface MinimalTerminalViewProps {
  sessionName: string;
  terminalId?: string;
  onDetach?: () => void;
}

const WS_URL = `ws://${window.location.hostname}:8131`;

export function MinimalTerminalView({ sessionName, terminalId, onDetach }: MinimalTerminalViewProps) {
  const containerId = `terminal-${sessionName}`;
  const [attached, setAttached] = useState(false);
  const attachedRef = useRef(false);
  const terminalRef = useRef<any>(null);
  const onDataRef = useRef<((data: string) => void) | null>(null);

  // WebSocket connection (must be before useEffect that uses it)
  const { connected, send } = useSimpleWebSocket({
    url: WS_URL,
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle output from terminal (standard PTY protocol)
        if (message.type === 'terminal-output' && message.terminalId === terminalId) {
          terminalRef.current?.write(message.data);
        }

        // Handle terminal reconnected confirmation
        if (message.type === 'terminal-reconnected') {
          console.log('[MinimalTerminalView] Terminal reconnected:', terminalId);
          setAttached(true);
          attachedRef.current = true;
        }

        // Handle reconnect failed
        if (message.type === 'reconnect-failed' && message.terminalId === terminalId) {
          console.error('[MinimalTerminalView] Reconnect failed for terminal:', terminalId);
          terminalRef.current?.writeln(`\r\n\x1b[31mError: Failed to reconnect to terminal\x1b[0m\r\n`);
        }

        // Handle errors
        if (message.type === 'error') {
          console.error('[MinimalTerminalView] Error:', message.message);
          terminalRef.current?.writeln(`\r\n\x1b[31mError: ${message.message}\x1b[0m\r\n`);
        }
      } catch (err) {
        console.error('[MinimalTerminalView] Failed to parse message:', err);
      }
    },
    onOpen: () => {
      console.log('[MinimalTerminalView] WebSocket connected');
      // Reconnect to terminal using standard PTY protocol
      if (terminalId && !attachedRef.current) {
        console.log('[MinimalTerminalView] Reconnecting to terminal:', terminalId);
        send({
          type: 'reconnect',
          terminalId
        });
      }
    },
    onClose: () => {
      console.log('[MinimalTerminalView] WebSocket disconnected');
      setAttached(false);
      attachedRef.current = false;
    }
  });

  // Memoize theme to prevent terminal re-initialization
  const theme = useMemo(() => ({
    background: '#1a1a1a',
    foreground: '#ffffff',
    cursor: '#00ff00',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff'
  }), []);

  // Memoize onData callback to prevent terminal re-initialization
  const handleTerminalData = useCallback((data: string) => {
    onDataRef.current?.(data);
  }, []);

  // Terminal instance
  const terminal = useTerminalInstance({
    containerId,
    onData: handleTerminalData,
    theme
  });

  // Store terminal in ref for WebSocket callbacks
  useEffect(() => {
    terminalRef.current = terminal;
  }, [terminal]);

  // Set up data handler
  useEffect(() => {
    onDataRef.current = (data: string) => {
      if (connected && attached && terminalId) {
        send({
          type: 'command',
          terminalId,
          command: data
        });
      }
    };
  }, [connected, attached, terminalId, send]);

  // Reconnect to terminal when WebSocket connects
  useEffect(() => {
    if (connected && terminalId && !attachedRef.current) {
      console.log('[MinimalTerminalView] Reconnecting to terminal:', terminalId);
      send({
        type: 'reconnect',
        terminalId
      });
    }
  }, [connected, terminalId, send]);

  // Focus terminal when ready and attached
  useEffect(() => {
    if (terminal.ready && attached) {
      terminal.focus();
    }
  }, [terminal.ready, attached, terminal]);

  const handleDetach = () => {
    if (connected && terminalId) {
      send({
        type: 'detach',
        terminalId
      });
    }
    setAttached(false);
    attachedRef.current = false;
    onDetach?.();
  };

  const handleRefit = () => {
    const dims = terminal.fit();
    console.log('[MinimalTerminalView] Refit:', dims);

    // Notify backend of new dimensions
    if (connected && terminalId) {
      send({
        type: 'resize',
        terminalId,
        cols: dims.cols,
        rows: dims.rows
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold font-mono">{sessionName}</h2>
          <Badge variant={connected ? 'default' : 'secondary'}>
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
          {attached && (
            <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
              Attached
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleRefit} variant="ghost" size="sm" title="Refit terminal">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleRefit} variant="ghost" size="sm" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleDetach} variant="ghost" size="sm" title="Detach (keeps session alive)">
            <LogOut className="h-4 w-4" />
            Detach
          </Button>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 relative overflow-hidden bg-[#1a1a1a]">
        <div
          id={containerId}
          className="absolute inset-0"
          style={{
            padding: '4px'
          }}
        />
      </div>

      {/* Footer with hints */}
      <div className="px-4 py-1 border-t bg-card text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Tmux Session: {sessionName}</span>
          <span>
            Press <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+B</kbd> for tmux commands
          </span>
        </div>
      </div>
    </div>
  );
}
