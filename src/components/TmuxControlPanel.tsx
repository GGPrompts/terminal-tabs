import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Settings, PlusCircle, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TmuxControlPanelProps {
  onCreateSession?: (name: string, template: string) => void;
  onKillAllSessions?: () => void;
}

interface SpawnTemplate {
  label: string;
  command: string;
  terminalType: string;
  icon: string;
  description: string;
}

const DEFAULT_TEMPLATES: SpawnTemplate[] = [
  { label: 'Bash', command: 'bash', terminalType: 'bash', icon: '🔧', description: 'Standard bash shell' },
  { label: 'Zsh', command: 'zsh', terminalType: 'zsh', icon: '⚡', description: 'Z shell' },
  { label: 'Python', command: 'python3', terminalType: 'python', icon: '🐍', description: 'Python REPL' },
  { label: 'Node.js', command: 'node', terminalType: 'node', icon: '📦', description: 'Node.js REPL' },
  { label: 'Claude Code', command: 'claude', terminalType: 'claude-code', icon: '🤖', description: 'Claude Code CLI' },
];

export function TmuxControlPanel({ onCreateSession, onKillAllSessions }: TmuxControlPanelProps) {
  const [sessionName, setSessionName] = useState('');
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState('0');
  const [templates, setTemplates] = useState<SpawnTemplate[]>(DEFAULT_TEMPLATES);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState('2000');
  const [showKillAllDialog, setShowKillAllDialog] = useState(false);

  // Load templates from spawn-options.json
  useEffect(() => {
    fetch('/spawn-options.json')
      .then(res => res.json())
      .then(data => {
        if (data.spawnOptions && Array.isArray(data.spawnOptions)) {
          setTemplates(data.spawnOptions);
        }
      })
      .catch(err => {
        console.warn('Failed to load spawn-options.json, using defaults:', err);
      });
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedAutoRefresh = localStorage.getItem('tmux-auto-refresh');
    const savedInterval = localStorage.getItem('tmux-refresh-interval');

    if (savedAutoRefresh !== null) {
      setAutoRefresh(savedAutoRefresh === 'true');
    }
    if (savedInterval) {
      setRefreshInterval(savedInterval);
    }
  }, []);

  // Save settings to localStorage
  const handleAutoRefreshChange = (checked: boolean) => {
    setAutoRefresh(checked);
    localStorage.setItem('tmux-auto-refresh', String(checked));
  };

  const handleIntervalChange = (value: string) => {
    setRefreshInterval(value);
    localStorage.setItem('tmux-refresh-interval', value);
  };

  const handleCreateSession = () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    const templateIndex = parseInt(selectedTemplateIndex);
    const selectedTemplate = templates[templateIndex];

    if (!selectedTemplate) {
      alert('Invalid template selected');
      return;
    }

    // Pass the template label or terminalType to parent
    onCreateSession?.(sessionName, selectedTemplate.label);
    setSessionName('');
  };

  const handleKillAll = () => {
    onKillAllSessions?.();
    setShowKillAllDialog(false);
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Control Panel
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tmux Control Panel</SheetTitle>
            <SheetDescription>
              Create new sessions and manage global settings
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Create New Session */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Create New Session</h3>

              <div className="space-y-2">
                <label htmlFor="session-name" className="text-sm font-medium">
                  Session Name
                </label>
                <Input
                  id="session-name"
                  placeholder="my-session"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSession();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="template" className="text-sm font-medium">
                  Template
                </label>
                <Select value={selectedTemplateIndex} onValueChange={setSelectedTemplateIndex}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template, index) => (
                      <SelectItem key={`${template.label}-${index}`} value={String(index)}>
                        <span className="flex items-center gap-2">
                          <span>{template.icon}</span>
                          <span>{template.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {templates[parseInt(selectedTemplateIndex)]?.description}
                </p>
              </div>

              <Button onClick={handleCreateSession} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Session
              </Button>
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Settings</h3>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label htmlFor="auto-refresh" className="text-sm font-medium">
                    Auto Refresh
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Automatically refresh session list
                  </p>
                </div>
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={handleAutoRefreshChange}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="refresh-interval" className="text-sm font-medium">
                  Refresh Interval (ms)
                </label>
                <Select value={refreshInterval} onValueChange={handleIntervalChange}>
                  <SelectTrigger id="refresh-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1 second</SelectItem>
                    <SelectItem value="2000">2 seconds</SelectItem>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>

              <Button
                onClick={() => setShowKillAllDialog(true)}
                variant="destructive"
                className="w-full"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Kill All Sessions
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showKillAllDialog} onOpenChange={setShowKillAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kill All Sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate ALL tmux sessions and their processes.
              This action cannot be undone. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleKillAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kill All Sessions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
