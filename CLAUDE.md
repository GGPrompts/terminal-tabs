# CLAUDE.md - Tabz

## 🎯 Project Overview

Tabz (Tab>_) is a **lightweight, tab-based terminal interface** for the web. Built with React, TypeScript, and xterm.js, it provides a simple alternative to complex canvas-based terminal managers.

**Version**: 1.1.0
**Status**: Multi-Window + Split Terminals Complete ✅
**Architecture**: Tab-based UI with WebSocket terminal backend
**Extracted from**: [Opustrator](https://github.com/GGPrompts/opustrator) v3.14.2
**Cleanup Complete**: November 8, 2025 - Removed ~1,000 lines of Opustrator legacy code

---

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
```
src/
├── SimpleTerminalApp.tsx       # Main app with tab bar
├── components/
│   └── Terminal.tsx            # xterm.js terminal component
├── stores/
│   ├── simpleTerminalStore.ts  # Zustand store (terminals array)
│   └── useSettingsStore.ts     # Global settings
├── services/
│   └── SimpleSpawnService.ts   # Minimal spawning service
├── styles/
│   └── terminal-themes.ts      # 14 terminal themes
└── types.ts                    # Shared TypeScript types
```

### Backend (Node.js + Express + PTY)
```
backend/
├── server.js                   # Express + WebSocket server
├── modules/
│   ├── terminal-registry.js    # Terminal state management
│   ├── pty-handler.js          # PTY process spawning
│   └── unified-spawn.js        # Terminal spawning logic
└── routes/
    └── api.js                  # REST API endpoints
```

### Communication
- **WebSocket**: Real-time terminal I/O
- **REST API**: Terminal management, file operations

---

## 🎨 Core Principles

1. **Simplicity Over Features** - Minimal, focused functionality
2. **Tab-Based Only** - No canvas, no dragging, no zoom complexity
3. **Fast & Lightweight** - ~74 npm packages (vs 200+ in Opustrator)
4. **Mobile-Friendly** - Works on tablets/phones (future goal)
5. **Easy to Deploy** - Frontend (Vercel/Netlify) + Backend (any VPS)

---

## 📐 Development Rules

### ALWAYS:
1. **Keep It Simple** - If it adds complexity, think twice
2. **Test Terminal Types** - Verify Claude Code, Bash, TFE work
3. **Mobile-First CSS** - Use responsive design patterns
4. **Document Changes** - Update README.md and this file
5. **No Canvas Code** - This is the tab-based version, no dragging/zoom

### NEVER:
1. **Don't Add Canvas Features** - Dragging, resizing, zoom, pan = NO
2. **Don't Import from Opustrator Canvas Code** - Keep it independent
3. **Don't Over-Engineer** - Simple solutions win
4. **Don't Break WebSocket Protocol** - Backend compatibility is critical

---

## 🚀 Key Features (MVP Complete)

✅ **Tab-Based Interface** - Browser-style tabs for terminals
✅ **Multi-Window Support** - Move tabs between browser windows for multi-monitor setups
✅ **Split Terminals** - Split tabs horizontally/vertically with independent panes
✅ **15 Terminal Types** - Claude Code, Bash, TFE, LazyGit, etc.
✅ **Full Terminal Emulation** - xterm.js with WebGL rendering
✅ **WebSocket Communication** - Real-time I/O
✅ **Theme System** - 14 themes with aliases (amber, matrix, etc.)
✅ **Spawn Menu** - Right-click spawn with 15 options
✅ **Connection Status** - WebSocket connection indicator

---

## 📋 Current State

### What Works
- Spawning terminals (Claude Code, Bash, TFE tested)
- Tab switching
- Terminal I/O (keyboard input, output display)
- WebSocket auto-reconnect
- Basic styling (glassmorphic panels)
- Spawn menu with 15 terminal types
- **Tab persistence** - Terminals persist through refresh with tmux sessions
- **Per-tab customization** - Font size, theme, transparency persist per tab
- **Conditional scrollbar** - Hidden with tmux (default), visible without
- **Multi-window support** - Move tabs between browser windows with ↗ button
- **Split terminals** - Horizontal/vertical splits with drag-to-resize
- **Window isolation** - Each browser window independently manages its terminals
- **Chrome side panel integration** - Perfect for multi-monitor setups with Chrome's built-in split view + reading list

### What Needs Work
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)
- Tab reordering (drag tabs) - currently can only drag to split
- Mobile responsiveness improvements

---

## 🪟 Multi-Window Support

**NEW in v1.1.0** - Move terminals between browser windows for multi-monitor setups!

### How It Works

Each browser window/tab has a unique ID tracked in the URL (`?window=<id>`):
- **Main window**: `?window=main` (or no parameter)
- **Additional windows**: `?window=window-1762685xxx-abc123`

Terminals are assigned to specific windows via the `windowId` property. Each window only shows and connects to its own terminals.

### Using Multi-Window

1. **Move a tab to new window**: Click the ↗ button on any tab
   - Tab disappears from current window
   - New browser window opens with that tab
   - Terminal session stays connected via tmux

2. **Multi-monitor setup**:
   - Click ↗ on tabs you want on second monitor
   - Drag new window to second monitor
   - Each window independently manages its terminals

3. **Chrome side panel workflow** (highly recommended):
   - Use Chrome's built-in side panel / reading list
   - Split main window with side panel showing different terminals
   - Organize terminals across multiple splits and windows
   - Perfect for 2+ monitor setups

### Technical Details

- **Shared state**: All windows share localStorage via Zustand persist
- **Independent reconnection**: Each window only reconnects to terminals with matching `windowId`
- **Backend coordination**: Single WebSocket connection per window, backend routes messages correctly
- **Persistence**: Window assignments survive refresh/restart

### Critical Architecture (Popout Flow)

**⚠️ IMPORTANT**: Multi-window support requires strict window isolation to prevent cross-contamination. Follow these principles:

#### 1. **Backend Output Routing** (backend/server.js:114-443)
```javascript
// CRITICAL: terminalOwners map tracks WebSocket ownership
const terminalOwners = new Map(); // terminalId -> Set<WebSocket>

// On spawn/reconnect: register ownership
terminalOwners.get(terminalId).add(ws)

// On output: send ONLY to owners (no broadcast!)
terminalRegistry.on('output', (terminalId, data) => {
  const owners = terminalOwners.get(terminalId)
  owners.forEach(client => client.send(message))
})
```
**Why**: Broadcasting terminal output to all clients causes escape sequence corruption (DSR) in wrong windows.

#### 2. **Frontend Window Filtering** (src/SimpleTerminalApp.tsx:757-785)
```typescript
// CRITICAL: Check windowId BEFORE adding to webSocketAgents
if (existingTerminal) {
  const terminalWindow = existingTerminal.windowId || 'main'
  if (terminalWindow !== currentWindowId) {
    return  // Ignore terminals from other windows
  }
  // Now safe to add to webSocketAgents
}
```
**Why**: Without this check, Window 1 can adopt terminals spawned in Window 2, creating duplicate connections to the same tmux session.

#### 3. **No Fallback Terminal Creation** (src/SimpleTerminalApp.tsx:812-819)
```typescript
} else {
  // Do NOT create new terminal for unmatched spawns
  console.warn('⏭️ Ignoring terminal-spawned - no matching terminal')
  return  // Prevents cross-window adoption
}
```
**Why**: The old fallback created terminals for broadcasts from other windows, bypassing windowId filtering.

#### 4. **Tmux Detach API** (backend/routes/api.js:696-733)
```javascript
// POST /api/tmux/detach/:name
execSync(`tmux detach-client -s "${sessionName}"`)
```
**Flow**: Original window → detach via API → clear agentId → new window → reconnect
**Why**: Clean handoff prevents both windows from having active agents to same session.

#### 5. **URL Parameter Activation** (src/SimpleTerminalApp.tsx:362-395)
```typescript
// Watch FULL storedTerminals array (not just length!)
useEffect(() => {
  const activeFromUrl = urlParams.get('active')
  if (terminal && terminal.windowId === currentWindowId) {
    setActiveTerminal(activeFromUrl)
  }
}, [storedTerminals, currentWindowId])  // Critical dependencies
```
**Why**: Watching only `storedTerminals.length` misses windowId updates from localStorage sync.

#### 6. **xterm.open Retry Logic** (src/components/Terminal.tsx:269-288)
```typescript
// Bounded retry for 0x0 containers
let retryCount = 0
const attemptOpen = () => {
  if (has_dimensions) xterm.open()
  else if (retryCount < 10) setTimeout(attemptOpen, 50)
}
```
**Why**: Popout windows may have 0x0 dimensions initially; xterm needs to retry instead of giving up.

### Common Pitfalls to Avoid

❌ **DON'T** broadcast terminal output to all WebSocket clients
✅ **DO** route output only to terminal owners via `terminalOwners` map

❌ **DON'T** create terminals for unmatched `terminal-spawned` events
✅ **DO** return early if no matching terminal in current window

❌ **DON'T** watch `storedTerminals.length` for URL activation
✅ **DO** watch full `storedTerminals` array to catch windowId changes

❌ **DON'T** set `activeTerminalId` in `addTerminal` unconditionally
✅ **DO** only set if `!state.activeTerminalId` to prevent cross-window interference

❌ **DON'T** skip windowId filtering in terminal-spawned handler
✅ **DO** check windowId BEFORE adding to webSocketAgents

### Debugging Multi-Window Issues

If you see escape sequences (`1;2c0;276;0c`) in terminals:
- Check backend output routing - should use `terminalOwners`, not `broadcast()`
- Check frontend windowId filtering - verify early return for wrong window
- Check for duplicate terminals - both windows might have same `agent.id`

If popout windows show blank terminals:
- Check `?active=` parameter handling - should watch full `storedTerminals`
- Check xterm.open retry logic - should retry up to 10 times for 0x0 containers
- Check tmux detach API - original window should clear `agentId` before popout

### Example Workflow

```bash
# Monitor 1: Main development window
- Tab 1: Claude Code (main)
- Tab 2: TFE (main)

# Monitor 2: Popped out window
- Tab 3: Bash (window-abc123) - moved via ↗
- Tab 4: LazyGit (window-abc123) - moved via ↗

# All terminals persist and reconnect correctly!
```

---

## 🔧 Configuration

### spawn-options.json
Located at `public/spawn-options.json` - defines available terminal types:

```json
{
  "spawnOptions": [
    {
      "label": "Claude Code",
      "command": "claude",
      "terminalType": "claude-code",
      "icon": "🤖",
      "description": "Claude Code (interactive mode)",
      "defaultSize": { "width": 1200, "height": 800 },
      "defaultTheme": "amber",
      "defaultTransparency": 100
    }
  ]
}
```

### Theme Aliases
Use intuitive aliases in spawn-options:
- `amber` → Retro Amber (orange monochrome)
- `green` → Matrix Rain (green on black)
- `purple` → Cyberpunk Neon
- `pink` → Vaporwave Dreams
- `blue` → Holographic
- `ocean` → Deep Ocean
- `dark` → GitHub Dark

---

## 🐛 Known Issues

1. **No Keyboard Shortcuts** - Missing Ctrl+T, Ctrl+W, etc.
2. **Mobile Untested** - May need responsive CSS work

## ✅ Recently Fixed (Nov 9, 2025)

### Multi-Window Tab Management
**Problem:** Need to organize terminals across multiple monitors for efficient workflows.

**Solution:** Implemented window-based terminal management system where each browser window has a unique ID and manages its own set of terminals.

**Key Features:**
```tsx
// Window ID assignment
const currentWindowId = urlParams.get('window') || 'main'

// Terminal filtering per window
const visibleTerminals = terminals.filter(t =>
  (t.windowId || 'main') === currentWindowId
)

// Move terminal to new window
handlePopOutTab(terminalId) {
  updateTerminal(terminalId, { windowId: newWindowId })
  window.open(`?window=${newWindowId}`)
}
```

**Critical Fixes:**
1. **Preserve `windowId` in WebSocket handler** - Prevents terminals from losing window assignment
2. **Preserve `windowId` in reconnection** - Terminals stay in correct window after refresh
3. **Filter terminals for SplitLayout** - Prevents cross-window rendering
4. **Increased localStorage sync delay** - 250ms ensures state persists before new window opens

**Files Modified:**
- `src/stores/simpleTerminalStore.ts` - Added `windowId` property
- `src/SimpleTerminalApp.tsx` - Window ID generation, filtering, pop-out logic, WebSocket message handling

**Impact:**
- Perfect for multi-monitor setups - organize terminals across browser windows
- Works great with Chrome side panel/reading list for complex layouts
- Each window independently manages and reconnects to its terminals
- All windows share state via localStorage, terminal sessions persist via tmux

---

## ✅ Recently Fixed (Nov 9, 2025) - Split Terminals

### Split Terminal Customization
**Problem:** Font size and other customization controls in the footer only affected one pane in split terminals, not the currently focused pane.

**Root Cause:** The `terminalRef` was being assigned based on `activeTerminalId` instead of `focusedTerminalId` in split panes. This meant the ref always pointed to the same pane (whichever matched the active tab), not the focused one.

**Solution:**
```tsx
// OLD (broken - all panes):
ref={leftTerminal.id === activeTerminalId ? terminalRef : null}

// NEW (working):
ref={leftTerminal.id === focusedTerminalId ? terminalRef : null}
```

**Files Modified:**
- `src/components/SplitLayout.tsx` (lines 256, 302, 429, 475) - Updated all 4 split pane refs
- `src/SimpleTerminalApp.tsx` (lines 1768-1816) - Removed non-functional tmux buttons

**Impact:** Footer customization controls (font size, theme, transparency, etc.) now correctly target the focused pane in split terminals. Removed tmux split/window buttons since the app now uses native split layouts instead of tmux splits.

---

## ✅ Recently Fixed (Nov 8, 2025)

### Terminal Persistence Implementation
**The Critical Fix:** xterm.js requires non-zero container dimensions to initialize properly.

**Problem:** Using `display: none` to hide inactive tabs prevented xterm.js from initializing on those terminals. After refresh, only the currently active tab would render - all others showed emoji icons but blank terminal areas.

**Solution (from Opustrator):**
```tsx
// OLD (broken):
style={{ display: terminal.id === activeTerminalId ? 'block' : 'none' }}

// NEW (working):
style={{
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  visibility: terminal.id === activeTerminalId ? 'visible' : 'hidden',
  zIndex: terminal.id === activeTerminalId ? 1 : 0,
}}
```

**Why this works:**
- All terminals render with full dimensions (stacked via absolute positioning)
- xterm.js can initialize properly on all terminals
- `visibility: hidden` hides inactive terminals without removing dimensions
- `isSelected` prop triggers Terminal.tsx refresh when tab becomes active (lines 870-886)

**Additional fixes:**
- Conditional scrollbar based on `useTmux` setting (tmux: hidden, non-tmux: visible with 10k scrollback)
- Footer customizations now properly persist per-tab through localStorage
- Spawn options modal shows default font size (16px) when editing options

**Files Modified:**
- `src/SimpleTerminalApp.tsx` (lines 949-981) - Absolute positioning + visibility
- `src/components/Terminal.tsx` (lines 78, 183) - Conditional scrollback
- `src/components/Terminal.css` (lines 151-186) - Conditional scrollbar styling
- `src/components/SettingsModal.tsx` (lines 111-123) - Default font size display

## ✅ Recently Fixed (Nov 7, 2025)

### Critical Terminal Spawning Bugs
1. **Commands Not Executing** ✅ - Bash terminals now properly execute commands from spawn-options.json
2. **Working Directory Validation** ✅ - Tilde paths (`~/projects`) now expand correctly
3. **Duplicate Terminal Bug** ✅ - Fixed race condition using `useRef` for synchronous spawn tracking
4. **Silent Failures** ✅ - Added error logging for failed validations
5. **Settings UI** ✅ - Added SettingsModal (⚙️ button) to edit spawn-options.json

See PLAN.md for detailed technical documentation of these fixes.

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| Dependencies | 74 packages |
| Lines of Code | ~44,000 |
| Frontend Size | ~200KB gzipped |
| Backend Port | 8127 |
| Terminal Types | 15 |
| Themes | 14 |

---

## 🎯 Design Goals

### Primary Goals
1. **Easy to Use** - Spawn terminal, start typing
2. **Fast** - Instant spawning, no lag
3. **Reliable** - WebSocket auto-reconnect, error recovery
4. **Beautiful** - Modern glassmorphic UI, smooth animations

### Non-Goals
1. **Canvas Features** - No dragging, resizing, zoom
2. **Infinite Workspace** - Tabs only, not spatial
3. **Complex Layouts** - Keep it simple
4. **Desktop PWA** - Web-first, not Electron

---

## 🔍 Debugging & Monitoring

### Checking Backend Logs

The backend runs in a tmux session when started with `./start-tmux.sh`. View logs in multiple ways:

**1. Attach to Backend Session (Live Logs)**
```bash
tmux attach -t tabz:backend
# Press Ctrl+B, then D to detach
```

**2. View Logs in App (Dev Logs Terminal)**
- Spawn "Dev Logs" terminal from the spawn menu
- Shows last 100 lines with beautiful colors
- Uses tmux capture-pane for live viewing

**3. Check Active Tmux Sessions**
```bash
tmux ls
# Shows all tmux sessions including:
# - tabz:backend (backend server)
# - tabz:frontend (Vite dev server)
# - tt-bash-xyz (spawned bash terminals)
# - tt-cc-abc (spawned Claude Code terminals)
```

### Monitoring Terminal Sessions

**List Active Terminal Sessions**
```bash
# In terminal or via Dev Logs spawn option:
tmux ls | grep "^tt-"
# Shows all spawned terminal sessions (tt-bash-*, tt-cc-*, etc.)
```

**Capture Pane Contents**
```bash
# Capture last 100 lines from a specific session
tmux capture-pane -t tt-bash-xyz -p -S -100

# Capture entire scrollback
tmux capture-pane -t tt-bash-xyz -p -S -
```

**Monitor WebSocket Messages**
Backend logs show WebSocket activity when `LOG_LEVEL=5` (debug):
```bash
# In backend/.env:
LOG_LEVEL=5  # Shows detailed PTY operations, tmux session info

# Restart backend:
./stop.sh && ./start-tmux.sh
```

### Common Debugging Scenarios

**1. Terminal won't spawn**
- Check backend logs: `tmux attach -t tabz:backend`
- Look for spawn errors, working directory validation failures
- Verify `spawn-options.json` syntax

**2. Terminal spawned but blank**
- Check if session exists: `tmux ls | grep tt-`
- Try refit button (🔄) in footer
- Check browser console for xterm.js errors

**3. Persistence not working**
- Verify tmux sessions survive: refresh page, run `tmux ls`
- Check localStorage in browser DevTools (Application → Local Storage)
- Look for `simple-terminal-storage` key with terminals array

**4. Backend crash/restart**
- Terminals in tmux sessions survive backend restart
- Refresh frontend to reconnect
- Sessions will reattach automatically

### Dev Server Ports

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:8127 (WebSocket + REST API)
- **WebSocket**: ws://localhost:8127

### Browser Console Forwarding (Claude Debugging)

**Automatic in dev mode!** Browser console logs are automatically forwarded to the backend terminal for easy debugging.

**What gets forwarded:**
- `console.log()` → Backend terminal with `[Browser]` prefix
- `console.error()` → Red error in backend terminal
- `console.warn()` → Yellow warning in backend terminal
- Includes source file:line (e.g., `[Browser:SimpleTerminalApp.tsx:123]`)

**Claude can capture logs directly** (when you run `./start-tmux.sh`):
```bash
# Claude runs these via Bash tool after making changes:
tmux capture-pane -t tabz:backend -p -S -100   # Backend logs
tmux capture-pane -t tabz:frontend -p -S -100  # Frontend logs
tmux ls | grep "^tt-"                                    # Active terminals
```

**User can view logs manually:**
```bash
# Method 1: Attach to backend session
tmux attach -t tabz:backend

# Method 2: Spawn "Dev Logs" terminal in app
# Right-click → Dev Logs

# Method 3: Capture last 50 browser logs
tmux capture-pane -t tabz:backend -p -S -50 | grep "\[Browser"
```

**Format (optimized for Claude Code):**
```
[Browser:SimpleTerminalApp.tsx:456] Terminal spawned: terminal-abc123
[Browser:Terminal.tsx:234] xterm initialized {cols: 80, rows: 24}
[Browser] WebSocket connected
```

**Why this helps:**
- ✅ **Claude can debug autonomously** - Capture panes directly, no user copy-paste needed
- ✅ Browser + backend logs in one place
- ✅ Structured format uses minimal context
- ✅ Source location helps pinpoint issues quickly

---

## 🔗 Links

- **GitHub**: https://github.com/GGPrompts/Tabz
- **Parent Project**: https://github.com/GGPrompts/opustrator
- **xterm.js Docs**: https://xtermjs.org/

---

## 📝 Notes for AI Assistants

### Project Context
- This project was extracted from Opustrator to create a simpler tab-based version
- The backend is shared with Opustrator (same WebSocket protocol)
- Focus on simplicity - no canvas features should be added
- Test spawning terminals after changes (Bash, TFE, Claude Code)
- Keep dependencies minimal - avoid adding new npm packages

### Autonomous Debugging Workflow

**When user runs `./start-tmux.sh`, you can debug autonomously:**

1. **Make code changes** (Edit/Write tools)

2. **Check if it's working** (Bash tool):
   ```bash
   # Check backend logs
   tmux capture-pane -t tabz:backend -p -S -100

   # Check frontend logs (includes browser console via forwarder)
   tmux capture-pane -t tabz:frontend -p -S -100

   # Check active terminal sessions
   tmux ls | grep "^tt-"

   # Check specific terminal
   tmux capture-pane -t tt-bash-xyz -p -S -50
   ```

3. **Analyze and fix** - You can see errors directly without asking user

**Example autonomous debugging:**
```bash
# After updating Terminal.tsx:
# 1. Capture backend to see if terminal spawned
tmux capture-pane -t tabz:backend -p -S -50 | tail -20

# 2. Check for browser errors
tmux capture-pane -t tabz:backend -p -S -100 | grep "\[Browser.*ERROR"

# 3. Verify terminal session exists
tmux ls | grep "tt-bash"
```

**This enables:**
- ✅ Fix issues without user needing to copy-paste logs
- ✅ Verify changes work before committing
- ✅ Debug race conditions by capturing exact timing
- ✅ See both browser + backend logs in one capture

---

**Last Updated**: November 8, 2025

---

## 🧹 Legacy Code Cleanup (November 8, 2025)

**Status:** ✅ **COMPLETED**

### What Was Removed
Successfully removed ~1,000 lines of Opustrator legacy code in 3 phases:

**Phase 1: Rebranding**
- Renamed from "Terminal Tabs" to "Tabz (Tab>_)"
- Updated all package names, docs, scripts
- Removed dockerode + 42 dependencies (~10MB)
- Updated environment variables: `OPUSTRATOR_*` → `TABZ_*`

**Phase 2: Backend Cleanup**
- Removed `/api/layouts` endpoints (103 lines)
- Deleted `layout-manager.js` module (137 lines)
- Deleted `workspace.js` routes (109 lines)
- Removed 8 unused API endpoints total

**Phase 3: Frontend Cleanup**
- Removed canvas background animation settings (85 lines)
- Removed grid/snapping settings for infinite canvas
- Removed file viewer/Monaco editor settings
- Removed canvas navigation settings (WASD, minimap, zoom)
- Migrated localStorage: `opustrator-settings` → `tabz-settings`

### What Was Kept (Intentionally)
- `/api/agents` endpoints - For future bubbletea TUI spawn menu
- `/api/spawn-options` - Used by settings modal
- `/api/tmux/*` endpoints - Core tmux functionality
- Terminal backgrounds (CSS gradients) - NOT canvas backgrounds
- All terminal customization features

### Impact
- **17 files changed**, 110 insertions(+), 1,031 deletions(-)
- **2 files deleted**, **43 packages removed**
- **User settings preserved** via automatic migration
- **No breaking changes** to core functionality

**Full details:** See `OPUSTRATOR_LEGACY_AUDIT.md`

