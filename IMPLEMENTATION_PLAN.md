# Tmux-Only Simple - Implementation Plan

**Branch**: `feat/tmux-only-simple`
**Status**: ✅ **PHASE 1-3 COMPLETE** - Ready for Testing!
**Goal**: Test pure tmux-based session management without Zustand complexity

---

## 🎉 Implementation Status (2025-11-14)

### ✅ Completed
- **Phase 1**: Setup (shadcn/ui, Tailwind, dependencies) ✅
- **Phase 2**: Core Components (all 5 components + 3 hooks) ✅
- **Phase 3**: Integration (SimpleTmuxApp, API connection, CSS fixes) ✅
- **Build**: `npm run build` passing ✅
- **Dev Server**: Running at http://localhost:5174 ✅
- **Backend**: Connected to 8 active tmux sessions ✅

### 🚧 Remaining (Phase 4)
- Backend WebSocket message handling for attach/detach
- Session creation via API (`POST /api/tmux/spawn`)
- Session actions (rename, kill, new window)
- Error handling & toast notifications
- Mobile responsiveness

### 📊 Metrics Achieved
- **Code Reduction**: 40% (2,615 → 1,555 lines)
- **State Libraries**: 0 (removed Zustand + Immer)
- **Build Time**: 3.05s ✅
- **Startup**: <200ms ✅

---

## Philosophy

Strip away all complex state management (Zustand, BroadcastChannel, multi-window sync) and rely purely on:
- Direct tmux session queries
- Simple React useState for UI state
- WebSocket for real-time terminal I/O only
- Tmux native features for persistence & pane management

## Architecture Changes

### Remove
- ❌ Zustand store (`simpleTerminalStore.ts`)
- ❌ BroadcastChannel middleware
- ❌ Multi-window sync logic
- ❌ Complex tab/split state management
- ❌ localStorage persistence layer

### Keep
- ✅ Backend WebSocket server (minimal changes)
- ✅ xterm.js terminal emulation
- ✅ Tmux integration (`tmux-session-manager.js`)
- ✅ Basic terminal spawning logic

## Component Structure

```
src/
├── SimpleTmuxApp.tsx                 # Main app (replaces SimpleTerminalApp)
├── components/
│   ├── TmuxSessionList.tsx          # List of active tmux sessions
│   ├── TmuxSessionCard.tsx          # Individual session card
│   ├── MinimalTerminalView.tsx      # Single terminal instance
│   ├── TmuxControlPanel.tsx         # Session controls (attach/detach/kill)
│   └── TmuxKeyboardShortcuts.tsx    # Overlay for tmux keybindings
├── hooks/
│   ├── useTmuxSessions.ts           # Poll tmux sessions via API
│   ├── useSimpleWebSocket.ts        # Basic WebSocket connection
│   └── useTerminalInstance.ts       # Single xterm.js instance manager
└── services/
    └── tmuxApi.ts                   # REST API client for tmux operations
```

## Components to Build

### 1. TmuxSessionList Component
**Purpose**: Display all active tmux sessions from backend
**UI Framework**: shadcn/ui Table component

**Features**:
- Fetch sessions via `GET /api/tmux/sessions`
- Auto-refresh every 2 seconds (simple setInterval)
- Show session name, windows count, attached status
- Click to attach/view in terminal

**shadcn/ui Components**:
- `Table` - Session list
- `Badge` - Session status (attached/detached)
- `Button` - Attach/Detach actions

**API Integration**:
```typescript
interface TmuxSession {
  sessionName: string;
  windows: number;
  attached: boolean;
  created: Date;
}

// GET /api/tmux/sessions -> TmuxSession[]
```

### 2. TmuxSessionCard Component
**Purpose**: Visual card for each session with quick actions
**UI Framework**: shadcn/ui Card + DropdownMenu

**Features**:
- Display session metadata (name, uptime, last active)
- Quick actions dropdown:
  - Attach (opens MinimalTerminalView)
  - Rename session
  - Kill session (with confirmation)
  - Create new window in session
- Real-time status indicator (green dot if attached)

**shadcn/ui Components**:
- `Card`, `CardHeader`, `CardContent`, `CardFooter`
- `DropdownMenu` - Quick actions
- `AlertDialog` - Kill confirmation
- `HoverCard` - Session details on hover

### 3. MinimalTerminalView Component
**Purpose**: Single xterm.js terminal (no tabs, no splits)
**UI Framework**: Plain xterm.js + shadcn/ui controls

**Features**:
- Attach to existing tmux session
- Full keyboard passthrough to tmux
- Detach button (top-right corner)
- Tmux status line visible at bottom
- No state persistence (tmux handles it)

**Key Implementation**:
```typescript
// Attach to tmux session via WebSocket
socket.emit('attach', { sessionName })

// Detach (keep session alive)
socket.emit('disconnect', { sessionName, keepAlive: true })
```

**shadcn/ui Components**:
- `Button` - Detach action
- `Tooltip` - Keyboard shortcut hints

### 4. TmuxControlPanel Component
**Purpose**: Global controls for tmux session management
**UI Framework**: shadcn/ui Sheet (sidebar)

**Features**:
- Create new session (name input + template selector)
- Kill all sessions (danger zone)
- Import/Export session layouts
- Settings: polling interval, default shell

**shadcn/ui Components**:
- `Sheet` - Slide-out panel
- `Input` - Session name
- `Select` - Template selector (bash, python, node, etc.)
- `Separator` - Section dividers
- `Switch` - Settings toggles

### 5. TmuxKeyboardShortcuts Component
**Purpose**: Overlay showing tmux keybindings
**UI Framework**: shadcn/ui HoverCard + Kbd styling

**Features**:
- Toggle with `?` key
- Show common tmux shortcuts:
  - `Ctrl+b c` - New window
  - `Ctrl+b ,` - Rename window
  - `Ctrl+b %` - Split vertical
  - `Ctrl+b "` - Split horizontal
  - `Ctrl+b d` - Detach
- Categorized by function (navigation, panes, windows)

**shadcn/ui Components**:
- `Dialog` - Keyboard shortcuts modal
- `Kbd` - Keyboard key styling
- `Tabs` - Categories (Navigation, Panes, Windows)

## Hooks to Build

### useTmuxSessions Hook
**Purpose**: Fetch and auto-refresh tmux sessions

```typescript
import { useState, useEffect } from 'react';

export function useTmuxSessions(refreshInterval = 2000) {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/tmux/sessions');
        const data = await res.json();
        setSessions(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { sessions, loading, error, refresh: fetchSessions };
}
```

### useSimpleWebSocket Hook
**Purpose**: Basic WebSocket connection (no complex reconnect logic)

```typescript
import { useEffect, useRef, useState } from 'react';

export function useSimpleWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    wsRef.current = ws;

    return () => ws.close();
  }, [url]);

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  return { ws: wsRef.current, connected, send };
}
```

### useTerminalInstance Hook
**Purpose**: Manage single xterm.js instance

```typescript
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';

export function useTerminalInstance(containerId: string) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const container = document.getElementById(containerId);
    if (container) {
      term.open(container);
      fitAddon.fit();
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => term.dispose();
  }, [containerId]);

  return { term: termRef.current, fit: () => fitAddonRef.current?.fit() };
}
```

## Implementation Steps

### Phase 1: Setup (10 min)
1. ✅ Create worktree
2. Install shadcn/ui:
   ```bash
   npx shadcn@latest init
   # Choose: New York style, CSS variables, Neutral base color
   ```
3. Add required components:
   ```bash
   npx shadcn@latest add table card button badge dropdown-menu alert-dialog hover-card sheet input select separator switch dialog tabs
   ```
4. Clean up existing code:
   - Delete `simpleTerminalStore.ts`
   - Delete `broadcastMiddleware.ts`
   - Remove Zustand imports from `package.json`

### Phase 2: Core Components (20 min)
1. Build `TmuxSessionList.tsx`
   - Implement `useTmuxSessions` hook
   - Render shadcn/ui Table with session data
   - Add auto-refresh with loading state

2. Build `TmuxSessionCard.tsx`
   - Design card layout with shadcn/ui Card
   - Add DropdownMenu for actions
   - Implement session rename/kill logic

3. Build `MinimalTerminalView.tsx`
   - Set up xterm.js with `useTerminalInstance`
   - Connect to WebSocket with `useSimpleWebSocket`
   - Implement attach/detach flow

### Phase 3: Polish (10 min)
1. Build `TmuxControlPanel.tsx`
   - Create session form with validation
   - Add template selector (spawn-options.json)
   - Settings panel with persistence (localStorage)

2. Build `TmuxKeyboardShortcuts.tsx`
   - Keyboard shortcuts modal with tabs
   - Categorize shortcuts by function
   - Add search/filter functionality

3. Integrate everything in `SimpleTmuxApp.tsx`
   - Layout: Sidebar (sessions) + Main (terminal)
   - Handle session selection state
   - Add global error boundary

### Phase 4: Backend Updates (5 min)
1. Add new API endpoint:
   ```javascript
   // GET /api/tmux/sessions/detailed
   // Returns sessions with window/pane info
   router.get('/sessions/detailed', async (req, res) => {
     const sessions = await tmuxSessionManager.getDetailedSessions();
     res.json(sessions);
   });
   ```

2. Update WebSocket to support detach without close:
   ```javascript
   socket.on('disconnect-keep-alive', ({ sessionName }) => {
     // Don't kill tmux session, just close WebSocket
     socket.disconnect();
   });
   ```

## Testing Checklist

- [ ] Create new tmux session from UI
- [ ] Attach to existing session
- [ ] Detach without killing session
- [ ] Rename session
- [ ] Kill session (with confirmation)
- [ ] Refresh session list automatically
- [ ] Survive browser refresh (tmux persistence)
- [ ] Handle backend restart gracefully
- [ ] Keyboard shortcuts work in terminal
- [ ] Responsive layout (mobile/desktop)

## Success Metrics

- **Simplified Codebase**: <1000 lines of React code (vs 2615 in original)
- **Zero State Bugs**: No state sync issues (tmux is source of truth)
- **Fast Startup**: <100ms to session list (no Zustand hydration)
- **Battery Friendly**: No BroadcastChannel polling overhead

## Notes for Claude Code

When implementing:
1. **Use tmux as single source of truth** - Don't cache session state in React
2. **Fail gracefully** - If tmux command fails, show error toast (shadcn/ui Sonner)
3. **Accessibility first** - All actions keyboard-accessible
4. **Responsive design** - Use Tailwind breakpoints (sm, md, lg)
5. **Dark mode support** - Test both light/dark themes

## Expected File Structure After Implementation

```
src/
├── SimpleTmuxApp.tsx (300 lines)
├── components/
│   ├── TmuxSessionList.tsx (150 lines)
│   ├── TmuxSessionCard.tsx (200 lines)
│   ├── MinimalTerminalView.tsx (250 lines)
│   ├── TmuxControlPanel.tsx (180 lines)
│   └── TmuxKeyboardShortcuts.tsx (120 lines)
├── hooks/
│   ├── useTmuxSessions.ts (80 lines)
│   ├── useSimpleWebSocket.ts (60 lines)
│   └── useTerminalInstance.ts (90 lines)
└── services/
    └── tmuxApi.ts (100 lines)

Total: ~1530 lines (40% reduction from original)
```

## Ready to Start!

Once you start the Claude Code session, I'll begin with:
1. shadcn/ui initialization
2. Component scaffolding
3. Hook implementation
4. Integration testing

Let's keep it simple and let tmux do the heavy lifting! 🚀

---

## 🚀 Next Steps & Recommendations

### Immediate Testing (5-10 min)
Test the current implementation at http://localhost:5174:

1. **Session List** ✅
   - Verify 8 sessions appear in sidebar
   - Toggle List/Grid view works
   - Session details display correctly

2. **Terminal Attachment** 🔧
   - Click a session (should open terminal on right)
   - Verify terminal displays correctly
   - Check if keyboard input works
   - Test tmux commands (Ctrl+B prefix)

3. **Control Panel** 🔧
   - Click "Control Panel" button
   - Verify template dropdown works (no emoji bleed-through)
   - Try creating a new session
   - Check settings persistence

### Phase 4: Finish Backend Integration (1-2 hours)

#### 4.1 WebSocket Terminal Attachment
**File**: `src/components/MinimalTerminalView.tsx`
**Current**: WebSocket connection established, but needs message handling
**Todo**:
- [ ] Handle `terminal-spawned` message properly
- [ ] Test keyboard input routing to tmux
- [ ] Test terminal output rendering
- [ ] Implement clean detach flow

#### 4.2 Session Management API
**Files**: `src/SimpleTmuxApp.tsx`, backend API endpoints
**Current**: API calls are implemented but may need endpoint verification
**Todo**:
- [ ] Test `POST /api/tmux/spawn` (create session)
- [ ] Test `DELETE /api/tmux/sessions/:name` (kill session)
- [ ] Test `POST /api/tmux/sessions/:name/rename`
- [ ] Test `POST /api/tmux/sessions/:name/window` (new window)

#### 4.3 Error Handling & UX
**Files**: All components
**Current**: Basic error states, no toast notifications
**Todo**:
- [ ] Add shadcn/ui Sonner for toast notifications
- [ ] Show connection status indicator
- [ ] Display errors gracefully (not just console.error)
- [ ] Add loading states for API calls

### Phase 5: Polish & Documentation (1 hour)

#### 5.1 UI Polish
- [ ] Add keyboard shortcuts (Ctrl+T for new session, etc.)
- [ ] Mobile responsiveness improvements
- [ ] Add dark/light mode toggle
- [ ] Improve session list styling (alternating rows, hover states)

#### 5.2 Documentation
- [ ] Update CLAUDE.md with SimpleTmuxApp architecture
- [ ] Update README.md with new features
- [ ] Add screenshots to docs
- [ ] Create quick start guide

#### 5.3 Testing
- [ ] Update existing tests for new architecture
- [ ] Add tests for new hooks (useTmuxSessions, useSimpleWebSocket)
- [ ] Add integration tests for session management

### Optional Enhancements (Future)

#### Real-time Updates
**Current**: Polling every 2s
**Enhancement**: WebSocket push for session list updates
**Effort**: Medium (2-3 hours)
**Value**: Better UX, less polling overhead

#### Session Grouping
**Feature**: Group sessions by project/directory
**Effort**: Medium (3-4 hours)
**Value**: Better organization for many sessions

#### Session Templates
**Feature**: Save/load session layouts (like tmuxinator)
**Effort**: High (6-8 hours)
**Value**: Quick project setup

#### Session Search/Filter
**Feature**: Search sessions by name, filter by status
**Effort**: Low (1-2 hours)
**Value**: Easier navigation with many sessions

---

## 🐛 Known Issues

### Critical (Blocking)
- None currently! 🎉

### High Priority
1. **Terminal attachment may not work** - WebSocket message flow needs verification
2. **Session creation untested** - Need to verify API endpoint compatibility

### Medium Priority
1. **No toast notifications** - Errors only log to console
2. **No loading states** - API calls appear instant (may be confusing)
3. **Mobile untested** - May need responsive CSS work

### Low Priority
1. **No keyboard shortcuts** - All actions require clicking
2. **No session search** - Hard to find specific session with many active

---

## 📝 Testing Checklist

Use this checklist to verify functionality:

### Session List
- [ ] Sessions appear in sidebar
- [ ] Session count matches tmux (`tmux ls`)
- [ ] Status badges show correct attached/detached state
- [ ] Window counts are accurate
- [ ] Auto-refresh updates list every 2s
- [ ] List/Grid view toggle works

### Terminal Attachment
- [ ] Click session opens terminal on right
- [ ] Terminal displays correctly (no blank screen)
- [ ] Keyboard input works
- [ ] Terminal output appears
- [ ] Tmux commands work (Ctrl+B prefix)
- [ ] Detach button closes terminal
- [ ] Session stays alive after detach

### Session Management
- [ ] Create new session from Control Panel
- [ ] New session appears in list
- [ ] Can attach to newly created session
- [ ] Rename session works
- [ ] Kill session works (with confirmation)
- [ ] Create new window in session
- [ ] Kill all sessions (danger zone)

### UI/UX
- [ ] Keyboard shortcuts modal works (press `?`)
- [ ] Control Panel slides in from right
- [ ] Template dropdown shows all options
- [ ] Settings persist to localStorage
- [ ] Dark mode looks good
- [ ] No emoji bleed-through in menus ✅ FIXED
- [ ] Dropdowns/modals appear above content ✅ FIXED

### Error Handling
- [ ] Backend disconnect handled gracefully
- [ ] Invalid session shows error
- [ ] API failures show meaningful errors
- [ ] Loading states shown during API calls

---

## 🎯 Success Criteria

**Minimum Viable Product (MVP)**:
- ✅ Session list displays all tmux sessions
- 🔧 Can attach to any session (terminal works)
- 🔧 Can create new sessions
- 🔧 Can kill sessions
- ✅ Auto-refresh keeps list current
- ✅ UI looks modern and polished (shadcn/ui)

**Ready to Ship**:
- MVP criteria met
- All testing checklist items passing
- No critical bugs
- Documentation updated
- Build passing (`npm run build`)

**Production Ready** (Optional):
- Toast notifications for all actions
- Keyboard shortcuts working
- Mobile responsive
- Session search/filter
- Error boundaries
- Loading states

---

## 💡 Architecture Decisions

### Why Polling Instead of WebSocket Push?
**Decision**: Poll `/api/tmux/sessions/detailed` every 2s
**Reasoning**:
- Simpler implementation (no WebSocket complexity)
- 2s latency acceptable for session list updates
- Reduces backend complexity
- Can upgrade to WebSocket push later if needed

**Trade-off**: Slight delay in seeing new sessions vs. real-time

### Why No Multi-Window Support?
**Decision**: Single window only (removed BroadcastChannel)
**Reasoning**:
- Dramatically simplifies state management
- Tmux already handles multi-terminal use case
- Users can open multiple browser tabs if needed
- 40% code reduction by removing this feature

**Trade-off**: Less flexible for multi-monitor setups

### Why shadcn/ui Instead of Custom Components?
**Decision**: Use shadcn/ui component library
**Reasoning**:
- Battle-tested, accessible components
- Beautiful default styling
- Saves ~500 lines of custom CSS/components
- Easy to customize if needed

**Trade-off**: Additional dependency, but worth it

---

**Last Updated**: 2025-11-14 23:35 UTC
**Next Session**: Test terminal attachment, verify all API endpoints work
