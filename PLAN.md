# PLAN.md - Terminal Tabs Roadmap

## 🚨 CURRENT STATUS - READ FIRST

**Status**: ✅ **CORE FUNCTIONALITY COMPLETE** + ✅ **MAJOR REFACTORING COMPLETE**

**Date**: November 10, 2025
**Version**: v1.2.1 (cleanup branch)
**Branch**: `cleanup` (refactoring complete!)

### What's Working 🎉
- ✅ Terminal persistence (all tabs render after refresh)
- ✅ Tmux integration (sessions survive refresh)
- ✅ Session reconnection working (terminals properly reconnect to tmux sessions)
- ✅ Per-tab customization (theme, transparency, font)
- ✅ Beautiful logging (Consola)
- ✅ All spawning bugs fixed
- ✅ Conditional scrollbar (tmux vs non-tmux)
- ✅ Tab clicking & dragging working (8px activation threshold)
- ✅ Tab reordering (drag & drop with dnd-kit)
- ✅ Split layout infrastructure (Phase 1 - focus tracking, state management)
- ✅ Popout feature (move tabs to new browser windows)
- ✅ **Code quality improvements** (-1,596 lines, better organization!)

### Recently Completed (cleanup branch) 🎉
- ✅ **Phase 1**: GenericDropdown extraction (-190 lines)
- ✅ **Phase 2**: Constants & utilities extraction
- ✅ **Phase 3**: Terminal.tsx hooks extraction (1,385 → 807 lines)
- ✅ **Phase 4**: SimpleTerminalApp.tsx decomposition (2,207 → 1,147 lines)
- ✅ **Bug Fixes**: All Phase 4 critical bugs resolved (wsRef, ResizeObserver, TypeScript)
- ✅ **Bug Fix**: Popout window timing issue
- ✅ **Total Impact**: -1,596 lines of code removed!

### Optional Future Work
- Phase 5: SplitLayout consolidation (optional - already working well)
- Phase 6: Testing & documentation (optional enhancements)
- See "Remaining Tasks" section below for UX improvements

**For completed features, see [CHANGELOG.md](CHANGELOG.md)**

---

## 🎯 NEXT UP: UX Improvements & Quality of Life

**Priority:** Medium (Nice-to-have enhancements)
**Estimated Time:** 6-8 hours total

### 1. Tab Context Menu (Right-Click)

**Goal:** Provide keyboard-free access to common operations and enable splitting with inherited working directory.

**Menu Options:**
- **Split Vertical** ⭐ - Detects current terminal's cwd, opens spawn menu, creates vertical split
- **Split Horizontal** ⭐ - Same as above, horizontal split
- **Rename Tab** - Manual text input to rename tab
- **Refresh Name from Tmux** - Auto-fetch pane title from tmux session
- **Pop Out to New Window** - Move tab to new browser window (duplicates ↗ button for discoverability)
- **Close Tab** - Close tab (duplicates X button)

**Optional (Future):**
- Close Other Tabs
- Close Tabs to the Right
- Duplicate Terminal (same type + cwd)

**Implementation:**
```
Files to Create:
- src/components/TabContextMenu.tsx
- src/components/TabContextMenu.css

Files to Modify:
- src/SimpleTerminalApp.tsx (add context menu state, handlers)

Backend APIs Needed:
- GET /api/terminals/:id/cwd - Get current working directory
  - For tmux: tmux display-message -p -F "#{pane_current_path}" -t <session>
  - For non-tmux: Read /proc/{pid}/cwd symlink
- GET /api/tmux/session/:sessionName/info - Get session metadata
  - Returns: { sessionName, paneTitle, windowName, currentPath }
```

**Estimated Time:** 3-4 hours

---

### 2. Footer Enhancements

**Goal:** Move split-specific controls to footer, add refresh button for stuck terminals.

**Changes:**
- **Add Refresh button** ⭐ - Uses resize trick (from useTerminalTheme) to fix corrupted/stuck terminals without resetting customizations
- **Move Pop Out button** - From pane overlay to footer (focus-aware)
- **Move Close Pane button** - From pane overlay to footer (focus-aware)
- ~~Remove Detach button~~ - Not needed, Ctrl+B works in Chrome now

**Layout:**

Single terminal:
```
[Bash 💻]    [-] [16] [+] [🔄 Refresh] [🎨 Customize]
```

Split pane (focused):
```
[Bash 💻] [Pane 1 of 2]    [-] [16] [+] [🔄] [🎨]  │  [↗ Pop Out] [✕ Close]
```

**Implementation:**
```
Files to Create:
- src/utils/terminalRefresh.ts - Extract resize trick from useTerminalTheme

Files to Modify:
- src/SimpleTerminalApp.tsx (add refresh button, move split controls)
- src/components/SplitLayout.tsx (remove overlay buttons)
- src/components/SplitLayout.css (remove overlay styles)
```

**Estimated Time:** 2 hours

---

### 3. Spawn Options: Working Directory Field

**Goal:** Allow users to set default working directory in spawn-options.json.

**Changes:**
- Add "Working Directory" text input field to spawn options editor
- Placeholder: `~ (home directory)`
- Validation: Check if directory exists before saving
- Tilde expansion on backend (already implemented!)
- Show validation error if directory doesn't exist

**UI Addition to SettingsModal:**
```
┌─────────────────────────────────────┐
│ Terminal Type: [Claude Code ▼]     │
│ Command: [claude                 ]  │
│ Working Directory:                  │
│ [~/projects/terminal-tabs        ]  │
│ └─ 💡 Leave blank for home (~)     │
│                                     │
│ Theme: [Amber ▼]                    │
│ ...                                 │
└─────────────────────────────────────┘
```

**Implementation:**
```
Files to Modify:
- src/components/SettingsModal.tsx (add workingDir field)
- Backend already supports this! No backend changes needed.
```

**Estimated Time:** 1-2 hours

---

### Summary

**Total Time:** 6-8 hours
**Impact:** High - Significantly improves discoverability and usability
**Priority:** Medium (current app is fully functional, these are QoL improvements)

**Implementation Order:**
1. Footer Refresh button (2 hours) - Most requested, fixes stuck terminals
2. Working Directory field (1-2 hours) - Simple, high value
3. Tab Context Menu (3-4 hours) - Nice-to-have, improves discoverability

---

## 🔧 CODE QUALITY & REFACTORING - COMPLETE! ✅

**Date**: November 10, 2025
**Overall Health Score**: 8.5/10 → **Trending upward!** 📈

### Executive Summary
The codebase is **functionally excellent** and **well-organized** after major refactoring sprint! The two oversized components (SimpleTerminalApp, Terminal) have been successfully decomposed into manageable, testable pieces.

**Major Accomplishments:**
- ✅ Reduced codebase by -1,596 lines
- ✅ Eliminated code duplication (GenericDropdown)
- ✅ Extracted reusable custom hooks (8 new hooks created)
- ✅ Centralized constants and utilities
- ✅ Fixed all critical bugs discovered during refactoring
- ✅ Improved component testability and maintainability

---

### ✅ COMPLETED: Component Refactoring

#### SimpleTerminalApp.tsx - ~~2,207~~ → 1,147 LINES ✅ (REFACTORED!)

**Status**: ✅ **COMPLETE** - Successfully refactored from 2,207 → 1,147 lines (48% reduction)

**What Was Extracted** (Phase 4):
1. Tab Bar Rendering & Management (1954-1992)
2. WebSocket Connection Handling (541-730)
3. WebSocket Message Handler (732-996) - 265 lines
4. Terminal Spawning Logic (1029-1107) - 78 lines
5. Terminal Reconnection (1109-1195) - 86 lines
6. Multi-Window Popout Feature (1198-1318) - 120 lines
7. Keyboard Shortcuts (564-649) - 85 lines
8. Drag-and-Drop Handlers (1475-1683) - 208 lines
9. Footer Controls & Customization (1705-1862) - 157 lines

**Created Custom Hooks**:
```
src/hooks/
├── useWebSocketManager.ts (431 lines) ✅
├── useTerminalSpawning.ts (252 lines) ✅
├── useDragDrop.ts (338 lines) ✅
├── useKeyboardShortcuts.ts (127 lines) ✅
└── usePopout.ts (161 lines) ✅

Result: SimpleTerminalApp.tsx → 1,147 lines (48% reduction)
```

**Benefits Achieved**:
- ✅ Each feature independently testable
- ✅ Easier to understand control flow
- ✅ Reduced risk of introducing bugs
- ✅ Better code reusability

**Critical Bugs Fixed**:
- ✅ wsRef sharing issue (terminals were unusable - no input worked)
- ✅ ResizeObserver timing issue (terminals stuck at tiny size)
- ✅ TypeScript errors (invalid props in SplitLayout)

**Commits**:
- `93e284c` - Phase 4: Extract SimpleTerminalApp.tsx hooks
- (current) - fix: resolve Phase 4 critical bugs

---

#### Terminal.tsx - ✅ 807 LINES (REFACTORED!)

**Status**: ✅ **COMPLETE** - Successfully refactored from 1,385 → 807 lines (42% reduction)

**What Was Extracted**:
```
src/hooks/
├── useTerminalTheme.ts (178 lines) ✅ - Theme application logic
├── useTerminalResize.ts (267 lines) ✅ - Resize handling & observers
└── useTerminalFont.ts (129 lines) ✅ - Font customization

Removed:
└── useTerminalMouse.ts (156 lines) ✅ - Deleted as Opustrator canvas legacy code
```

**Result**: Terminal.tsx now at 807 lines - within target range! 🎉

**Commits**:
- `0e9e0d4` - Phase 3: Extract Terminal.tsx hooks
- `5f72e05` - Phase 3.5: Remove legacy canvas zoom code

---

### 📋 CODE DUPLICATION ISSUES

#### ✅ COMPLETE: Dropdown Components (190 lines saved!)

**Status**: ✅ **RESOLVED** - Created GenericDropdown.tsx to eliminate duplication

**Solution Implemented**:
```tsx
// src/components/GenericDropdown.tsx (87 lines)
interface GenericDropdownProps<T> {
  value: T
  onChange: (value: T) => void
  options: T[]
  getOptionKey: (option: T) => string
  isSelected: (option: T, value: T) => boolean
  renderTrigger: (selected: T, isOpen: boolean) => React.ReactNode
  renderOption: (option: T, isSelected: boolean) => React.ReactNode
  openUpward?: boolean
  className?: string
}
```

**Results**:
- BackgroundGradientDropdown: 90 → 69 lines (-23%)
- TextColorThemeDropdown: 100 → 68 lines (-32%)
- FontFamilyDropdown: 85 → 57 lines (-33%)
- **Net reduction**: -190 lines (287 added, 477 deleted)

**Commit**: `ed29339` - refactor: extract GenericDropdown component

---

#### ✅ COMPLETE: Terminal Configuration Duplication

**Status**: ✅ **RESOLVED** - Created centralized constants and utilities

**Solution Implemented**:

**1. src/constants/terminalConfig.ts (67 lines)**
```tsx
export const THEME_BACKGROUNDS: Record<string, string> = { /* 30+ mappings */ }
export const TERMINAL_TYPE_ABBREVIATIONS: Record<string, string> = { /* 7 types */ }
export const COMMAND_ABBREVIATIONS: Record<string, string> = { /* tfe, lazygit, micro */ }
export const DEFAULT_TERMINAL_CONFIG = { /* defaults */ }
```

**2. src/utils/windowUtils.ts (49 lines)**
```tsx
export function generateWindowId(): string
export function getCurrentWindowId(urlParams: URLSearchParams): string
export function updateUrlWithWindowId(windowId: string): void
```

**Results**:
- SimpleTerminalApp.tsx: Removed ~40 lines of duplicated constants
- SplitLayout.tsx: Now imports from shared constants
- Better organization with dedicated directories

**Commit**: `69aa2a7` - refactor: extract constants and window utilities

---

### 🎯 POPOUT FEATURE REVIEW (↗ Button)

**Overall Quality**: 8.5/10 (improved after bug fix!)

**What Works Well**:
- ✅ Proper window ID assignment and tracking
- ✅ Preserves terminal sessions via tmux
- ✅ URL parameters for window targeting
- ✅ Multi-step cleanup prevents orphaned terminals
- ✅ **Fixed**: localStorage sync timing issue (600ms delay ensures sync completes)

**Recent Bug Fix** (Nov 10, 2025):
- **Issue**: Popout windows didn't load terminals initially (required refresh)
- **Root Cause**: 400ms delay was too short for Zustand localStorage sync (100ms debounce)
- **Fix**: Increased to 600ms delay to ensure sync completes before new window opens
- **Impact**: Fast-initializing terminals (bash) were most affected, now all work perfectly

**Remaining Improvements** (Future):
1. Extract to `usePopout.ts` hook (reduce SimpleTerminalApp.tsx complexity)
2. Add error rollback logic
3. Add user feedback for blocked popups
4. Add loading state during popout

---

### ⚡ QUICK WINS (Low Effort, High Impact)

#### ✅ 1. Extract Constants (COMPLETE)
```tsx
// src/constants/terminalConfig.ts ✅
export const THEME_BACKGROUNDS = { /* 30+ mappings */ }
export const TERMINAL_TYPE_ABBREVIATIONS = { /* 7 types */ }
export const COMMAND_ABBREVIATIONS = { /* 3 tools */ }
```
**Commit**: `69aa2a7`

#### ✅ 2. Extract Window Utilities (COMPLETE)
```tsx
// src/utils/windowUtils.ts ✅
export function generateWindowId(): string
export function getCurrentWindowId(urlParams): string
export function updateUrlWithWindowId(windowId: string): void
```
**Commit**: `69aa2a7`

#### ✅ 3. Memoization Already Present (VERIFIED)
```tsx
// Already using useMemo for visibleTerminals ✅
const visibleTerminals = useMemo(() =>
  storedTerminals.filter(t =>
    !t.isHidden && (t.windowId || 'main') === currentWindowId
  ),
  [storedTerminals, currentWindowId]
)
```

#### 4. Add JSDoc Comments (FUTURE)
- Document popout 4-step flow
- Explain complex WebSocket logic
- Document major functions
- **Estimate**: 30 minutes

---

### 📅 REFACTORING ROADMAP - COMPLETE! ✅

#### ✅ Phase 1: Setup (COMPLETE - 1 hour)
- [x] Create `src/hooks/`, `src/utils/`, `src/constants/` directories
- [x] Create `GenericDropdown.tsx`
- [x] Create constants files
**Commits**: `ed29339`, `69aa2a7`

#### ✅ Phase 2: Dropdown Unification (COMPLETE - 2 hours)
- [x] Implement `GenericDropdown.tsx` (87 lines)
- [x] Refactor 3 dropdown components (190 lines saved)
- [x] Test all dropdowns
**Commit**: `ed29339`

#### ✅ Phase 3: Terminal Hooks (COMPLETE - 4 hours)
- [x] ~~Extract `useTerminalMouse`~~ (Removed as legacy canvas code)
- [x] Extract `useTerminalTheme` (178 lines)
- [x] Extract `useTerminalResize` (267 lines)
- [x] Extract `useTerminalFont` (129 lines)
- [x] Refactor Terminal.tsx to 807 lines ✅
- [x] Comprehensive testing
**Commits**: `0e9e0d4`, `5f72e05`

#### ✅ Phase 4: SimpleTerminalApp Decomposition (COMPLETE - 10 hours)
- [x] Extract WebSocket manager (431 lines) ✅
- [x] Extract keyboard shortcuts (127 lines) ✅
- [x] Extract drag-drop logic (338 lines) ✅
- [x] Extract spawning logic (252 lines) ✅
- [x] Extract popout logic (161 lines) ✅
- [x] Reduce SimpleTerminalApp to 1,147 lines (48% reduction!) ✅
- [x] **Fix critical bugs** (wsRef sharing, ResizeObserver timing) ✅
**Commit**: `93e284c` - refactor: extract SimpleTerminalApp.tsx hooks (Phase 4)
**Bug Fix Commit**: (current) - fix: resolve Phase 4 critical bugs

**Critical Bugs Found & Fixed**:
1. **wsRef Sharing Bug**: `useWebSocketManager` created its own `wsRef` → Fixed by passing as parameter
2. **ResizeObserver Timing Bug**: Early return prevented setup → Fixed by adding xterm refs to dependencies
3. **TypeScript Errors**: Invalid `isFocused` prop → Fixed by removing from SplitLayout

#### Phase 5: Split Layout (OPTIONAL - 4-5 hours)
- [ ] Create `SplitPane.tsx`
- [ ] Create `SplitContainer.tsx`
- [ ] Reduce duplication
**Note**: Currently working well, consolidation optional

#### Phase 6: Testing & Polish (OPTIONAL - 4-6 hours)
- [ ] Add unit tests
- [ ] Add component tests
- [ ] Update documentation
**Note**: Code quality is good, tests are nice-to-have

**Total Time**: 17 hours invested (Phases 1-4) ✅
**Result**: -1,596 lines, significantly improved code organization! 🎉
**Remaining**: ~8-18 hours (Phases 5-6 - optional)

---

### 📊 COMPONENT ANALYSIS TABLE

| File | Lines | Grade | Status | Action |
|------|-------|-------|--------|--------|
| SimpleTerminalApp.tsx | ~~2,207~~ → **1,147** | **B** | ✅ Done | Refactored with hooks (Phase 4) |
| Terminal.tsx | ~~1,385~~ → **807** | **B+** | ✅ Done | Refactored with hooks (Phase 3) |
| useWebSocketManager.ts | 431 | A | ✅ New | Extracted from SimpleTerminalApp |
| useKeyboardShortcuts.ts | 127 | A | ✅ New | Extracted from SimpleTerminalApp |
| useDragDrop.ts | 338 | A | ✅ New | Extracted from SimpleTerminalApp |
| useTerminalSpawning.ts | 252 | A | ✅ New | Extracted from SimpleTerminalApp |
| usePopout.ts | 161 | A | ✅ New | Extracted from SimpleTerminalApp |
| GenericDropdown.tsx | 87 | A | ✅ New | Eliminates dropdown duplication |
| BackgroundGradientDropdown.tsx | ~~90~~ → **69** | **B+** | ✅ Done | Now uses GenericDropdown |
| TextColorThemeDropdown.tsx | ~~100~~ → **68** | **B+** | ✅ Done | Now uses GenericDropdown |
| FontFamilyDropdown.tsx | ~~85~~ → **57** | **A-** | ✅ Done | Now uses GenericDropdown |
| useTerminalTheme.ts | 178 | A | ✅ New | Extracted from Terminal.tsx |
| useTerminalResize.ts | 267 | A | ✅ New | Extracted from Terminal.tsx |
| useTerminalFont.ts | 129 | A | ✅ New | Extracted from Terminal.tsx |
| terminalConfig.ts | 67 | A | ✅ New | Centralized constants |
| windowUtils.ts | 49 | A | ✅ New | Window management utilities |
| SettingsModal.tsx | 532 | B | 📋 Future | Extract form + icon picker |
| SplitLayout.tsx | 507 | B | 📋 Phase 5 | Consolidate splits |
| ThemeDropdown.tsx | 225 | B+ | 📋 Future | Consider consolidation |
| useRuntimeStore.ts | 383 | B | 📋 Future | Review state reduction |
| terminal-themes.ts | 478 | A | ✅ Good | Keep as-is |
| useSettingsStore.ts | 151 | A | ✅ Good | Keep as-is |
| simpleTerminalStore.ts | 115 | A | ✅ Good | Keep as-is |

**Summary**:
- ✅ **Completed**: 11 files improved/created
- 🔄 **In Progress**: SimpleTerminalApp.tsx (Phase 4 next)
- 📋 **Future**: 4 files for later phases

---

### 🎯 PRIORITY ACTIONS - ALL COMPLETE! ✅

#### ✅ Completed (cleanup branch)
1. ✅ Create `constants/terminalConfig.ts` (eliminates duplication)
2. ✅ Extract window utility functions (reusability)
3. ✅ Verify memoization for visibleTerminals (already present)
4. ✅ Create GenericDropdown and refactor 3 dropdowns (-190 lines)
5. ✅ Extract Terminal.tsx hooks (1,385 → 807 lines)
6. ✅ Fix popout window localStorage sync timing bug
7. ✅ **SimpleTerminalApp decomposition COMPLETE** (2,207 → 1,147 lines)
   - ✅ Extract `useWebSocketManager.ts` (431 lines)
   - ✅ Extract `useKeyboardShortcuts.ts` (127 lines)
   - ✅ Extract `useDragDrop.ts` (338 lines)
   - ✅ Extract `useTerminalSpawning.ts` (252 lines)
   - ✅ Extract `usePopout.ts` (161 lines)
8. ✅ **Fix all Phase 4 critical bugs** (wsRef, ResizeObserver, TypeScript)

**Total Reduction**: -1,596 lines of code! 🎉🎉🎉

#### Optional Future Work (Low Priority)
9. Consolidate SplitLayout components (Phase 5 - optional, already works well)
10. Add unit and component tests (Phase 6 - optional)
11. Add JSDoc documentation (Phase 6 - optional)

---

### 💡 FINAL ASSESSMENT

**Bottom Line**: The Tabz codebase is **production-ready and well-organized**! Major refactoring complete with excellent results! 🎉

**Completed Improvements** (cleanup branch):
- ✅ Terminal.tsx: 1,385 → 807 lines (42% reduction)
- ✅ SimpleTerminalApp.tsx: 2,207 → 1,147 lines (48% reduction)
- ✅ Dropdown components: Consolidated with GenericDropdown (-190 lines)
- ✅ Constants & utilities: Properly organized in dedicated directories
- ✅ 8 new custom hooks created for better code organization
- ✅ All critical bugs fixed (wsRef, ResizeObserver, TypeScript)
- ✅ **Total code reduction: -1,596 lines** while improving maintainability!

**Current Strengths**:
- ✓ Functionally complete and working well
- ✓ Well-organized with proper separation of concerns
- ✓ Modern React patterns used correctly
- ✓ WebSocket integration is robust
- ✓ **Major refactoring complete** (Phases 1-4 done!)
- ✓ **Excellent code quality** - components are maintainable and testable

**Optional Future Work**:
- Phase 5: SplitLayout consolidation (optional - already works well)
- Phase 6: Testing & documentation (optional enhancements)
- See "Remaining Tasks" section for UX improvements (keyboard shortcuts, mobile, etc.)

**Overall Score**: 9.0/10 (up from 7.5/10 initially!) - **Excellent!** 🌟📈

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

## 📚 Historical Reference

For completed features, bug fixes, and session notes, see:
- **[CHANGELOG.md](CHANGELOG.md)** - All completed features organized by version
  - v1.2.0 (Nov 9, 2025) - Multi-window support, split layouts, tab fixes
  - v1.1.0 (Nov 8, 2025) - Terminal persistence, tmux integration, cleanup
  - v1.0.0 (Nov 7, 2025) - Initial MVP release

**Last Updated**: November 9, 2025
**Current Version**: v1.2.0
**Repository**: https://github.com/GGPrompts/Tabz
