# Component Showcase - Implementation Plan

**Branch**: `feat/component-showcase`
**Goal**: Build impressive, reusable UI components that demonstrate advanced terminal management patterns

## 📊 Status: Phase 1 Complete (100%)

✅ **Completed**:
- Professional icon system (Lucide React)
- TerminalCarousel component built and working
- shadcn/ui + Tailwind v4 setup
- All emojis replaced with icons
- **Fixed**: Terminal 0x0 dimension errors - Terminals now render even in grid mode
- **Fixed**: Carousel view mode integration - Overlay approach instead of conditional rendering
- **Fixed**: Hover card clipping - Added padding to prevent edge cutoff on zoom

📝 **Known Limitations**:
- Live terminal thumbnails not showing yet (falls back to terminal icons)
  - Thumbnail generation code exists but terminals have `visibility: hidden` in grid mode
  - Canvas capture may need terminals to be `position: absolute; left: -9999px` instead
  - Not critical - icon fallback works well

🔧 **Needs Fixing**:
- BroadcastMiddleware DataCloneError

**Latest Fixes** (Nov 14, 2025):

### Fix 1: Carousel Rendering (Partial)
- **Problem**: Terminals failed to spawn with "0x0 dimensions" error
- **Root Cause**: Carousel view used conditional rendering, preventing Terminal components from mounting
- **Solution**: Always render terminals and show carousel as overlay when `viewMode === 'grid'`
- **Files**: `src/SimpleTerminalApp.tsx:2285-2312`

### Fix 2: Terminal Container Height (Complete) ✅
- **Problem**: Containers had width but 0 height (`3440x0, parent: 3440x0`)
- **Root Cause**: Missing CSS for `.terminal-body-wrapper` - had no height defined
- **Diagnosis**: Enhanced logging showed parent chain: `terminal-container` (1162px ✓) → `terminal-body-wrapper` (0px ✗)
- **Solution**: Added flex layout CSS to `.terminal-body-wrapper` and `.terminal-body`
- **Files**: `src/SimpleTerminalApp.css:1219-1230`, `src/components/Terminal.tsx:332-362`

### Fix 3: Tailwind v4 PostCSS Integration (Complete) ✅
- **Problem**: Carousel view had no styling + PostCSS plugin error
- **Root Cause**:
  - Missing `postcss.config.js` for Tailwind processing
  - Tailwind v4 requires `@tailwindcss/postcss` instead of `tailwindcss` plugin
  - Old v3 syntax (`@tailwind` directives) incompatible with v4
- **Solution**:
  1. Created `postcss.config.js` with `@tailwindcss/postcss` plugin
  2. Installed `@tailwindcss/postcss` package
  3. Updated `src/index.css` to use v4 syntax (`@import "tailwindcss"`)
  4. Cleared Vite cache
- **Files**: `postcss.config.js` (new), `src/index.css:1`, `package.json`

### Fix 4: Hover Card Clipping (Complete) ✅
- **Problem**: Card edges get cut off when hovering (zoom effect clipped)
- **Root Cause**: `hover:scale-105` zooms card by 5% but parent has no padding
- **Solution**: Added `py-4` to CarouselContent and `px-2 mx-1` to CarouselItem
- **Files**: `src/components/showcase/TerminalCarousel.tsx:123,131,137`

**See**: `SHOWCASE_COMPLETE_SUMMARY.md` for details

---

## Philosophy

Create visually stunning, highly interactive components that:
- Push the boundaries of what's possible in a terminal manager
- Showcase shadcn/ui + Tailwind CSS capabilities
- Focus on user experience and animations
- Serve as portfolio pieces and inspiration for other projects

## Components to Build

### 1. TerminalCarousel Component
**Purpose**: Browse terminal sessions like a content carousel
**UI Framework**: shadcn/ui Carousel + xterm.js canvas snapshots

**Features**:
- Horizontal swipeable carousel of terminal thumbnails
- Live preview on hover (mini xterm.js instance)
- Auto-play mode with configurable interval
- Keyboard navigation (Arrow keys, Home, End)
- Click thumbnail to switch to full session
- Responsive: Stack on mobile, carousel on desktop

**shadcn/ui Components**:
- `Carousel`, `CarouselContent`, `CarouselItem`
- `Card` - Thumbnail wrapper
- `Badge` - Session status (active/idle)
- `HoverCard` - Live preview popup
- `Button` - Navigation arrows

**Implementation**:
```typescript
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import Autoplay from 'embla-carousel-autoplay';

export function TerminalCarousel({ sessions }: { sessions: Session[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));

  // Generate thumbnail from xterm.js canvas
  const generateThumbnail = (sessionId: string) => {
    const term = terminalRefs.current[sessionId];
    if (!term) return null;

    // Get canvas from xterm.js
    const canvas = term.element?.querySelector('canvas');
    if (!canvas) return null;

    // Scale down to thumbnail size
    const thumbnail = document.createElement('canvas');
    thumbnail.width = 300;
    thumbnail.height = 200;
    const ctx = thumbnail.getContext('2d');
    ctx?.drawImage(canvas, 0, 0, 300, 200);

    return thumbnail.toDataURL();
  };

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full max-w-5xl mx-auto"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
      <CarouselContent>
        {sessions.map((session, index) => (
          <CarouselItem key={session.id} className="md:basis-1/2 lg:basis-1/3">
            <Card
              className={cn(
                "cursor-pointer transition-all hover:scale-105",
                activeIndex === index && "ring-2 ring-primary"
              )}
              onClick={() => switchToSession(session.id)}
            >
              <CardContent className="p-4">
                <div className="relative">
                  <img
                    src={generateThumbnail(session.id) || '/placeholder.png'}
                    alt={session.name}
                    className="w-full h-40 object-cover rounded-md"
                  />
                  <Badge className="absolute top-2 right-2">
                    {session.status}
                  </Badge>
                </div>
                <h3 className="mt-2 font-semibold">{session.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {session.terminalType} • {formatUptime(session.created)}
                </p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
```

**Advanced Features**:
- **Live thumbnails**: Update every 5 seconds with fresh canvas snapshot
- **Swipe gestures**: Touch-friendly on mobile
- **Keyboard shortcuts**: `[` / `]` to navigate
- **Smooth transitions**: Framer Motion animations

---

### 2. SessionAnalyticsDashboard Component
**Purpose**: Visualize terminal usage with charts and statistics
**UI Framework**: shadcn/ui Chart components (Recharts integration)

**Features**:
- Command frequency heatmap (like GitHub contributions)
- Session duration over time (line chart)
- Terminal type distribution (pie chart)
- Top 10 most-used commands (bar chart)
- Real-time activity feed (live updates)

**shadcn/ui Components**:
- `Chart`, `ChartContainer`, `ChartTooltip`
- `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `Tabs` - Switch between chart views
- `Select` - Time range filter (Today, Week, Month, All)
- `ScrollArea` - Activity feed

**Implementation**:
```typescript
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SessionAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const analytics = useTerminalAnalytics(timeRange);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Command Frequency Heatmap */}
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Command Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <CommandHeatmap data={analytics.commandsByHour} />
        </CardContent>
      </Card>

      {/* Session Duration Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Session Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              duration: {
                label: "Duration (min)",
                color: "hsl(var(--chart-1))",
              },
            }}
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.sessionDurations}>
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="duration" fill="var(--color-duration)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Terminal Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Terminal Types</CardTitle>
        </CardHeader>
        <CardContent>
          <PieChartComponent data={analytics.terminalTypes} />
        </CardContent>
      </Card>

      {/* Top Commands */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {analytics.topCommands.map((cmd, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <code className="text-sm">{cmd.command}</code>
                <Badge variant="secondary">{cmd.count}</Badge>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Custom heatmap component (GitHub-style)
function CommandHeatmap({ data }: { data: HeatmapData[] }) {
  return (
    <div className="grid grid-cols-24 gap-1">
      {data.map((cell, i) => (
        <div
          key={i}
          className={cn(
            "w-3 h-3 rounded-sm transition-colors",
            getHeatmapColor(cell.count)
          )}
          title={`${cell.hour}:00 - ${cell.count} commands`}
        />
      ))}
    </div>
  );
}
```

**Data Collection**:
```typescript
// Hook to gather analytics
export function useTerminalAnalytics(timeRange: string) {
  const [analytics, setAnalytics] = useState<Analytics>({
    commandsByHour: [],
    sessionDurations: [],
    terminalTypes: [],
    topCommands: [],
  });

  useEffect(() => {
    // Parse terminal history from backend
    fetch(`/api/analytics?range=${timeRange}`)
      .then(res => res.json())
      .then(setAnalytics);
  }, [timeRange]);

  return analytics;
}
```

---

### 3. CollaborativeTerminal Component
**Purpose**: Multi-user terminal with live cursors (like Google Docs)
**UI Framework**: Custom xterm.js + WebSocket + shadcn/ui Avatars

**Features**:
- Multiple users in same terminal session
- Live cursor positions with user avatars
- Typing indicators (user name + cursor)
- Share session via unique URL token
- Read-only mode for viewers
- Chat sidebar for collaboration

**shadcn/ui Components**:
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Badge` - User status (active, away)
- `Sheet` - Chat sidebar
- `Input` - Chat message input
- `ScrollArea` - Chat history
- `Tooltip` - Cursor hover info

**Implementation**:
```typescript
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  name: string;
  color: string;
  cursorPosition: { row: number; col: number };
  avatar?: string;
}

export function CollaborativeTerminal({ sessionToken }: { sessionToken: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    // Join collaborative session
    const socket = io(`/collaborative/${sessionToken}`);

    socket.on('user-joined', (user: User) => {
      setUsers(prev => [...prev, user]);
      showToast(`${user.name} joined the session`);
    });

    socket.on('user-left', (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    socket.on('cursor-moved', ({ userId, position }) => {
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, cursorPosition: position } : u
      ));
    });

    socket.on('terminal-input', (data) => {
      termRef.current?.write(data);
    });

    return () => socket.disconnect();
  }, [sessionToken]);

  // Render user cursors as overlay
  const renderUserCursors = () => {
    return users.map(user => (
      <div
        key={user.id}
        className="absolute pointer-events-none"
        style={{
          left: `${user.cursorPosition.col * 9}px`, // Char width
          top: `${user.cursorPosition.row * 17}px`, // Line height
        }}
      >
        <Avatar className="w-6 h-6 border-2" style={{ borderColor: user.color }}>
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name[0]}</AvatarFallback>
        </Avatar>
        <span
          className="text-xs font-medium px-1 rounded"
          style={{ backgroundColor: user.color, color: 'white' }}
        >
          {user.name}
        </span>
      </div>
    ));
  };

  return (
    <div className="relative">
      <div id="terminal-container" className="relative" />
      <div className="absolute inset-0 pointer-events-none">
        {renderUserCursors()}
      </div>

      {/* Chat sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="absolute top-4 right-4">
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat ({users.length})
          </Button>
        </SheetTrigger>
        <SheetContent>
          <CollaborativeChat users={users} sessionToken={sessionToken} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Backend Support**:
```javascript
// backend/collaborative-session.js
io.of('/collaborative').on('connection', (socket) => {
  const { sessionToken } = socket.handshake.query;

  socket.join(sessionToken);

  socket.on('cursor-move', (position) => {
    socket.to(sessionToken).emit('cursor-moved', {
      userId: socket.id,
      position,
    });
  });

  socket.on('input', (data) => {
    socket.to(sessionToken).emit('terminal-input', data);
  });
});
```

---

### 4. TerminalThemeBuilder Component
**Purpose**: Visual theme editor with live preview
**UI Framework**: shadcn/ui Popover + Color pickers

**Features**:
- Live color picker for all 16 ANSI colors
- Background color/gradient selector
- Font family & size sliders
- Cursor style picker (block, underline, bar)
- Import themes from VS Code/iTerm2
- Export as JSON for sharing
- Theme gallery with presets

**shadcn/ui Components**:
- `Popover` - Color picker popup
- `Slider` - Font size, transparency
- `Select` - Font family, cursor style
- `Tabs` - Normal/Bright colors
- `Button` - Import, Export, Reset
- `Dialog` - Theme gallery

**Implementation**:
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { HexColorPicker } from 'react-colorful';

interface ThemeColors {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  background: string;
  foreground: string;
}

export function TerminalThemeBuilder() {
  const [theme, setTheme] = useState<ThemeColors>(defaultTheme);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('Menlo');
  const termRef = useRef<Terminal | null>(null);

  // Apply theme to live preview
  useEffect(() => {
    if (!termRef.current) return;

    termRef.current.options.theme = {
      ...theme,
      background: theme.background,
      foreground: theme.foreground,
    };
    termRef.current.options.fontSize = fontSize;
    termRef.current.options.fontFamily = fontFamily;
  }, [theme, fontSize, fontFamily]);

  const exportTheme = () => {
    const json = JSON.stringify({ theme, fontSize, fontFamily }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terminal-theme.json';
    a.click();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Color Pickers */}
      <div className="space-y-4">
        <h3 className="font-semibold">Theme Colors</h3>
        <Tabs defaultValue="normal">
          <TabsList>
            <TabsTrigger value="normal">Normal</TabsTrigger>
            <TabsTrigger value="bright">Bright</TabsTrigger>
          </TabsList>

          <TabsContent value="normal" className="grid grid-cols-4 gap-2">
            {Object.entries(theme).slice(0, 8).map(([key, color]) => (
              <ColorPickerButton
                key={key}
                label={key}
                color={color}
                onChange={(newColor) => setTheme({ ...theme, [key]: newColor })}
              />
            ))}
          </TabsContent>

          <TabsContent value="bright" className="grid grid-cols-4 gap-2">
            {Object.entries(theme).slice(8, 16).map(([key, color]) => (
              <ColorPickerButton
                key={key}
                label={key}
                color={color}
                onChange={(newColor) => setTheme({ ...theme, [key]: newColor })}
              />
            ))}
          </TabsContent>
        </Tabs>

        {/* Font Settings */}
        <div className="space-y-2">
          <Label>Font Size: {fontSize}px</Label>
          <Slider
            value={[fontSize]}
            onValueChange={([val]) => setFontSize(val)}
            min={8}
            max={24}
            step={1}
          />
        </div>

        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Menlo">Menlo</SelectItem>
              <SelectItem value="Monaco">Monaco</SelectItem>
              <SelectItem value="Courier New">Courier New</SelectItem>
              <SelectItem value="Fira Code">Fira Code</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={exportTheme}>Export Theme</Button>
          <Button variant="outline" onClick={() => setTheme(defaultTheme)}>
            Reset
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="space-y-4">
        <h3 className="font-semibold">Live Preview</h3>
        <div
          id="theme-preview"
          className="border rounded-lg p-4"
          style={{ backgroundColor: theme.background }}
        />
      </div>
    </div>
  );
}

function ColorPickerButton({ label, color, onChange }: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-12"
          style={{ backgroundColor: color }}
        >
          <span className="sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <HexColorPicker color={color} onChange={onChange} />
        <div className="p-2 text-xs text-center">{label}</div>
      </PopoverContent>
    </Popover>
  );
}
```

---

### 5. CommandPaletteSearch Component
**Purpose**: Fuzzy search across all terminal sessions and commands
**UI Framework**: shadcn/ui Command component (Cmd+K)

**Features**:
- Global search with `Cmd+K` / `Ctrl+K`
- Fuzzy search across:
  - Session names
  - Terminal output history
  - Recent commands
  - Spawn options
- Jump to result (session or command)
- Command preview in hover card
- AI-powered suggestions (mock for now)

**shadcn/ui Components**:
- `Command`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`
- `Dialog` - Command palette modal
- `HoverCard` - Command preview
- `Badge` - Result type (session, command, output)
- `Kbd` - Keyboard shortcuts

**Implementation**:
```typescript
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export function CommandPaletteSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const results = useFuzzySearch(search);

  // Open with Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search sessions, commands, output..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Sessions">
          {results.sessions.map(session => (
            <CommandItem
              key={session.id}
              onSelect={() => {
                jumpToSession(session.id);
                setOpen(false);
              }}
            >
              <TerminalIcon className="mr-2 h-4 w-4" />
              {session.name}
              <Badge variant="secondary" className="ml-auto">
                {session.terminalType}
              </Badge>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Recent Commands">
          {results.commands.map((cmd, i) => (
            <CommandItem
              key={i}
              onSelect={() => {
                copyToClipboard(cmd.command);
                setOpen(false);
              }}
            >
              <Code className="mr-2 h-4 w-4" />
              <code className="text-sm">{cmd.command}</code>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDistanceToNow(cmd.timestamp)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="AI Suggestions">
          {results.aiSuggestions.map((suggestion, i) => (
            <CommandItem key={i}>
              <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
              {suggestion.text}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Fuzzy search hook (using Fuse.js)
function useFuzzySearch(query: string) {
  const [results, setResults] = useState<SearchResults>({
    sessions: [],
    commands: [],
    aiSuggestions: [],
  });

  useEffect(() => {
    if (!query) {
      setResults({ sessions: [], commands: [], aiSuggestions: [] });
      return;
    }

    // Fuzzy search implementation
    const fuse = new Fuse(allData, {
      keys: ['name', 'command', 'output'],
      threshold: 0.3,
    });

    const searchResults = fuse.search(query);
    setResults(categorizeResults(searchResults));
  }, [query]);

  return results;
}
```

---

## Implementation Steps

### Phase 1: Setup (5 min)
1. Install shadcn/ui:
   ```bash
   npx shadcn@latest init
   ```
2. Install component dependencies:
   ```bash
   npx shadcn@latest add carousel card badge hover-card chart tabs select slider popover dialog command
   ```
3. Install additional packages:
   ```bash
   npm install recharts embla-carousel-autoplay react-colorful fuse.js date-fns
   ```

### Phase 2: Build Core Components (30 min)
1. **TerminalCarousel** (10 min)
   - Implement carousel with thumbnails
   - Add canvas snapshot logic
   - Keyboard navigation

2. **SessionAnalyticsDashboard** (10 min)
   - Build chart components
   - Create analytics hook
   - Heatmap visualization

3. **CommandPaletteSearch** (10 min)
   - Command dialog with fuzzy search
   - Keyboard shortcut (Cmd+K)
   - Result categorization

### Phase 3: Advanced Components (15 min)
1. **CollaborativeTerminal** (8 min)
   - Multi-user WebSocket setup
   - Cursor overlay rendering
   - Chat sidebar

2. **TerminalThemeBuilder** (7 min)
   - Color pickers
   - Live preview
   - Import/export

### Phase 4: Polish & Animations (10 min)
1. Add Framer Motion transitions
2. Responsive design testing
3. Dark mode verification
4. Accessibility audit (ARIA labels)

## File Structure

```
src/
├── components/
│   ├── showcase/
│   │   ├── TerminalCarousel.tsx
│   │   ├── SessionAnalyticsDashboard.tsx
│   │   ├── CollaborativeTerminal.tsx
│   │   ├── TerminalThemeBuilder.tsx
│   │   └── CommandPaletteSearch.tsx
│   └── ui/ (shadcn/ui components)
├── hooks/
│   ├── useTerminalAnalytics.ts
│   ├── useFuzzySearch.ts
│   └── useCollaboration.ts
└── lib/
    ├── analytics.ts
    ├── theme-presets.ts
    └── fuzzy-search.ts
```

## Testing Checklist

- [ ] Carousel auto-plays and stops on hover
- [ ] Analytics charts update in real-time
- [ ] Command palette opens with Cmd+K
- [ ] Theme builder exports valid JSON
- [ ] Collaborative cursors render correctly
- [ ] Mobile responsive (all components)
- [ ] Dark mode works
- [ ] Keyboard accessible

## Notes for Claude Code

When implementing:
1. **Performance**: Use React.memo for heavy components
2. **Animations**: Smooth 60fps transitions (Framer Motion)
3. **Accessibility**: ARIA labels, keyboard nav
4. **Responsive**: Mobile-first design
5. **Polish**: Shadows, gradients, hover states

Ready to build stunning UI components! ✨
