import { useState } from 'react';
import { type TmuxSession } from '@/hooks/useTmuxSessions';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MoreVertical,
  Play,
  Edit,
  XCircle,
  PlusSquare,
  Info,
  Circle
} from 'lucide-react';

interface TmuxSessionCardProps {
  session: TmuxSession;
  onAttach?: (sessionName: string) => void;
  onRename?: (sessionName: string) => void;
  onKill?: (sessionName: string) => void;
  onCreateWindow?: (sessionName: string) => void;
}

export function TmuxSessionCard({
  session,
  onAttach,
  onRename,
  onKill,
  onCreateWindow
}: TmuxSessionCardProps) {
  const [showKillDialog, setShowKillDialog] = useState(false);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUptime = (created: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(created).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleKillConfirm = () => {
    onKill?.(session.sessionName);
    setShowKillDialog(false);
  };

  return (
    <>
      <Card className="hover:bg-muted/30 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="font-mono flex items-center gap-2">
                <Circle
                  className={`h-2 w-2 ${
                    session.attached
                      ? 'fill-green-500 text-green-500'
                      : 'fill-gray-500 text-gray-500'
                  }`}
                />
                {session.sessionName}
              </CardTitle>
              <CardDescription>
                {session.windows} {session.windows === 1 ? 'window' : 'windows'} ·
                Uptime: {getUptime(session.created)}
              </CardDescription>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAttach?.(session.sessionName)}>
                  <Play className="mr-2 h-4 w-4" />
                  Attach
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRename?.(session.sessionName)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateWindow?.(session.sessionName)}>
                  <PlusSquare className="mr-2 h-4 w-4" />
                  New Window
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowKillDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Kill Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={session.attached ? 'default' : 'secondary'}>
              {session.attached ? 'Attached' : 'Detached'}
            </Badge>
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Session Details</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Name:</span> {session.sessionName}</p>
                    <p><span className="text-muted-foreground">Windows:</span> {session.windows}</p>
                    <p><span className="text-muted-foreground">Status:</span> {session.attached ? 'Attached' : 'Detached'}</p>
                    <p><span className="text-muted-foreground">Created:</span> {formatDate(session.created)}</p>
                    {session.lastActive && (
                      <p><span className="text-muted-foreground">Last Active:</span> {formatDate(session.lastActive)}</p>
                    )}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={() => onAttach?.(session.sessionName)}
            className="w-full"
            variant="outline"
          >
            <Play className="mr-2 h-4 w-4" />
            Attach to Session
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kill Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to kill the session "{session.sessionName}"?
              This will terminate all windows and processes in this session.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleKillConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kill Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
