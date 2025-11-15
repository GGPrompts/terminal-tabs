import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string;
  description: string;
}

const shortcuts = {
  navigation: [
    { keys: 'Ctrl+B n', description: 'Next window' },
    { keys: 'Ctrl+B p', description: 'Previous window' },
    { keys: 'Ctrl+B 0-9', description: 'Switch to window by number' },
    { keys: 'Ctrl+B w', description: 'List windows' },
    { keys: 'Ctrl+B f', description: 'Find window by name' },
    { keys: 'Ctrl+B l', description: 'Last active window' },
  ],
  panes: [
    { keys: 'Ctrl+B %', description: 'Split pane vertically' },
    { keys: 'Ctrl+B "', description: 'Split pane horizontally' },
    { keys: 'Ctrl+B o', description: 'Next pane' },
    { keys: 'Ctrl+B ;', description: 'Last active pane' },
    { keys: 'Ctrl+B x', description: 'Kill current pane' },
    { keys: 'Ctrl+B ↑↓←→', description: 'Navigate between panes' },
    { keys: 'Ctrl+B z', description: 'Toggle pane zoom' },
    { keys: 'Ctrl+B {', description: 'Move pane left' },
    { keys: 'Ctrl+B }', description: 'Move pane right' },
  ],
  windows: [
    { keys: 'Ctrl+B c', description: 'Create new window' },
    { keys: 'Ctrl+B ,', description: 'Rename current window' },
    { keys: 'Ctrl+B &', description: 'Kill current window' },
    { keys: 'Ctrl+B .', description: 'Move window to index' },
  ],
  sessions: [
    { keys: 'Ctrl+B d', description: 'Detach from session' },
    { keys: 'Ctrl+B s', description: 'List sessions' },
    { keys: 'Ctrl+B $', description: 'Rename session' },
    { keys: 'Ctrl+B (', description: 'Previous session' },
    { keys: 'Ctrl+B )', description: 'Next session' },
  ],
  misc: [
    { keys: 'Ctrl+B ?', description: 'List all key bindings' },
    { keys: 'Ctrl+B t', description: 'Show clock' },
    { keys: 'Ctrl+B [', description: 'Enter copy mode (scroll)' },
    { keys: 'Ctrl+B ]', description: 'Paste from buffer' },
    { keys: 'Ctrl+B :', description: 'Enter command mode' },
  ]
};

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
      {children}
    </kbd>
  );
}

function ShortcutList({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="space-y-3">
      {shortcuts.map((shortcut, index) => (
        <div key={index} className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground flex-1">
            {shortcut.description}
          </span>
          <Kbd>{shortcut.keys}</Kbd>
        </div>
      ))}
    </div>
  );
}

export function TmuxKeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  // Listen for ? key to toggle shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not focused in an input
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          setOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Keyboard className="h-4 w-4 mr-2" />
          Shortcuts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tmux Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Common tmux keybindings. Press <Kbd>?</Kbd> to toggle this dialog.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="navigation" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="panes">Panes</TabsTrigger>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="misc">Misc</TabsTrigger>
          </TabsList>

          <TabsContent value="navigation" className="mt-4">
            <ShortcutList shortcuts={shortcuts.navigation} />
          </TabsContent>

          <TabsContent value="panes" className="mt-4">
            <ShortcutList shortcuts={shortcuts.panes} />
          </TabsContent>

          <TabsContent value="windows" className="mt-4">
            <ShortcutList shortcuts={shortcuts.windows} />
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <ShortcutList shortcuts={shortcuts.sessions} />
          </TabsContent>

          <TabsContent value="misc" className="mt-4">
            <ShortcutList shortcuts={shortcuts.misc} />
          </TabsContent>
        </Tabs>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> All tmux commands start with the prefix{' '}
            <Kbd>Ctrl+B</Kbd>. Press the prefix, release, then press the command key.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
