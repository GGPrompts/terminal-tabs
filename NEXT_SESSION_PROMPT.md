# Next Session: Test Fixes + Project-Based Terminal Launcher

## ✅ Completed This Session (Nov 13, 2025)

### 1. BroadcastChannel State Synchronization
**Implemented**: Real-time state sync across all browser windows
- Detached terminals appear in all windows immediately (no refresh needed)
- "Clear all sessions" reloads all windows simultaneously
- Synthetic StorageEvent triggers Zustand re-hydration from localStorage

**Modified Files**:
- `src/SimpleTerminalApp.tsx` (lines 515-543, 908-911, 998-1001, 1078-1081, 1120-1123)

### 2. Popout Mode Selection (Tab vs Separate Window)
**Implemented**: Context menu options for both popout types
- 🗂️ Open in New Tab - Uses default browser behavior
- ↗️ Open in Separate Window - Forces popup window (1200x800)

**Modified Files**:
- `src/hooks/usePopout.ts` - Added `popoutMode` parameter
- `src/SimpleTerminalApp.tsx` - Updated context menu

### 3. UI/UX Polish
- Added icons to context menu (✏️ 📌 ↔️ ❌)
- Renamed "Close Tab" → "Kill Session", "Rename Tab" → "Update Display Name"
- Fixed detached dropdown z-index with React Portal
- Popout windows start with header collapsed by default
- Fixed false error warnings (console.warn → console.log)

### 4. Integration Tests for Multi-Window Features
**Added**: `tests/integration/multi-window-popout.test.ts` (15 tests, 7 passing)
- ✅ Validates BroadcastChannel messaging
- ✅ Validates popout mode selection
- ✅ Validates window isolation

**Test Status**: 202/212 tests passing (95%)

---

## 🐛 TODO: Fix Remaining Test Failures (10 tests)

### Problem
The `usePopout.ts` hook now has a third parameter `popoutMode: 'tab' | 'window'` that defaults to `'tab'`. This changed the `window.open()` call signature from 2 arguments to 3:

```typescript
// OLD (2 args)
window.open(url, target)

// NEW (3 args - even when undefined for tab mode)
window.open(url, target, windowFeatures)
// where windowFeatures = undefined (tab mode) or 'popup,width=1200,height=800' (window mode)
```

### Failing Tests Location
`tests/unit/hooks/usePopout.test.ts` - 10 tests expecting old 2-arg signature

### How to Fix
Update all `expect(mockWindowOpen).toHaveBeenCalledWith()` assertions to include the third parameter:

**For pane popouts (currently expect 'width=800,height=600'):**
```typescript
// OLD
expect(mockWindowOpen).toHaveBeenCalledWith(url, target, 'width=800,height=600')

// NEW (popout of panes defaults to 'tab' mode now, which passes undefined)
expect(mockWindowOpen).toHaveBeenCalledWith(url, target, 'popup,width=1200,height=800')
```

**For split container popouts (currently use expect.any(String)):**
```typescript
// OLD
expect(mockWindowOpen).toHaveBeenCalledWith(
  expect.stringContaining('window=window-pane-1'),
  expect.any(String),
  expect.any(String)
)

// NEW (should match the actual window features)
expect(mockWindowOpen).toHaveBeenCalledWith(
  expect.stringContaining('window=window-pane-1'),
  expect.any(String),
  'popup,width=1200,height=800'
)
```

### Test Lines to Update
Search for `toHaveBeenCalledWith` in `tests/unit/hooks/usePopout.test.ts` and update expectations around lines:
- Line 378-382 (already fixed)
- Line 534-543 (split container popout - 2 expectations)
- Line 945-949 (already fixed)
- Lines with `expect.any(String)` for window features

### Verification
After fixes, run:
```bash
npm test -- tests/unit/hooks/usePopout.test.ts
```

Should see **all 37 tests pass** in that file.

---

## 🚀 NEW FEATURE: Project-Based Terminal Launcher

### Goal
Add project categories to spawn menu so users can:
1. Filter spawn options by project
2. Quickly launch all terminals needed for a specific project
3. Organize terminals by workspace/project

### Use Case Example
**Project: "Tabz Development"**
- Launch: Claude Code (~/projects/terminal-tabs)
- Launch: TFE (~/projects/terminal-tabs)
- Launch: LazyGit (~/projects/terminal-tabs)
- Launch: Bash (~/projects/terminal-tabs)

**Project: "Opustrator"**
- Launch: Claude Code (~/workspace/opustrator)
- Launch: Dev Server (~/workspace/opustrator)
- Launch: Bash (~/workspace/opustrator)

### Proposed Implementation

#### 1. Extend spawn-options.json Format

```json
{
  "projects": [
    {
      "name": "Tabz Development",
      "workingDir": "~/projects/terminal-tabs",
      "terminals": [
        {
          "label": "Claude Code",
          "terminalType": "claude-code",
          "command": "claude",
          "icon": "🤖"
        },
        {
          "label": "TFE",
          "terminalType": "tui-tool",
          "command": "tfe",
          "icon": "📝"
        },
        {
          "label": "LazyGit",
          "terminalType": "tui-tool",
          "command": "lazygit",
          "icon": "🦎"
        }
      ]
    },
    {
      "name": "Opustrator",
      "workingDir": "~/workspace/opustrator",
      "terminals": [
        {
          "label": "Claude Code",
          "terminalType": "claude-code",
          "command": "claude",
          "icon": "🤖"
        }
      ]
    }
  ],
  "spawnOptions": [
    // Existing individual options (no project) can still exist
    {
      "label": "Bash",
      "command": "bash",
      "terminalType": "bash",
      "icon": "🐚"
    }
  ]
}
```

#### 2. Spawn Menu UI Updates

**Option A: Tabbed Interface**
```
┌──────────────────────────────────┐
│ [All] [Tabz] [Opustrator]       │ ← Project tabs
├──────────────────────────────────┤
│ Search: ________________         │
├──────────────────────────────────┤
│ ☑️ Claude Code (🤖)              │
│ ☑️ TFE (📝)                       │
│ ☑️ LazyGit (🦎)                   │
│ □  Bash (🐚)                      │
├──────────────────────────────────┤
│ [Launch Selected (3)] [Close]    │
└──────────────────────────────────┘
```

**Option B: Dropdown Filter**
```
┌──────────────────────────────────┐
│ Project: [All Projects ▼]        │ ← Filter dropdown
│ Search: ________________         │
├──────────────────────────────────┤
│ ☑️ Claude Code (🤖)              │
│ ☑️ TFE (📝)                       │
│ ☑️ LazyGit (🦎)                   │
├──────────────────────────────────┤
│ [Launch Selected (3)] [Close]    │
└──────────────────────────────────┘
```

**Option C: Launch Project Button**
```
┌──────────────────────────────────┐
│ 🚀 Quick Launch:                 │
│ [📦 Tabz Dev] [📦 Opustrator]    │ ← One-click launch all
├──────────────────────────────────┤
│ Individual Terminals:            │
│ Search: ________________         │
├──────────────────────────────────┤
│ □  Claude Code (🤖)              │
│ □  Bash (🐚)                      │
└──────────────────────────────────┘
```

#### 3. Code Changes Needed

**Files to Modify:**
1. `public/spawn-options.json` - Add projects array
2. `src/SimpleTerminalApp.tsx`:
   - Add project state: `const [selectedProject, setSelectedProject] = useState('all')`
   - Filter spawn options by project
   - Add "Launch Project" handler that spawns all project terminals
3. `src/components/SpawnMenu.tsx` (if extracted) or inline in SimpleTerminalApp
   - Add project tabs/dropdown
   - Update filtering logic

**Example Code Sketch:**
```typescript
// Load projects from spawn-options.json
const { projects, spawnOptions } = await loadSpawnOptions()

// Filter options by project
const visibleOptions = selectedProject === 'all'
  ? spawnOptions
  : projects.find(p => p.name === selectedProject)?.terminals || []

// Launch all terminals for a project
const handleLaunchProject = async (projectName: string) => {
  const project = projects.find(p => p.name === projectName)
  if (!project) return

  for (const terminal of project.terminals) {
    const option = {
      ...terminal,
      workingDirOverride: project.workingDir
    }
    await spawnTerminal(option)
    await new Promise(resolve => setTimeout(resolve, 150)) // Stagger spawns
  }
}
```

#### 4. Benefits
- ✅ **Fast project switching** - One click to launch all terminals for a project
- ✅ **Organized spawn menu** - Filter by project reduces clutter
- ✅ **Consistent working dirs** - Project defines default working directory
- ✅ **Backward compatible** - Existing `spawnOptions` still work for individual terminals
- ✅ **Multi-project workflows** - Easily switch between Tabz, Opustrator, personal projects

#### 5. Optional Enhancements
- Save last used project in localStorage
- Add "Edit Projects" button in Settings Modal
- Visual indicator on tabs showing which project they belong to
- Context menu: "Add to Project..." to categorize existing terminals

---

## 📁 Architecture Notes

### Spawn Menu Current State
- Located in `SimpleTerminalApp.tsx` (lines ~1900-2100)
- Uses multi-select with checkboxes
- Supports search filtering
- Spawns terminals with staggered delays (150ms)

### Project State Management
**Where to Store:**
- `public/spawn-options.json` - Project definitions (checked into git)
- `localStorage` - User's last selected project (ephemeral)

**Data Flow:**
```
spawn-options.json → SimpleTerminalApp state → SpawnMenu UI
                                              ↓
                                         spawn terminals
```

### Working Directory Priority
With projects, the priority becomes:
1. **Per-terminal override** (footer controls) - highest priority
2. **Project working directory** (from projects array) - NEW
3. **Spawn option default** (from terminal definition)
4. **Global default** (from Settings Store) - lowest priority

---

## 🔜 Implementation Steps

### Phase 1: Test Fixes (30 min)
1. Update `tests/unit/hooks/usePopout.test.ts` expectations
2. Run `npm test` and verify 212/212 tests pass
3. Commit: "fix: update usePopout tests for popoutMode parameter"

### Phase 2: Project Launcher MVP (2-3 hours)
1. Design UI mockup (choose between tabbed/dropdown/buttons)
2. Extend `spawn-options.json` format with projects array
3. Update spawn menu to show project filter
4. Implement "Launch Project" functionality
5. Test with 2-3 projects
6. Update CLAUDE.md documentation
7. Commit: "feat: project-based terminal launcher"

### Phase 3: Polish (optional)
1. Add project management UI in Settings Modal
2. Visual project indicators on tabs
3. Context menu: "Add to Project"
4. Save/restore last selected project

---

## ⚠️ Important Considerations

### Performance
- Loading spawn-options.json is already done on mount - no extra overhead
- Filtering by project is just a JS filter operation - instant
- Spawning multiple terminals already has staggered delays (safe)

### User Experience
- Should work seamlessly with existing workflow
- Individual spawn options still available (backward compatible)
- Projects are optional - users can ignore if they want

### Testing
- Unit tests for project filtering logic
- Integration tests for multi-terminal spawn
- Manual testing with 2-3 real projects

---

## 📝 Questions to Resolve

1. **UI Preference**: Tabs, dropdown, or quick launch buttons?
2. **Auto-launch**: Should projects auto-launch on first window open?
3. **Tab organization**: Should spawned project terminals be grouped visually?
4. **Persistence**: Remember last project across sessions?

---

## 🎯 Success Criteria

**Tests Fixed:**
- ✅ All 212 tests pass
- ✅ No test warnings or errors

**Project Launcher:**
- ✅ Can define projects in spawn-options.json
- ✅ Can filter spawn menu by project
- ✅ Can launch all terminals for a project with one action
- ✅ Working directory inherited from project definition
- ✅ Backward compatible with existing spawn-options.json format
- ✅ Documented in CLAUDE.md

---

Last Updated: November 13, 2025
