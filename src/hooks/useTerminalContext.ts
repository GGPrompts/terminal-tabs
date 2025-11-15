import { useState, useEffect } from 'react';
import { useSimpleTerminalStore } from '../stores/simpleTerminalStore';

export interface TerminalContext {
  cwd: string;
  recentCommands: string[];
  gitStatus?: string;
  gitRepo?: boolean;
  files?: string[];
  lastCommand?: string;
}

/**
 * Hook to gather context about a terminal session
 * This context is used to provide AI with information for better suggestions
 */
export function useTerminalContext(terminalId: string): TerminalContext {
  const terminals = useSimpleTerminalStore((state) => state.terminals);
  const terminal = terminals.find((t) => t.id === terminalId);

  const [context, setContext] = useState<TerminalContext>({
    cwd: '~',
    recentCommands: [],
    gitRepo: false,
  });

  useEffect(() => {
    if (!terminal?.sessionName) {
      return;
    }

    // Fetch terminal context from backend
    const fetchContext = async () => {
      try {
        const response = await fetch(`http://localhost:8127/api/tmux/context/${terminal.sessionName}`);

        if (!response.ok) {
          // Fallback to basic context if API not available
          setContext({
            cwd: terminal.workingDir || '~',
            recentCommands: [],
            gitRepo: false,
          });
          return;
        }

        const data = await response.json();

        setContext({
          cwd: data.cwd || terminal.workingDir || '~',
          recentCommands: data.recentCommands || [],
          gitStatus: data.gitStatus,
          gitRepo: data.gitRepo || false,
          files: data.files,
          lastCommand: data.lastCommand,
        });
      } catch (error) {
        console.error('[useTerminalContext] Failed to fetch context:', error);

        // Fallback to basic context
        setContext({
          cwd: terminal.workingDir || '~',
          recentCommands: [],
          gitRepo: false,
        });
      }
    };

    fetchContext();

    // Refresh context periodically (every 5 seconds)
    const interval = setInterval(fetchContext, 5000);

    return () => clearInterval(interval);
  }, [terminal?.sessionName, terminal?.workingDir]);

  return context;
}
