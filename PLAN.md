# PLAN.md - Terminal Tabs Roadmap

## 🚨 CURRENT STATUS - READ FIRST

**Status**: ✅ **ALL MAJOR BUGS FIXED** - Terminal spawning fully functional!

**Date**: November 7, 2025
**Session**: Debugging & fixing terminal spawn issues

### ✅ Bug #1: Commands Not Executing (FIXED)
**Issue**: Terminals spawned as empty bash shells instead of running commands (TFE, Micro Editor, etc.)

**Root Cause**: Backend `unified-spawn.js` handled `commands` array for `tui-tool` but NOT for `bash` terminals.

**Fix** (backend/modules/unified-spawn.js:463-467):
```javascript
// Handle bash terminals with commands array
else if (terminalType === 'bash' && config.commands && config.commands.length > 0) {
  config.command = config.commands.join(' && ');
}
```

### ✅ Bug #2: Working Directory Validation (FIXED)
**Issue**: Spawning silently failed when workingDir used `~` (e.g., `~/projects`)

**Root Cause**: `fs.stat()` doesn't expand tilde, validation failed on literal path `"~/projects"`

**Fix** (backend/modules/unified-spawn.js:318-326):
```javascript
// Expand ~ to home directory
if (workingDir.startsWith('~/')) {
  workingDir = path.join(os.homedir(), workingDir.slice(2));
  options.workingDir = workingDir;
}
```

**Also Added**: Error logging for failed validation to catch silent failures

### ✅ Bug #3: Duplicate Terminals (FIXED)
**Issue**: Each spawn created 2 tabs - one with ⏳ (stuck spawning), one with 🤖 (working)

**Root Cause**: React state updates are asynchronous. WebSocket `terminal-spawned` message arrived before `addTerminal()` state updated, so it couldn't find the placeholder and created a duplicate.

**The Fix** - Three-part solution:

1. **Added `requestId` tracking** (src/stores/simpleTerminalStore.ts:17):
```typescript
requestId?: string; // For matching placeholder with WebSocket response
```

2. **Backend passes through frontend's requestId** (backend/server.js:160-163):
```javascript
const result = await unifiedSpawn.spawn({
  ...data.config,
  requestId: data.requestId  // Pass through from frontend
});
```

3. **Used `useRef` to eliminate race condition** (src/SimpleTerminalApp.tsx:30, 399):
```typescript
// Synchronous ref - no race condition!
const pendingSpawns = useRef<Map<string, StoredTerminal>>(new Map())

// Store in ref BEFORE sending spawn (synchronous)
pendingSpawns.current.set(requestId, newTerminal)

// WebSocket handler checks ref FIRST (always finds it!)
let existingTerminal = pendingSpawns.current.get(message.requestId)
```

**Why this works**: `useRef` updates are synchronous (instant), unlike `useState` which queues updates. The ref is populated BEFORE the WebSocket message can possibly arrive, guaranteeing the placeholder is always found.

---

## 🎯 Completed Today

### Core Fixes
- ✅ Commands now execute for all terminal types (bash, TFE, Micro, LazyGit, etc.)
- ✅ Working directory paths with `~` properly expand
- ✅ No more duplicate terminals on spawn
- ✅ Validation errors now logged (no more silent failures)
- ✅ RequestId matching works reliably

### Code Quality
- ✅ Added extensive debug logging for troubleshooting
- ✅ Fixed race condition with synchronous ref pattern
- ✅ Improved error handling throughout spawn flow

### Files Modified
- `backend/modules/unified-spawn.js` - Command handling, path expansion, requestId support
- `backend/server.js` - RequestId passthrough
- `src/SimpleTerminalApp.tsx` - Ref-based spawn tracking, requestId matching
- `src/stores/simpleTerminalStore.ts` - Added requestId field
- `src/services/SimpleSpawnService.ts` - RequestId parameter support

---

## 📊 Test Status

**Working Terminal Types**:
- ✅ Bash (plain shell)
- ✅ TFE (Terminal File Explorer)
- ✅ Micro Editor
- ✅ Claude Code
- ✅ LazyGit
- ✅ All other terminals with commands

**Known Working Scenarios**:
- ✅ Single terminal spawn
- ✅ Multiple concurrent spawns
- ✅ Working directories with `~`
- ✅ Commands with arguments
- ✅ Fast successive spawns (no race conditions)

---

---

## 🎯 Vision

Create the **simplest, fastest web-based terminal interface** with browser-style tabs. Focus on reliability, speed, and mobile-friendliness over complex features.

---

## 📅 Release Roadmap

### v1.0 - MVP (✅ COMPLETE)
**Status**: Released November 7, 2025
- [x] Tab-based interface
- [x] Terminal spawning (15 types)
- [x] WebSocket I/O
- [x] Theme system
- [x] Footer-based terminal info (cleaner design)
- [x] Fixed stale terminal loading spinner bug

### v1.1 - Profile System & Persistence (✅ IN PROGRESS)
**Target**: Next session
**Strategy**: Windows Terminal-style profiles (not spawn-options.json)

**Design Decision**: Profile-based approach solves multiple problems:
- ✅ Working directory per profile (solves LazyGit/Claude in home folder issue)
- ✅ Theme/font/transparency per profile
- ✅ Default profile (what Ctrl+T spawns)
- ✅ Familiar UX from Windows Terminal
- ✅ Easy integration with TFE's --cwd flag

**Tasks**:
- [x] Backend has tmux session APIs
- [x] Identified working directory issue with current spawn system
- [ ] Create profiles store (migrate from spawn-options.json)
- [ ] Build minimal settings modal
- [ ] Implement tmux session reconnection
- [ ] Use abbreviated session names (cc-1, tmux-dev, etc.)
- [ ] Tab persistence with tmux sessions

### v1.2 - UX Improvements
**Target**: 2-3 weeks
- [ ] Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)
- [ ] Tab reordering (drag & drop)
- [ ] Tab context menu (close, close others, close right)
- [ ] Settings modal (edit spawn-options.json)
- [ ] Tab icons (show terminal type icon)

### v1.3 - Mobile Support
**Target**: 1 month
- [ ] Responsive CSS for tablets/phones
- [ ] Touch-friendly tab switching
- [ ] Mobile keyboard support
- [ ] Portrait/landscape layouts
- [ ] PWA manifest

### v2.0 - Advanced Features
**Target**: 2-3 months
- [ ] Split panes (horizontal/vertical)
- [ ] Tab groups/folders
- [ ] Search across terminals
- [ ] Command history
- [ ] Copy/paste improvements
- [ ] Export terminal output

---

## 🚀 Priority Tasks

### High Priority (Do First)

#### 0. Profile System (P0 - NEW!)
**Why**: Current spawn system can't set working directory before launching
**Problem**: LazyGit, Claude Code, TFE all launch in home folder with no way to choose

**Windows Terminal-Style Profiles**:
```typescript
interface Profile {
  id: string;
  name: string;          // "Claude Code", "Bash", "LazyGit", etc.
  command: string;       // "claude", "bash", "lazygit"
  terminalType: string;  // "claude-code", "bash", etc.
  workingDir: string;    // "~/projects", "~", etc.
  theme: string;         // "amber", "matrix", etc.
  transparency: number;  // 0-100
  icon: string;          // "🤖", "💻", etc.
  fontSize?: number;
  isDefault?: boolean;   // Default profile for Ctrl+T
}
```

**Minimal Settings Modal (Phase 1)**:
- Default Profile dropdown
- List of profiles with edit/delete
- Add new profile form
- Save to localStorage

**Phase 2 Features**:
- Import/export profiles
- Profile categories (Work/Personal/Tools)
- Per-profile fonts
- TFE integration (right-click folder → spawn profile here with --cwd)

**Migration Path**:
- Read spawn-options.json → convert to initial profiles
- Store profiles in localStorage
- Keep spawn-options.json as backup/example

**User Flow**:
1. Click + → Profile picker (not spawn menu)
2. Select profile → terminal spawns with profile settings
3. Ctrl+T → spawns default profile
4. TFE: right-click folder → "Open Claude Code here" → spawns profile with --cwd override

**Files**:
- Create `src/stores/useProfilesStore.ts`
- Create `src/components/SettingsModal.tsx`
- Create `src/components/ProfileEditor.tsx`
- Update `src/SimpleTerminalApp.tsx` - use profiles instead of spawn-options

**Estimate**: 3-4 hours

---

#### 1. Tmux Session Reconnection (P0)
**Why**: Users lose all terminals on refresh - bad UX
**Strategy**: Use tmux sessions for persistence (like opustrator)

**Tasks**:
- Fetch active tmux sessions from `/api/tmux/sessions`
- Match stored terminals to tmux sessions by sessionId/name
- Reconnect to existing sessions instead of spawning new
- Show "Reconnecting..." state during recovery

**Implementation Notes**:
- Backend already has full tmux session manager
- Each terminal spawns with `useTmux: true` and unique sessionName
- Use abbreviated names: `cc-1`, `oc-1`, `bs-1`, `tmux-dev`, etc.
- On WebSocket connect: check active sessions → reconnect → don't clear localStorage

**Files**:
- `src/SimpleTerminalApp.tsx` - Add reconnection logic
- `src/stores/simpleTerminalStore.ts` - Already has persistence

**Estimate**: 3-4 hours

---

#### 2. Keyboard Shortcuts (P0)
**Why**: Power users expect keyboard navigation
**Shortcuts**:
- `Ctrl+T` - New terminal (show spawn menu)
- `Ctrl+W` - Close active tab
- `Ctrl+Tab` / `Ctrl+Shift+Tab` - Switch tabs
- `Ctrl+1-9` - Jump to tab N
- `Ctrl+Shift+T` - Reopen last closed tab

**Files**:
- `src/SimpleTerminalApp.tsx` - Add keyboard event handlers
- Create `src/hooks/useKeyboardShortcuts.ts`

**Estimate**: 3-4 hours

---

#### 3. Remove Unused Canvas Code (P1)
**Why**: Still loading unnecessary components
**Tasks**:
- Remove unused stores (canvasStore, useUIStore, useAgentsStore)
- Remove unused components (Sidebar, FileTree, all Draggable*)
- Remove unused utils (backgroundUtils, terminalUtils)
- Clean up CSS (remove canvas-specific styles)

**Estimate**: 2-3 hours

---

### Medium Priority (Nice to Have)

#### 4. Settings Modal (P1)
**Features**:
- Edit spawn-options.json in Monaco editor
- Change default theme/transparency
- Configure keyboard shortcuts
- Set default working directory

**Files**:
- Create `src/components/SettingsModal.tsx`
- Add settings button to header

**Estimate**: 4-5 hours

---

#### 5. Tab Context Menu (P2)
**Features**:
- Right-click tab → context menu
- "Close", "Close Others", "Close to Right"
- "Rename Tab"
- "Duplicate Terminal"
- "Copy Terminal ID"

**Estimate**: 2-3 hours

---

#### 6. Mobile Responsive Design (P2)
**Tasks**:
- Media queries for tablets (< 1024px)
- Media queries for phones (< 768px)
- Touch-friendly tab bar
- Collapsible header on mobile
- Virtual keyboard handling

**Files**:
- `src/SimpleTerminalApp.css` - Add responsive styles
- Test on iOS Safari, Android Chrome

**Estimate**: 6-8 hours

---

### Low Priority (Future)

#### 7. Tmuxplexer Workspace Integration (P2)
**Status**: Design complete, integrates with profile system
**Strategy**: Tmuxplexer as a profile type

**Profile Definition**:
```typescript
{
  name: "Tmuxplexer",
  command: "tmuxplexer",
  terminalType: "bash",
  workingDir: "~",
  icon: "🎛️",
  theme: "default"
}
```

**User Flow**:
1. Click + → Select "Tmuxplexer" profile
2. Tmuxplexer TUI opens with template picker
3. Select workspace template (Projects/Agents/Tools)
4. Session created with multi-pane layout
5. Tab shows workspace name

**TFE Integration** (Phase 2):
- Right-click folder in TFE
- "Open Tmuxplexer Workspace Here"
- Launches with `tmuxplexer --cwd /path/to/folder`
- Creates workspace in selected directory

**Benefits**:
- Each tab can be a full tmux workspace (2x2, 4x2 grids)
- OR individual tools via other profiles
- Terminal panes = UI components (no React needed)
- Clean separation: tabs = workspaces, tmux = layouts
- Working directory control via profiles or TFE context menu

**Estimate**: 1 hour (just add as profile)

#### 8. Split Panes (P4 - Probably Won't Do)
**Decision**: Use tmux for splitting instead of app-level splits
**Why**: Tmux already does this perfectly, avoid duplication
**Alternative**: Tmuxplexer templates provide pre-configured layouts

---

#### 9. Tab Groups (P3)
**Features**:
- Group related terminals
- Collapse/expand groups
- Color-code groups

**Estimate**: 1-2 days

---

#### 10. Pop-Out Windows (P2)
**Why**: Multiple monitors, native window management, better multitasking

**Features**:
- Pop out tab to new window (`window.open()`)
- BroadcastChannel for cross-window communication
- Shared WebSocket connection (main window owns it)
- Restore tab when popup closes
- No browser extension needed

**Architecture**:
```
Main Window (localhost:5175)
  ├── WebSocket (ws://localhost:8127)
  ├── BroadcastChannel('terminal-tabs')
  └── Tab management

Popup Windows (localhost:5175/terminal.html?id=abc)
  ├── BroadcastChannel('terminal-tabs')
  └── xterm.js Terminal
```

**Implementation Steps**:
1. Create `public/terminal.html` - Standalone terminal page
2. Create `src/terminal-popup.tsx` - Popup entry point
3. Create `src/components/TerminalPopup.tsx` - Popup terminal wrapper
4. Add BroadcastChannel to SimpleTerminalApp.tsx:
   - Forward WebSocket messages → BroadcastChannel
   - Listen for popup messages → Send via WebSocket
5. Add pop-out button (⇱) to tab bar
6. Handle popup close → Optionally restore tab
7. Update Vite config for multi-page build

**Files to Create**:
- `public/terminal.html`
- `src/terminal-popup.tsx`
- `src/components/TerminalPopup.tsx`
- `src/utils/BroadcastChannelManager.ts`

**Benefits**:
- ✅ Native window management (drag to different monitors)
- ✅ No extension required (pure web APIs)
- ✅ Works in all modern browsers
- ✅ Each terminal can be full screen independently

**Gotchas**:
- ⚠️ Popup blockers (user must allow)
- ⚠️ Main window must stay open (owns WebSocket)
- ⚠️ Mobile behavior varies

**Estimate**: 4-6 hours (simpler than initially thought!)

---

## 🐛 Bug Fixes Needed

### Critical Bugs
1. **localStorage Clear on Mount** - Remove the `localStorage.clear()` hack from SimpleTerminalApp.tsx (line 68)
2. **Debug Logging** - Remove excessive console.log statements

### Minor Bugs
1. Tab bar overflows with many tabs (need scrolling or compression)
2. Connection status sometimes shows wrong state
3. Spawn menu doesn't close on Escape key

---

## 🎨 UI/UX Improvements

### Quick Wins
1. **Tab Close Animation** - Smooth fade out when closing
2. **Tab Hover Effects** - Show close button on hover only
3. **Loading States** - Better visual feedback during spawn
4. **Empty State** - Improve "No terminals" message with helpful tips
5. **Tab Width** - Dynamic width based on label length

### Design Polish
1. Add terminal type icon to each tab (use emoji from spawn-options)
2. Color-code tabs by terminal type (agent vs utility)
3. Show terminal status (active, idle, error) with colored dot
4. Tooltip on tab hover (show full name, type, status)

---

## 🔧 Technical Debt

### Code Quality
- [ ] Add TypeScript strict mode
- [ ] Remove unused imports
- [ ] Extract magic numbers to constants
- [ ] Add JSDoc comments to public APIs
- [ ] Consistent error handling

### Testing
- [ ] Unit tests for SimpleSpawnService
- [ ] Unit tests for simpleTerminalStore
- [ ] E2E tests for terminal spawning
- [ ] E2E tests for tab switching

### Performance
- [ ] Lazy load Terminal component
- [ ] Virtualize tab bar for 50+ tabs
- [ ] Debounce resize events
- [ ] Profile WebSocket message handling

---

## 📦 Dependencies to Consider

### Useful Additions
- `react-hotkeys-hook` - Better keyboard shortcut handling
- `dnd-kit` - For tab reordering (lightweight drag & drop)
- `zustand-persist` - Built-in localStorage persistence
- `@radix-ui/react-dropdown-menu` - Tab context menu

### Dependencies to Remove
- Many unused components still imported
- Can remove canvas-specific stores

---

## 🌐 Deployment Strategy

### Frontend Deployment (Vercel/Netlify)
```bash
# Build frontend
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod
```

### Backend Deployment (DigitalOcean/AWS/Railway)
```bash
# PM2 for process management
pm2 start backend/server.js --name terminal-tabs-backend

# Nginx reverse proxy
# /etc/nginx/sites-available/terminal-tabs
location /ws {
  proxy_pass http://localhost:8127;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

### Environment Variables
```bash
# Backend
PORT=8127
NODE_ENV=production

# Frontend (Vite)
VITE_WS_URL=wss://your-domain.com/ws
```

---

## 🎯 Success Metrics

### v1.1 Goals
- Tab persistence working for 95% of sessions
- < 500ms to restore session on refresh
- Zero data loss on refresh

### v1.2 Goals
- All keyboard shortcuts work correctly
- Tab reordering feels smooth (60fps)
- Settings modal can edit spawn-options without restart

### v1.3 Goals
- Works on iPad (1024x768)
- Works on iPhone (375x667)
- Touch gestures feel native

---

## 💡 Feature Ideas (Backlog)

### Community Requests (if we get users)
- [ ] Terminal search (Ctrl+F within terminal)
- [ ] Export terminal output to file
- [ ] Share terminal session (read-only URL)
- [ ] Terminal recording/playback
- [ ] Custom terminal colors per tab
- [ ] Tab bookmarks (save frequently used terminals)

### Integration Ideas
- [ ] GitHub Copilot in terminal
- [ ] AI command suggestions
- [ ] Claude directly in terminal (deeper integration)
- [ ] File tree sidebar (optional toggle)

---

## 🚫 Anti-Roadmap (Things We Won't Do)

1. **No Canvas Features** - Dragging, zooming, infinite workspace
2. **No App-Level Split Panes** - Use tmux for splitting (tmuxplexer templates)
3. **No Desktop App** - Web-first, not Electron
4. **No Multiplayer** - Single-user experience
5. **No Template Syncing** - Let tmuxplexer manage its own templates
6. **No React UI Components** - Use terminal panes as components instead
7. **No spawn-options.json** - Migrating to profile system instead

## 🎯 Design Principles

1. **Profile-Based** - Windows Terminal model (familiar, powerful)
2. **Context-Aware** - Working directory matters (TFE integration)
3. **Terminal-First** - Use TUI tools as components (tmuxplexer, TFE)
4. **Tmux-Powered** - Persistence via tmux sessions, not localStorage hacks
5. **Simple & Fast** - Web-based simplicity, terminal power

---

## 📝 Session Progress

**Completed This Session (Nov 7-8, 2025)**:

### ✅ Profile System Implementation
- ✅ Created `useProfilesStore.ts` - Zustand store with localStorage persistence
- ✅ Created `profileMigration.ts` - Auto-migrates from spawn-options.json
- ✅ Built `SettingsModal.tsx` - Full profile management UI (add/edit/delete/set default)
- ✅ Profile picker replaces spawn menu (shows DEFAULT badge)
- ✅ Ctrl+T spawns default profile directly
- ✅ Escape key closes profile picker
- ✅ Tab icons from profiles
- ✅ Removed debug console.logs
- ✅ Added `command` field to spawn config (SimpleSpawnService.ts & SimpleTerminalApp.tsx)

### ✅ Launch Scripts & Tooling
- ✅ Created `start.sh` - Background process launcher
- ✅ Created `stop.sh` - Clean shutdown script
- ✅ Created `start-tmux.sh` - Tmux session launcher (recommended for dev)
- ✅ Created `LAUNCHER.md` - Complete launch script documentation
- ✅ Added Dev Logs profile for viewing backend/frontend logs with lnav
- ✅ Created profile migration tools (HTML & JS)

### ✅ RESOLVED: Reverted to Simple spawn-options.json Approach

**Decision**: Removed complex profile system, use spawn-options.json directly
- spawn-options.json already IS a profile system
- Each entry = one "profile" (Claude Code, TFE, LazyGit, etc.)
- No localStorage issues, just edit one JSON file with micro
- Added `workingDir` field support for per-terminal working directories

**Why This is Better**:
- Single source of truth: `public/spawn-options.json`
- Easy to edit: `micro spawn-options.json`
- No migration/localStorage complexity
- First entry is default (Ctrl+T spawns Claude Code)
- Can version control your spawn options

**Example spawn-options.json Entry**:
```json
{
  "label": "TFE",
  "command": "tfe",
  "terminalType": "bash",
  "workingDir": "~/projects",
  "icon": "📁",
  "description": "Terminal File Explorer",
  "defaultTheme": "default",
  "defaultTransparency": 95
}
```

**Available Fields**:
- `label` - Display name in spawn menu
- `command` - Command to execute (e.g., "tfe", "claude", "lazygit")
- `terminalType` - Type identifier (e.g., "bash", "claude-code")
- `workingDir` - Starting directory (optional, defaults to ~)
- `icon` - Emoji icon for tab
- `description` - Description shown in spawn menu
- `defaultTheme` - Theme name (amber, matrix, dracula, etc.)
- `defaultTransparency` - Opacity 0-100

---

## 📋 Remaining v1.1 Tasks

**High Priority**:
- [ ] Implement tmux session reconnection
- [ ] Add abbreviated session naming (cc-1, bs-1, tmux-dev)
- [ ] Test terminals actually spawn now (TFE, Claude Code, Bash)

**Medium Priority**:
- [ ] Add tab context menu (right-click options)
- [ ] Tab reordering (drag & drop)
- [ ] Settings UI for editing spawn-options.json (future - optional)

---

**Last Updated**: November 8, 2025 - Evening Session

## 🔧 Current Session Status (Nov 8 Evening)

### ✅ Completed This Session:
1. **Removed broken profile/localStorage system** - Deleted `useProfilesStore.ts`, `profileMigration.ts`, old SettingsModal files
2. **Fixed double root folder** - Moved from `/projects/terminal-tabs/terminal-tabs/` to `/projects/terminal-tabs/`
3. **Fixed platform default** - Changed `platform: 'docker'` → `'local'` in `backend/routes/api.js:28`
4. **Created new SettingsModal** - Edits `public/spawn-options.json` via PUT `/api/spawn-options` endpoint
5. **Added commands array conversion** - Modified `SimpleTerminalApp.tsx:383-390` to convert `command` → `commands: [command]` like opustrator
6. **Updated TypeScript interfaces** - Added `commands`, `startCommand`, `toolName` to `SpawnConfig` in `SimpleSpawnService.ts:5-16`
7. **Added debug logging** - Console logs in frontend to trace spawn flow

### ⚠️ Current Issue - DEBUGGING:
**Problem**: Terminals spawn but commands don't execute (just empty bash shells)
**Root Cause**: `commands` array not reaching backend PTY handler
**Evidence**: Backend logs show `[PTYHandler] Command for bash: none`

**Debugging Steps Added**:
- Console.log in `SimpleTerminalApp.tsx:392` to see config before spawn
- Console.log in `SimpleSpawnService.ts:62` to see WebSocket message
- Need to check browser console to see where `commands` array is lost

**Next Step**: Check browser console logs when spawning terminal to trace data flow

### 📝 Files Modified This Session:
- `backend/routes/api.js` - Fixed platform default, added PUT `/api/spawn-options`
- `src/SimpleTerminalApp.tsx` - Added commands array conversion, SettingsModal integration
- `src/services/SimpleSpawnService.ts` - Updated interface, added debug logging
- `src/components/SettingsModal.tsx` - NEW: UI to manage spawn-options.json
- `src/components/SettingsModal.css` - NEW: Modal styling
- `src/SimpleTerminalApp.css` - Added settings button style
- `public/spawn-options.json` - Updated with workingDir field

### 🎯 What Should Work (Once Fixed):
- Spawning all terminal types ✓
- Settings UI (⚙️ button) to manage spawn options ✓
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab) ✓
- Command execution ⚠️ (debugging)
- Theme/transparency per terminal ✓
