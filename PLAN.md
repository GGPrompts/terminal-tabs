# PLAN.md - Terminal Tabs Roadmap

## 🚨 CURRENT STATUS - READ FIRST

**Status**: ✅ **CORE FUNCTIONALITY COMPLETE** - All major features working!

**Date**: November 8, 2025 (Updated - Evening)
**Version**: v1.1.0

### What's Working 🎉
- ✅ Terminal persistence (all tabs render after refresh)
- ✅ Tmux integration (sessions survive refresh)
- ✅ Per-tab customization (theme, transparency, font)
- ✅ Beautiful logging (Consola)
- ✅ All spawning bugs fixed
- ✅ Conditional scrollbar (tmux vs non-tmux)

### What's Left
See "Remaining Tasks" section below - all optional enhancements!

**For completed features, see [CHANGELOG.md](CHANGELOG.md)**

---

## 🎯 Remaining Tasks (Optional Enhancements)

All core functionality is complete. The items below are **nice-to-have** features for future sessions.

### High Priority (UX Improvements)

#### 1. Keyboard Shortcuts
**Why**: Power users expect keyboard navigation

**Shortcuts to implement**:
- `Ctrl+T` - New terminal (already works - spawns first option)
- `Ctrl+W` - Close active tab (already works)
- `Ctrl+Tab` / `Ctrl+Shift+Tab` - Next/previous tab (already works)
- `Ctrl+1-9` - Jump to tab N (already works)
- `Ctrl+Shift+T` - Reopen last closed tab (NOT IMPLEMENTED)

**Note**: Most keyboard shortcuts already work! Only missing reopen closed tab.

**Estimate**: 1-2 hours

---

#### 2. Tab Reordering (Drag & Drop)
**Why**: Users want to organize tabs visually

**Implementation**:
- Add `dnd-kit` library (lightweight drag & drop)
- Make tabs draggable
- Update terminal order in store on drop
- Persist new order to localStorage

**Files**:
- `src/SimpleTerminalApp.tsx` - Add drag/drop handlers
- `package.json` - Add dnd-kit dependency

**Estimate**: 3-4 hours

---

#### 3. Session Manager UI
**Why**: Reconnect to orphaned tmux sessions after refresh

**Features**:
- Query backend for active `tt-*` sessions on mount
- Show "Reconnect" banner for orphaned sessions
- Click session → reattach to existing tmux session
- Optional: auto-reconnect setting

**Backend API**: Already exists (`/api/tmux/sessions`)

**Estimate**: 2-3 hours

---

### Medium Priority (Visual Polish)

#### 4. Claude Code Theme Integration
**Why**: 6 specialized color palettes for Claude output

**Implementation**:
- Use existing `src/styles/claude-code-themes.ts`
- Add palette picker to customize modal
- Show palette variant (dark/light/high-contrast)

**Estimate**: 2-3 hours

---

#### 5. Tab Context Menu
**Why**: Right-click options for power users

**Features**:
- Right-click tab → context menu
- "Close", "Close Others", "Close to Right"
- "Rename Tab"
- "Duplicate Terminal"
- "Copy Terminal ID"

**Library**: `@radix-ui/react-dropdown-menu` or native `<dialog>`

**Estimate**: 2-3 hours

---

### Low Priority (Future)

#### 6. Mobile Responsiveness
**Why**: Make it work on tablets/phones

**Tasks**:
- Test on iPad (1024x768)
- Test on iPhone (375x667)
- Fix tab bar for small screens
- Touch-friendly controls
- Virtual keyboard handling

**Estimate**: 6-8 hours

---

#### 7. Light Theme Support
**Why**: Some users prefer light backgrounds

**Tasks**:
- Create light color palettes
- Create light background gradients
- Add light/dark mode toggle
- Ensure contrast meets WCAG AA

**Estimate**: 4-5 hours

---

#### 8. Code Cleanup
**Why**: Remove workarounds now that tmux is default

**Tasks**:
- Remove fake resize logic from Terminal.tsx
- Remove special TUI handling in theme changes
- Remove debug console.logs
- Clean up unused imports
- Add TypeScript strict mode

**Estimate**: 2-3 hours

---

## 📋 Archived (Completed or Obsolete)

The sections below document fixes and decisions from previous sessions.
See [CHANGELOG.md](CHANGELOG.md) for completed feature details.

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

## 📅 Release History

### v1.1 - Persistence & Customization (✅ COMPLETE)
**Released**: November 8, 2025

- [x] Terminal persistence through refresh
- [x] Tmux integration with toggle
- [x] Per-tab customization (theme, transparency, font)
- [x] Beautiful logging with Consola
- [x] Conditional scrollbar
- [x] All spawning bugs fixed
- [x] Settings modal for spawn-options.json

### v1.0 - MVP (✅ COMPLETE)
**Released**: November 7, 2025

- [x] Tab-based interface
- [x] Terminal spawning (15 types)
- [x] WebSocket I/O
- [x] Theme system
- [x] Footer-based terminal info

### v1.2 - UX Improvements (PLANNED)
**Target**: When requested

See "Remaining Tasks" section above for:
- Tab reordering (drag & drop)
- Tab context menu (close others, rename, etc.)
- Session manager UI
- Claude Code theme integration
- Mobile responsiveness

### v2.0 - Advanced Features (FUTURE)
**Target**: TBD

- Split panes (or tmuxplexer integration)
- Tab groups/folders
- Search across terminals
- Export terminal output
- Light theme support

---

## 🚀 Priority Tasks (ARCHIVED - See "Remaining Tasks" Section Above)

The detailed task lists below are archived. See the "Remaining Tasks" section at the top for current priorities.

<details>
<summary>Click to expand archived task details</summary>

### High Priority (Do First) - OBSOLETE

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

</details>

---

## 🐛 Bug Fixes Needed (ARCHIVED - All Fixed in v1.1)

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

**Last Updated**: November 8, 2025 - Evening
**Status**: Core functionality complete (v1.1.0) - See CHANGELOG.md for details

## 🔧 Current Session Status (Nov 8 Late Evening)

### ✅ Completed This Session - Footer Customization Features:
**Session Goal**: Add live terminal customization controls to footer

1. **Font Settings in Spawn Options Manager** ✅
   - Added `defaultFontFamily` dropdown (JetBrains Mono, Fira Code, Source Code Pro, etc.)
   - Added `defaultFontSize` field (10-24px range)
   - New terminals spawn with custom font defaults from spawn-options.json

2. **Always-Visible Font Size Controls** ✅
   - Added `[-]` and `[+]` buttons in footer for quick font size adjustment
   - Shows current font size (e.g., "14px")
   - Buttons disabled at min (10px) and max (24px) limits
   - Changes saved per-terminal in localStorage

3. **Refit Terminal Button** ✅
   - Added 🔄 button to footer to fix blank/stuck terminal displays
   - Calls proper `refit()` method on Terminal component
   - Triggers `fitAddon.fit()`, refreshes display, and sends new dimensions to backend
   - Solves blank screen issues that previously required manual resize

4. **Expandable Customization Panel** ✅
   - Added 🎨 button to toggle advanced customization panel
   - **Theme selector**: Choose from 10+ themes (amber, matrix, dracula, cyberpunk, etc.)
   - **Transparency slider**: 0-100% with live preview
   - **Font family dropdown**: Change fonts on-the-fly
   - All changes apply instantly to active terminal
   - Auto-refit after theme change (350ms delay) to prevent blank screens

5. **UI Improvements** ✅
   - Footer now uses spawn option icon instead of generic terminal type icon
   - Added `fontFamily` field to terminal state (src/stores/simpleTerminalStore.ts)
   - Font family tracked per-terminal and persists in localStorage
   - Smooth hover effects and visual feedback on all controls
   - Glassmorphic styling for customization panel

### 🐛 Bug Fixes This Session:
1. **Font family changes now work** - Added state tracking and proper handler
2. **Theme changes no longer cause blank screens** - Added refit with 350ms delay
3. **Refit button actually works** - Exposed proper refit() method from Terminal component

### 📝 Files Modified:
- `src/components/SettingsModal.tsx` - Added font family/size fields to form
- `src/components/Terminal.tsx` - Added `refit()` method and `initialFontFamily` prop
- `src/SimpleTerminalApp.tsx` - Added footer controls, handlers, and customization panel UI
- `src/SimpleTerminalApp.css` - Added styles for footer controls and customization panel
- `src/stores/simpleTerminalStore.ts` - Added `fontFamily` field to Terminal interface

### 🎯 What Works Now:
- ✅ Font size +/- buttons for quick adjustments
- ✅ Refit button fixes blank/stuck terminals
- ✅ Live theme changes with auto-refit
- ✅ Live transparency changes
- ✅ Live font family changes
- ✅ Font settings in spawn options (defaultFontFamily, defaultFontSize)
- ✅ All settings persist per-terminal in localStorage

---

## 🔧 Previous Session Status (Nov 8 Evening)

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

---

## 🧹 Opustrator Legacy Code Cleanup (November 8, 2025)

**Status:** ✅ **COMPLETED**

### Overview
Successfully completed comprehensive cleanup of Opustrator legacy code, removing ~1,000 lines while preserving all core functionality and user settings.

### Phase 1: Rebranding ✅
**Completed:** November 8, 2025

- ✅ Rebranded from "Terminal Tabs" to "Tabz (Tab>_)"
- ✅ Updated package.json names (tabz, tabz-backend)
- ✅ Updated all documentation (README, CLAUDE.md)
- ✅ Renamed tmux session: `terminal-tabs` → `tabz`
- ✅ Updated scripts (start-tmux.sh, stop.sh)
- ✅ Removed dockerode dependency + 42 packages (~10MB)
- ✅ Deleted `backend/routes/workspace.js` (already disabled)
- ✅ Updated environment variables: `OPUSTRATOR_*` → `TABZ_*`
- ✅ Updated error boundary title
- ✅ Updated all comments and branding

**Lines Removed:** ~500 lines

### Phase 2: Backend API Cleanup ✅
**Completed:** November 8, 2025

- ✅ Removed `/api/layouts` endpoints (GET, POST, PUT, DELETE) - 103 lines
- ✅ Deleted `backend/modules/layout-manager.js` - 137 lines
- ✅ Removed layout-manager imports from server.js and api.js
- ✅ Removed `saveLayoutSchema` validation schema
- ✅ Updated tmux-session-manager.js groupings (opustrator → tabz)
- ⚠️ **KEPT** `/api/agents` endpoints for future bubbletea TUI spawn menu

**Lines Removed:** ~240 lines

**Decision:** Kept `/api/agents` REST endpoints because they'll be useful for the planned bubbletea TUI spawn menu that will allow spawning terminals in tmux splits.

### Phase 3: Frontend Store Cleanup ✅
**Completed:** November 8, 2025

**Group 1: Canvas Background Animation Settings**
- ✅ Removed `BackgroundTheme` type (15 animated canvas backgrounds)
- ✅ Removed `backgroundTheme`, `backgroundOpacity` settings
- ✅ Removed `canvasTexture`, `canvasTextureIntensity`, `idleTimeout`, `staticGradient`
- ✅ Removed `backgroundThemes` export array (50 lines)
- ✅ Removed `staticGradients` export array (14 lines)

**Group 2: Grid/Snapping Settings**
- ✅ Removed `gridEnabled`, `gridSize`, `snapToGrid`

**Group 3: File Viewer/Monaco Settings**
- ✅ Removed `fileViewerDefaultFontSize`, `fileViewerDefaultTransparency`
- ✅ Removed `fileViewerDefaultTheme`, `fileViewerDefaultFontFamily`
- ✅ Removed `fileTreeMaxDepth`, `fileTreeLazyLoad`, `fileTreeSearchMaxDepth`
- ✅ Removed `defaultCardSize`, `defaultFileViewerSize`

**Group 4: Canvas Navigation Settings**
- ✅ Removed `wasdBaseSpeed`, `forceZoomTo100OnSpawn`
- ✅ Removed `closeTerminalsOnLayoutSwitch`, `minimapOpacity`
- ✅ Removed `seenFlags.wasdNavigation`

**Lines Removed:** ~120 lines

### localStorage Migration ✅
**Completed:** November 8, 2025

- ✅ Renamed: `opustrator-settings` → `tabz-settings`
- ✅ Added automatic migration function that runs before store creation
- ✅ Preserves all user settings (no data loss)
- ✅ Updated all hardcoded references in AppErrorBoundary and SimpleTerminalApp
- ✅ Safe fallback if migration fails

**User Impact:** Zero - settings automatically migrated on first load

### PWA & Branding Updates ✅
**Completed:** November 8, 2025

- ✅ App header: "Tab>_" with `>_` terminal icon as Z
- ✅ Browser tab title: "Tabz"
- ✅ PWA manifest.json: "Tabz"
- ✅ Apple mobile web app title: "Tabz"
- ✅ GitHub repo renamed: `terminal-tabs` → `Tabz`
- ✅ Git remote URL updated to new repo name

### Final Statistics

**Git Commits:**
```
f609969 - refactor: rebrand to Tabz and remove Opustrator legacy code
afe40b5 - chore: update app title and PWA metadata to Tabz
6910c74 - style: use terminal icon as Z in app title (Tab>_)
e83df49 - fix: update GitHub repo link to capital Tabz
```

**Code Changes:**
- 17 files modified
- 110 insertions(+), 1,031 deletions(-)
- 2 files deleted
- 43 npm packages removed

**Dependencies:**
- Removed: dockerode + 42 dependencies (~10MB)
- New total: ~74 packages (down from ~117)

**Backend:**
- 2 route files deleted (workspace.js, layout-manager.js)
- 8 API endpoints removed
- 3 unused module imports removed

**Frontend:**
- Canvas animation code: 85 lines removed
- Grid/snap settings: 6 lines removed
- File viewer settings: 18 lines removed
- Canvas navigation: 12 lines removed
- Total store cleanup: ~120 lines

### What Was Kept (By Design)

**Backend - For Future Features:**
- ✅ `/api/agents` endpoints - Needed for bubbletea TUI spawn menu
- ✅ `/api/spawn-options` - Used by settings modal
- ✅ `/api/tmux/*` endpoints - Core tmux functionality

**Frontend - Core Features:**
- ✅ Terminal backgrounds (CSS gradients) - These are per-terminal, NOT canvas
- ✅ Per-terminal transparency - NOT canvas background opacity
- ✅ All terminal customization (theme, font, size, family)
- ✅ Tmux persistence and session management
- ✅ WebSocket communication
- ✅ Settings persistence via localStorage

### Lessons Learned

**What Worked Well:**
1. **Phased approach** - 3 separate phases reduced risk
2. **User confirmation** - Asked before removing each group
3. **Migration logic** - Preserved user settings automatically
4. **Comprehensive testing** - Tested after each phase
5. **Documentation** - Detailed audit document guided the work

**Technical Decisions:**
1. **Kept `/api/agents`** - Will be useful for TUI spawn menu
2. **Separated concepts** - Terminal backgrounds ≠ canvas backgrounds
3. **Automated migration** - Better UX than forcing reset
4. **Safe commits** - Each phase was a separate commit for easy rollback

### Next Steps

**Remaining Work (Not Part of Cleanup):**
1. **Fix tmux footer controls** - Split/window buttons don't work
   - See: `NEXT_SESSION_PROMPT.md` for detailed plan
2. **Build bubbletea TUI spawn menu** - Use `/api/agents` for tmux spawning
3. **Tab layouts feature** - Save/restore tab setups (new feature)

**Documentation:**
- ✅ OPUSTRATOR_LEGACY_AUDIT.md - Detailed audit + completion notes
- ✅ CLAUDE.md - Updated with cleanup section
- ✅ PLAN.md - This document
- ✅ NEXT_SESSION_PROMPT.md - Ready for tmux controls fix

---

**Cleanup Completed By:** Claude Code (Sonnet 4.5)  
**Date:** November 8, 2025  
**Duration:** Single session (~2 hours)  
**Repository:** https://github.com/GGPrompts/Tabz
