# Changelog

All notable changes to Terminal Tabs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2025-11-10

### 🏗️ Major Refactoring - Code Quality Sprint (COMPLETE) 🎉

**Overall Impact**: Reduced codebase by **-1,596 lines** while significantly improving maintainability!

#### Phase 1: Setup & Dropdown Consolidation
- **Created GenericDropdown component** - Eliminated 190 lines of duplication
  - `src/components/GenericDropdown.tsx` (87 lines) - Flexible dropdown abstraction
  - BackgroundGradientDropdown: 90 → 69 lines (-23%)
  - TextColorThemeDropdown: 100 → 68 lines (-32%)
  - FontFamilyDropdown: 85 → 57 lines (-33%)
- **Extracted constants** - `src/constants/terminalConfig.ts` (67 lines)
  - `THEME_BACKGROUNDS` - 30+ theme mappings
  - `TERMINAL_TYPE_ABBREVIATIONS` - 7 terminal types
  - `COMMAND_ABBREVIATIONS` - Common tools (tfe, lazygit, micro)
  - `DEFAULT_TERMINAL_CONFIG` - Spawn defaults
- **Extracted window utilities** - `src/utils/windowUtils.ts` (49 lines)
  - `generateWindowId()` - Unique window ID generation
  - `getCurrentWindowId()` - URL parameter parsing
  - `updateUrlWithWindowId()` - Browser history management
- **Commit**: `ed29339` (GenericDropdown), `69aa2a7` (constants & utils)

#### Phase 3: Terminal.tsx Decomposition
- **Reduced from 1,385 → 807 lines (42% reduction)**
- **Created custom hooks**:
  - `useTerminalTheme.ts` (178 lines) - Theme application logic
  - `useTerminalResize.ts` (267 lines) - Resize handling & ResizeObserver
  - `useTerminalFont.ts` (129 lines) - Font customization
- **Removed legacy code**:
  - `useTerminalMouse.ts` - Deleted Opustrator canvas zoom code (156 lines)
- **Result**: Terminal.tsx now within healthy size range!
- **Commits**: `0e9e0d4` (Phase 3), `5f72e05` (Phase 3.5 cleanup)

#### Phase 4: SimpleTerminalApp.tsx Decomposition
- **Reduced from 2,207 → 1,147 lines (48% reduction)**
- **Created custom hooks**:
  - `useWebSocketManager.ts` (431 lines) - WebSocket connection management
  - `useKeyboardShortcuts.ts` (127 lines) - Keyboard event handlers
  - `useDragDrop.ts` (338 lines) - Tab drag-and-drop logic
  - `useTerminalSpawning.ts` (252 lines) - Terminal spawn logic
  - `usePopout.ts` (161 lines) - Multi-window popout feature
- **Result**: Main app component now maintainable and testable!
- **Commit**: `93e284c` (Phase 4 extraction)

### 🐛 Critical Bug Fixes

#### Phase 4 Refactoring Bugs (All Fixed!)
1. **Terminals Completely Unusable** (wsRef Sharing Bug)
   - **Problem**: After Phase 4 refactoring, no terminal input worked
   - **Root Cause**: `useWebSocketManager` created its own internal `wsRef` instead of using parent's ref
   - **Impact**: Terminal components had null WebSocket → no keyboard input, no TUI tools, nothing worked
   - **Fix**: Pass `wsRef` as parameter to `useWebSocketManager` so all components share same WebSocket
   - **Files**: `src/hooks/useWebSocketManager.ts`, `src/SimpleTerminalApp.tsx`

2. **Terminals Stuck at Tiny Size** (ResizeObserver Timing Bug)
   - **Problem**: Terminals rendered but stayed at tiny size, didn't resize to fill container
   - **Root Cause**: ResizeObserver setup had early return when `terminalRef.current` was null during initialization
   - **Impact**: ResizeObserver never set up if terminal wasn't mounted when useEffect ran
   - **Fix**: Added xterm refs to useEffect dependencies to re-run when terminal initializes
   - **Files**: `src/hooks/useTerminalResize.ts`

3. **TypeScript Build Errors** (Invalid Props)
   - **Problem**: Build failed with TypeScript errors about invalid `isFocused` prop
   - **Fix**: Removed invalid props from Terminal components in SplitLayout.tsx (4 locations)
   - **Files**: `src/components/SplitLayout.tsx`

#### Popout Window Timing Bug
- **Problem**: Popout windows didn't load terminals initially, required refresh to work
- **Root Cause**: 400ms delay was too short for Zustand localStorage sync (100ms debounce)
- **Impact**: Fast-initializing terminals (bash) most affected, sometimes showed blank window
- **Fix**: Increased delay to 600ms to ensure sync completes before new window opens
- **Files**: `src/SimpleTerminalApp.tsx`

### 📋 Refactoring Best Practices (Lessons Learned)

**When extracting custom hooks that manage shared resources:**

1. **Identify Shared Refs Early** - Before extracting, check for `useRef` that MUST be shared between hook and components (WebSocket refs, DOM refs, etc.)
2. **Test with Real Usage Immediately** - Don't just check compilation, actually spawn terminals and try typing
3. **Watch for Timing Dependencies in useEffect** - If useEffect has early return checking a ref, include that ref in dependencies
4. **Check TypeScript Errors in Both Directions** - Missing required props AND invalid extra props

**Testing Checklist After Refactoring:**
- TypeScript compilation (`npm run build`)
- Visual inspection (spawn terminal, try typing, resize window)
- Browser console for errors
- Backend logs via tmux capture-pane

### 📊 Component Analysis Results

**Before Refactoring:**
- SimpleTerminalApp.tsx: 2,207 lines (Grade: D)
- Terminal.tsx: 1,385 lines (Grade: D)
- Dropdown components: ~280 lines duplicated

**After Refactoring:**
- SimpleTerminalApp.tsx: 1,147 lines (Grade: B) ✅
- Terminal.tsx: 807 lines (Grade: B+) ✅
- Dropdown components: Consolidated with GenericDropdown ✅
- **Total reduction: -1,596 lines of code!**

### 🎯 Benefits Achieved

- ✅ Each feature independently testable
- ✅ Easier to understand control flow
- ✅ Reduced risk of introducing bugs (when hooks are tested properly!)
- ✅ Better code reusability
- ✅ Improved maintainability
- ✅ Cleaner separation of concerns

### 📝 Documentation

- **PLAN.md** - Updated with detailed refactoring roadmap and completion status
- **CLAUDE.md** - Added Phase 4 bug documentation and refactoring best practices
- **Component analysis table** - Graded all files with before/after comparisons

---

## [1.2.0] - 2025-11-09

### ✨ Major Features

#### Multi-Window Support (COMPLETE) 🎉
- **Move terminals between browser windows** - Click ↗ button to pop out tabs
- **Perfect for multi-monitor setups** - Organize terminals across screens
- **Window isolation** - Each window independently manages its own terminals
- **Shared state** - All windows share localStorage via Zustand persist
- **Independent reconnection** - Each window only reconnects to its own terminals
- **Chrome side panel integration** - Works great with Chrome's split view
- **Backend coordination** - Single WebSocket per window, proper message routing

#### Split Terminal Layouts (Phase 1 - COMPLETE)
- **Horizontal/vertical splits** - Split any tab into 2-4 panes
- **Drag-to-resize** - ResizableBox for adjustable pane sizes
- **Focus tracking** - Visual indicators show which pane is active
- **Footer integration** - Customization controls target focused pane
- **Persistent layouts** - Split configurations survive refresh
- **Independent terminals** - Each pane is a full terminal instance

#### Tab Interaction Improvements
- **Fixed tab clicking** - 8px drag threshold allows tabs to be clicked
- **Tab reordering** - Drag tabs to reorder (dnd-kit integration)
- **Close buttons work** - Reliable tab closure

### 🐛 Critical Bug Fixes

#### Session Persistence & Reconnection
- **Fixed duplicate terminals on refresh** - Backend now reuses existing registry entries
- **Proper tmux session reconnection** - Terminals reconnect to existing sessions instead of creating duplicates
- **Terminal names stay consistent** - No more TFE-2, TFE-3 duplicates
- **Customizations persist** - Font size, theme, transparency survive reconnection
- **Prevented auto-deletion** - Tmux terminals no longer deleted on PTY close during reconnection
- **Fixed "Terminal not found" errors** - Frontend clears stale agent IDs on disconnect

#### Multi-Window Isolation
- **Backend output routing** - `terminalOwners` map prevents cross-window output contamination
- **Frontend window filtering** - Terminals filtered by windowId before connection
- **No fallback terminal creation** - Prevents cross-window adoption of terminals
- **Tmux detach API** - Clean handoff when moving terminals between windows
- **URL parameter activation** - Popout windows properly activate terminals via `?active=` parameter
- **xterm.open retry logic** - Handles 0x0 containers in popout windows

#### Split Terminal Customization
- **Footer controls target focused pane** - Fixed refs to use `focusedTerminalId` instead of `activeTerminalId`
- **Independent pane customization** - Font size, theme, transparency apply to correct pane

#### Tab Interaction
- **Tab clicking works** - Added 8px `activationConstraint` to PointerSensor
- **Drag still works** - Requires 8px movement before drag starts
- **Close button responsive** - Properly registers clicks

#### Duplicate Spawn Prevention
- **Session-aware duplicate detection** - Include sessionName in spawn key to allow multiple terminals with same name in different sessions

### 🎨 UI/UX Improvements
- **Visual focus indicators** - Glowing divider on focused pane in splits
- **Popout button (↗)** - Intuitive icon for moving tabs to new windows
- **Split layout rendering** - Clean, resizable pane UI with proper borders
- **Footer pane info** - Shows which pane is focused in split layouts

### 🔧 Technical Improvements
- **Terminal registry reconnection logic** - Reuses existing entries instead of creating duplicates
- **PTY close handling** - Different behavior for tmux vs non-tmux terminals
- **WebSocket cleanup** - Clears agents and agent IDs on disconnect
- **Window ID tracking** - Unique IDs for each browser window/tab
- **Terminal ownership tracking** - Backend tracks which WebSocket owns which terminal
- **BroadcastChannel** - Cross-window state synchronization via localStorage
- **ResizeObserver** - Proper pane resizing in split layouts

### 📝 Code Quality
- **Component size analysis** - Identified SimpleTerminalApp (2,207 lines) and Terminal (1,385 lines) for refactoring
- **Code duplication analysis** - Found ~280 lines duplicated in dropdown components
- **Refactoring roadmap** - 6-phase plan with time estimates (25-35 hours)
- **Quick wins identified** - Constants extraction, memoization, JSDoc comments

### 📚 Documentation
- **PLAN.md** - Added comprehensive refactoring recommendations
- **Multi-window architecture** - Documented critical popout flow principles
- **Component analysis table** - Graded 12 major files with action items

---

## [1.1.0] - 2025-11-08

### ✨ Major Features

#### Terminal Persistence (COMPLETE) 🎉
- **All terminals persist through page refresh** - Fixed critical xterm.js initialization bug
- Changed from `display: none` to `visibility: hidden` with absolute positioning
- All terminals render properly, not just the active tab
- Sessions survive via tmux integration (when enabled)

#### Tmux Integration (COMPLETE)
- **Tmux toggle in header** - Enable/disable tmux for spawns (default: ON)
- Backend spawns terminals with unique tmux sessions (`tt-bash-xyz`, `tt-cc-abc`)
- Sessions survive backend restarts and page refreshes
- Custom tmux config (`.tmux-terminal-tabs.conf`) optimized for Terminal Tabs
- Query API for active tmux sessions

#### Per-Tab Customization
- **Footer controls** - Quick access to font size (+/-), refit, customize panel
- **Customize modal** - Change theme, transparency, font family per tab
- **Persistent settings** - All customizations save to localStorage per-tab
- **Spawn defaults** - New terminals always use defaults from spawn-options.json
- Tab-specific changes don't affect other tabs or new spawns

#### Beautiful Logging
- **Consola integration** - Colored, structured logging with emojis
- **Log levels** - Control verbosity via `LOG_LEVEL` environment variable
- **Dev Logs terminal** - View backend logs directly in-app
- **Safe logging** - Never logs terminal data/ANSI sequences (prevents host corruption)

### 🐛 Bug Fixes

#### Critical Fixes
- **Terminal persistence** - Fixed xterm.js requiring non-zero container dimensions
- **Escape sequence leak** - Stopped ANSI codes from corrupting host terminal
- **Text loss on tab switch** - All terminals now render simultaneously, switched via CSS
- **Duplicate isSelected** - Removed duplicate prop causing Vite warnings
- **Commands not executing** - Fixed bash terminals spawning without commands
- **Working directory validation** - Tilde paths (`~/projects`) now expand correctly
- **Duplicate terminals** - Fixed race condition using `useRef` for synchronous tracking

#### Minor Fixes
- **Font size modal** - Shows "16 (default)" when editing spawn options without fontSize
- **Scrollbar overlap** - Hidden with tmux, visible with 10k scrollback when tmux off
- **Footer controls** - Properly reflect initial values from spawn options
- **Dropdown visibility** - All dropdowns now have dark backgrounds
- **Refit button** - Actually unsticks terminals (calls proper refit() method)

### 🎨 UI/UX Improvements
- **Dynamic theme backgrounds** - App background transitions to match active terminal theme
- **Footer layout** - Changed from expanding panel to floating modal (keeps terminal full-size)
- **Responsive footer** - Works on ultra-wide, desktop, tablet, and mobile
- **Conditional scrollbar** - Hidden with tmux, styled scrollbar without
- **Spawn options manager** - Edit spawn-options.json with live preview
- **Metadata readability** - Fixed brightBlack colors for better diff/timestamp visibility

### 🔧 Technical Improvements
- **Cleanup on refresh** - Prevents PTY process buildup
- **Request ID tracking** - Reliable placeholder-to-agent matching
- **Session name format** - Short, unique names (`tt-{type}-{random}`)
- **Safe spawn tracking** - `useRef` eliminates race conditions
- **Error logging** - Validation failures now logged (no silent failures)

### 🧹 Legacy Code Cleanup
- **Rebranded to Tabz** - Changed from "Terminal Tabs" to "Tabz (Tab>_)"
- **Removed dockerode** - Eliminated 42 dependencies (~10MB)
- **Removed backend API endpoints** - Deleted `/api/layouts` (103 lines), `/api/workspace` (109 lines)
- **Deleted unused modules** - Removed `layout-manager.js` (137 lines), `workspace.js`
- **Cleaned frontend stores** - Removed ~120 lines of canvas animation/grid/file viewer settings
- **localStorage migration** - Automatic migration from `opustrator-settings` → `tabz-settings`
- **Environment variables** - Updated `OPUSTRATOR_*` → `TABZ_*`
- **Total cleanup** - 17 files changed, 110 insertions(+), 1,031 deletions(-)

### 📝 Documentation
- **CLAUDE.md** - Updated with persistence fix details and current status
- **NEXT_SESSION_PROMPT.md** - Complete session summary with debugging notes
- **DEBUG_PERSISTENCE.md** - Detailed debugging analysis (user-created)
- **Launcher scripts** - `start.sh`, `stop.sh`, `start-tmux.sh` with docs
- **OPUSTRATOR_LEGACY_AUDIT.md** - Complete cleanup audit and completion notes

---

## [1.0.0] - 2025-11-07

### Initial Release - MVP Complete

#### Core Features
- **Tab-based interface** - Browser-style tabs for terminals
- **15 terminal types** - Claude Code, Bash, TFE, LazyGit, and more
- **Full terminal emulation** - xterm.js with WebGL rendering
- **WebSocket communication** - Real-time I/O
- **Theme system** - 14 themes with intuitive aliases
- **Spawn menu** - Right-click or Ctrl+T to spawn terminals
- **Connection status** - Visual indicator for WebSocket state

#### Terminal Types Supported
- Claude Code (🤖)
- OpenCode (🔧)
- Gemini (✨)
- Docker AI (🐳)
- Orchestrator (🎭)
- Bash (💻)
- TFE - Terminal File Explorer (📁)
- LazyGit (🌿)
- PyRadio (📻)
- Micro Editor (✏️)
- htop (📊)
- bottom (📈)
- Spotify (🎵)
- Dev Logs (📋)
- TUI Tool (generic) (🖥️)

#### Themes Available
- Default (GitHub Dark)
- Retro Amber
- Matrix Rain
- Dracula
- Monokai
- Solarized Dark/Light
- GitHub Dark
- Nord
- Cyberpunk Neon
- Holographic
- Vaporwave Dreams
- Deep Ocean
- Neon City
- Tokyo Night

#### Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + PTY
- **State**: Zustand with localStorage persistence
- **Settings**: Global settings store
- **Communication**: WebSocket + REST API

---

## Upcoming Features (Planned)

### v1.2 - UX Improvements
- [ ] Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+1-9, Ctrl+Shift+T)
- [ ] Tab reordering (drag & drop)
- [ ] Tab context menu (close others, close to right, rename)
- [ ] Session manager UI (reconnect to orphaned tmux sessions)

### v1.3 - Mobile Support
- [ ] Responsive CSS for tablets/phones
- [ ] Touch-friendly tab switching
- [ ] Mobile keyboard support
- [ ] PWA manifest

### v2.0 - Advanced Features
- [ ] Claude Code theme integration (6 specialized palettes)
- [ ] Light theme support
- [ ] Split panes (or tmuxplexer templates)
- [ ] Tab groups/folders
- [ ] Search across terminals
- [ ] Export terminal output

---

## Technical Details

### Breaking Changes
None yet - this is the first stable release.

### Deprecations
None yet.

### Known Issues
- No keyboard shortcuts yet (planned for v1.2)
- Mobile responsiveness needs testing
- Tab bar doesn't scroll with many tabs (>10)

### Migration Notes
- **v1.0 → v1.1**: Automatic - localStorage schema is backward compatible
- **spawn-options.json**: Working as designed - each entry is essentially a "profile"

---

**Repository**: https://github.com/GGPrompts/terminal-tabs
**Parent Project**: https://github.com/GGPrompts/opustrator
**License**: MIT
