import { useTmuxSessions, type TmuxSession } from '@/hooks/useTmuxSessions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, XCircle } from 'lucide-react';

interface TmuxSessionListProps {
  onAttachSession?: (sessionName: string) => void;
  onKillSession?: (sessionName: string) => void;
}

export function TmuxSessionList({ onAttachSession, onKillSession }: TmuxSessionListProps) {
  const { sessions, loading, error, refresh } = useTmuxSessions();

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <h3 className="font-semibold text-destructive">Error Loading Sessions</h3>
        <p className="text-sm text-destructive/80 mt-1">{error}</p>
        <Button
          onClick={refresh}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>No active tmux sessions</p>
        <p className="text-sm mt-2">Create a new session to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tmux Sessions</h2>
        <Button
          onClick={refresh}
          variant="ghost"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session Name</TableHead>
            <TableHead className="text-center">Windows</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session: TmuxSession) => (
            <TableRow
              key={session.sessionName}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onAttachSession?.(session.sessionName)}
            >
              <TableCell className="font-medium font-mono">
                {session.sessionName}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary">{session.windows}</Badge>
              </TableCell>
              <TableCell className="text-center">
                {session.attached ? (
                  <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                    Attached
                  </Badge>
                ) : (
                  <Badge variant="outline">Detached</Badge>
                )}
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {formatDate(session.created)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    onClick={() => onAttachSession?.(session.sessionName)}
                    variant="ghost"
                    size="sm"
                    title="Attach to session"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => onKillSession?.(session.sessionName)}
                    variant="ghost"
                    size="sm"
                    title="Kill session"
                  >
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
