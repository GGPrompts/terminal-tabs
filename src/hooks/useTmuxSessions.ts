import { useState, useEffect, useCallback } from 'react';

export interface TmuxSession {
  sessionName: string;
  windows: number;
  attached: boolean;
  created: Date;
  lastActive?: Date;
}

interface UseTmuxSessionsOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

export function useTmuxSessions(options: UseTmuxSessionsOptions = {}) {
  const { refreshInterval = 2000, autoRefresh = true } = options;

  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/tmux/sessions/detailed');
      if (!res.ok) {
        throw new Error(`Failed to fetch sessions: ${res.statusText}`);
      }
      const response = await res.json();

      // Map backend format to frontend format
      const mappedSessions: TmuxSession[] = response.data.sessions.map((session: any) => ({
        sessionName: session.name,
        windows: session.windows,
        attached: session.attached,
        created: new Date(parseInt(session.created) * 1000), // Unix timestamp to Date
        lastActive: session.lastActive ? new Date(session.lastActive) : undefined
      }));

      setSessions(mappedSessions);
      setError(null);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      console.error('Error fetching tmux sessions:', err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSessions();

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchSessions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchSessions, refreshInterval, autoRefresh]);

  return {
    sessions,
    loading,
    error,
    refresh: fetchSessions
  };
}
