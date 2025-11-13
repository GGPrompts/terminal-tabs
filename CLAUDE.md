# CLAUDE.md - Tabz

## 🎯 Project Overview

Tabz (Tab>_) is a **lightweight, tab-based terminal interface** for the web. Built with React, TypeScript, and xterm.js, it provides a simple alternative to complex canvas-based terminal managers.

**Version**: 1.2.0
**Status**: Multi-Window + Split Terminals + Auto-Naming Complete ✅
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
3. **Run Tests Before Committing** - `npm test` should pass with no failures
4. **Mobile-First CSS** - Use responsive design patterns
5. **Document Changes** - Follow documentation workflow below
6. **No Canvas Code** - This is the tab-based version, no dragging/zoom

### NEVER:
1. **Don't Add Canvas Features** - Dragging, resizing, zoom, pan = NO
2. **Don't Import from Opustrator Canvas Code** - Keep it independent
3. **Don't Over-Engineer** - Simple solutions win
4. **Don't Break WebSocket Protocol** - Backend compatibility is critical
5. **Don't Skip Tests** - Failing tests = failing features

### 📝 Documentation Workflow

**After completing work (features, bug fixes, refactoring):**

1. **CHANGELOG.md** - Add version entry with what changed
   - Use categories: Added, Changed, Fixed, Removed
   - Include user-facing impact
   - Reference issue numbers if applicable

2. **LESSONS_LEARNED.md** - Capture key insights from complex bugs
   - Why the bug happened (root cause)
   - How to prevent it (patterns, checklists)
   - Code examples showing right vs wrong approach
   - Files to remember for similar issues

3. **CLAUDE.md** - Update ONLY for architecture changes
   - New patterns or principles
   - Changes to core workflows
   - Updated technical details
   - **DON'T** add "Recently Fixed" narratives (use CHANGELOG instead)

**Keep this file focused on "how the system works NOW", not "how we got here".**

---

## 🚀 Key Features (MVP Complete)

✅ **Tab-Based Interface** - Browser-style tabs for terminals
✅ **Multi-Window Support** - Move tabs between browser windows for multi-monitor setups
✅ **Split Terminals** - Split tabs horizontally/vertically with independent panes
✅ **Auto-Naming from Tmux** - Tab names update live from tmux pane titles (shows Claude Code status, window count)
✅ **15 Terminal Types** - Claude Code, Bash, TFE, LazyGit, etc.
✅ **Full Terminal Emulation** - xterm.js with WebGL rendering
✅ **WebSocket Communication** - Real-time I/O
✅ **Theme System** - 14 themes with aliases (amber, matrix, etc.)
✅ **Spawn Menu** - Right-click spawn with 15 options
✅ **Connection Status** - WebSocket connection indicator
✅ **Settings Modal** - Edit spawn options and global defaults with visual priority system

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

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#multi-window-architecture) for detailed debugging lessons on window isolation bugs and prevention strategies.

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

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#xtermjs--terminal-rendering) for xterm initialization patterns and dimension requirements.

### Common Pitfalls to Avoid

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#lesson-backend-broadcasting-breaks-multi-window-nov-12-2025) for the "Backend Broadcasting" lesson that explains why broadcasting breaks multi-window setups.

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

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#multi-window-architecture) for root cause analysis and prevention patterns.

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

## 📝 Auto-Naming from Tmux

**NEW in v1.2.0** - Tab names automatically update from tmux pane titles!

> **See Also:** [CHANGELOG.md](CHANGELOG.md#122---2025-11-12) for implementation details and TUI tool smart naming.

### How It Works

Tabz polls tmux every 2 seconds to read the **pane title** (what applications like Claude Code set via escape sequences) and updates tab names accordingly. This gives you live, dynamic tab names just like WezTerm!

### What You See

**Single Window:**
```
"bash"  →  "Editing: Terminal.tsx"  →  "Running tests"
```

**Multiple Windows (tmux Ctrl+B c):**
```
"Editing: file.ts (2)"  ←  Shows you have 2 windows in this session
"Running tests (3)"     ←  Shows 3 windows
```

### Right-Click Menu: "Rename Tab..."

- **Auto-update ON** (default): Tab name syncs from tmux pane title every 2 seconds
- **Auto-update OFF**: Set a custom name that won't change
- **Toggle anytime**: Re-enable auto-update to sync with tmux again

### Technical Details

**Backend:**
- `GET /api/tmux/info/:sessionName` - Returns pane title + window count
- Uses tmux format: `#{pane_title}|#{session_windows}|#{window_index}`

**Frontend:**
- `useTerminalNameSync` hook polls every 2 seconds (only for visible terminals)
- Only updates if name actually changed (avoids unnecessary re-renders)
- Terminal fields: `autoUpdateName` (boolean), `customName` (string)

**Files:**
- `backend/routes/api.js` - API endpoint
- `src/hooks/useTerminalNameSync.ts` - Polling logic
- `src/stores/simpleTerminalStore.ts` - Terminal interface
- `src/SimpleTerminalApp.tsx` - Rename dialog UI

### Use Cases

1. **Claude Code Status**: See exactly what Claude is working on in real-time
2. **Multiple Tmux Windows**: Know how many windows exist in each session
3. **Custom Organization**: Manually name tabs like "Main Dev", "Logs", "Tests"
4. **Mixed Mode**: Some tabs auto-update, others stay manually named

### Example Workflow

```bash
# Spawn Claude Code terminal
# Tab shows: "Claude Code"

# Claude starts working
# Tab updates: "Editing: Terminal.tsx"

# Create 2nd tmux window (Ctrl+B c)
# Tab updates: "Editing: Terminal.tsx (2)"

# Right-click → Rename Tab... → "Main Dev" + uncheck auto-update
# Tab stays: "Main Dev" (no more updates)
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

---

## 📜 Documentation Index

### Core Documentation (Root Directory)

- **[CLAUDE.md](CLAUDE.md)** (this file) - Architecture, development rules, current system state
- **[README.md](README.md)** - User-facing documentation, getting started, features
- **[CHANGELOG.md](CHANGELOG.md)** - Version history, bug fixes, feature additions
- **[LESSONS_LEARNED.md](LESSONS_LEARNED.md)** - Technical insights, common pitfalls, prevention strategies

### Development Planning (Root Directory)

- **[PLAN.md](PLAN.md)** - Refactoring roadmap, technical debt, future improvements
- **[NEXT_SESSION_PROMPT.md](NEXT_SESSION_PROMPT.md)** - Session summaries, debugging notes, next steps

### Archived Documentation (docs/ folder)

#### Split Terminal Implementation
- **[docs/SPLIT_TERMINAL_FIXES.md](docs/SPLIT_TERMINAL_FIXES.md)** - Split terminal visual & performance fixes (completed)
- **[docs/SPLIT_PERFORMANCE_FIXES_v2.md](docs/SPLIT_PERFORMANCE_FIXES_v2.md)** - React.memo, throttling, performance optimizations (completed)

#### Tmux Integration
- **[docs/TMUX_RENDERING_FINAL.md](docs/TMUX_RENDERING_FINAL.md)** - Complete tmux rendering solution (completed)
- **[docs/TMUX_RENDERING_FIX.md](docs/TMUX_RENDERING_FIX.md)** - Initial tmux rendering debugging (superseded by FINAL)
- **[docs/TMUX_SPLIT_RENDERING_DEBUG.md](docs/TMUX_SPLIT_RENDERING_DEBUG.md)** - Tmux split debugging notes (historical)
- **[docs/TMUX_MIGRATION_PLAN.md](docs/TMUX_MIGRATION_PLAN.md)** - Tmux migration planning (historical)

#### Testing Infrastructure
- **[docs/TEST_INFRASTRUCTURE_SUMMARY.md](docs/TEST_INFRASTRUCTURE_SUMMARY.md)** - Test setup documentation (completed)
- **[docs/TEST_COVERAGE_SUMMARY.md](docs/TEST_COVERAGE_SUMMARY.md)** - Coverage analysis (historical)
- **[docs/TESTING_SUMMARY.md](docs/TESTING_SUMMARY.md)** - Testing workflow notes (historical)
- **[docs/TESTING_PROMPT.md](docs/TESTING_PROMPT.md)** - Testing prompts (historical)

#### Legacy/Reference
- **[docs/CONTINUATION_PROMPT.md](docs/CONTINUATION_PROMPT.md)** - Legacy session prompts
- **[docs/OPUSTRATOR_IMPROVEMENTS.md](docs/OPUSTRATOR_IMPROVEMENTS.md)** - Improvements from parent project

**Quick Navigation:**
- 🐛 Debugging a bug? → [LESSONS_LEARNED.md](LESSONS_LEARNED.md)
- 📦 What changed in version X? → [CHANGELOG.md](CHANGELOG.md)
- 🏗️ Planning refactoring? → [PLAN.md](PLAN.md)
- 📖 User documentation? → [README.md](README.md)
- 🧭 Understanding architecture? → This file
- 📚 Historical reference? → [docs/](docs/) folder

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

## 🧪 Testing Workflow

### Pre-Commit Testing (REQUIRED)

**Before committing ANY code changes, run the test suite:**

```bash
npm test
```

**All tests must pass** - No exceptions! If tests fail:
1. Fix the failing tests (don't skip them)
2. If your changes intentionally break tests, update the tests
3. Never commit with failing tests

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#testing-detachreattach) for testing checklists and verification procedures.

### Test Suite Overview

**Current Test Coverage:**
- **15 integration tests** for detach/reattach workflow
- **35+ integration tests** for split operations
- **20+ integration tests** for terminal spawning
- **Unit tests** for hooks, stores, and utilities

**Run specific test suites:**
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/integration/detach-reattach.test.ts

# Run in watch mode (during development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test-Driven Development

When fixing bugs or adding features:

1. **Write a failing test** that reproduces the bug
2. **Fix the bug** until the test passes
3. **Verify all other tests** still pass
4. **Commit with passing tests**

Example from detach/reattach bug fixes:
```typescript
// 1. Write test showing the bug
it('should reattach whole split when clicking detached pane tab', () => {
  // Test fails because clicking pane only reattaches that pane
})

// 2. Fix the code (add detachedSplitContainer check)

// 3. Test now passes - commit!
```

### Why Testing Matters

**Regression Prevention**: Tests catch bugs we've already fixed:
- ✅ Detach no longer kills tmux sessions
- ✅ processedAgentIds cleared properly
- ✅ Split layout preserved on reattach

**Confidence**: Change code without fear of breaking existing features

**Documentation**: Tests show how features should work

### CI/CD (Future)

When CI is set up, tests will run automatically on:
- Every push to GitHub
- Every pull request
- Pre-merge validation

---

## 📝 Notes for AI Assistants

### Project Context
- This project was extracted from Opustrator to create a simpler tab-based version
- The backend is shared with Opustrator (same WebSocket protocol)
- Focus on simplicity - no canvas features should be added
- **Run `npm test` before committing** - All tests must pass
- Test spawning terminals after changes (Bash, TFE, Claude Code)
- Keep dependencies minimal - avoid adding new npm packages

> **Important:** Follow the [Documentation Workflow](#-documentation-workflow) when making changes. See [LESSONS_LEARNED.md](LESSONS_LEARNED.md) for common pitfalls and prevention strategies.

### Autonomous Debugging Workflow

> **See Also:** [LESSONS_LEARNED.md](LESSONS_LEARNED.md#debugging-patterns) for diagnostic logging patterns and multi-step state change checklists.

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

