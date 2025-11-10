# PLAN.md - Terminal Tabs Roadmap

## 🚨 CURRENT STATUS

**Date**: November 10, 2025
**Version**: v1.3.0 (sessionmanager branch)
**Branch**: `sessionmanager`

### What's Working 🎉
- ✅ Terminal persistence & reconnection
- ✅ Multi-window support with popout
- ✅ Split terminals (horizontal/vertical)
- ✅ Detached sessions management
- ✅ Tmux health monitoring (15-second check)
- ✅ Per-tab customization
- ✅ Tab context menu (right-click)
- ✅ Code quality improvements (-1,596 lines!)
- ✅ **NEW: Orphaned session detection & adoption**
- ✅ **NEW: Footer reorganization with per-terminal detach**
- ✅ **NEW: Spawn menu Select All/Deselect All**
- ✅ **NEW: Split tabs show both pane names**
- ✅ **NEW: Mobile-optimized scrolling**

**For completed features, see [CHANGELOG.md](CHANGELOG.md)**

---

## ✅ PRIORITY 1: Orphaned Session Detection & Adoption [COMPLETED]

**Priority**: Critical (Fixes reconnection issues + enables scriptable workflows)
**Estimated Time**: 4-5 hours (6 phases)
**Status**: ✅ **COMPLETED** - November 10, 2025

### The Problem

**Reconnection Issue:**
- Page refresh sometimes leaves terminals stuck at "Connecting to Terminal..."
- Backend has tmux sessions (e.g., `tt-bash-xyz`, `tt-cc-abc`)
- localStorage has different sessions or missing terminals
- Sessions don't match → can't reconnect

**Missing Workflow:**
- Can't adopt externally created tmux sessions
- No visibility into orphaned sessions
- Manual session cleanup required

### The Solution: Orphan Detection & Adoption

**This is both a bug fix AND an intentional feature!** Orphan detection serves two purposes:
1. **Bug Recovery**: Fixes reconnection issues when localStorage/tmux mismatch
2. **Intentional Workflow**: External tools (tmuxplexer, CLI scripts, TUI apps) can spawn sessions that Tabz adopts

This creates a **bi-directional workflow** - spawn from CLI/TUI, manage in UI. **No other terminal manager has this!**

**Header Stats:**
```
A: 2  D: 0  O: 5
          ^^^^^ NEW!
```
- **A (Active)**: Terminals with connections
- **D (Detached)**: Terminals marked as detached
- **O (Orphans)**: Tmux sessions with NO matching terminal in localStorage

**Click O: 5** → Opens Session Manager with orphans group

### Session Manager with Orphans

```
┌─────────────────────────────────────────────────────┐
│ Session Manager                           [Refresh] │
├─────────────────────────────────────────────────────┤
│ 🟢 Active in This Window (2)          [Collapse ▼] │
│   📟 Pyradio (tt-tui-eo2)                           │
│   🎨 TFE (tt-tfe-abc)                               │
│                                                      │
│ ⏸️  Detached Sessions (0)              [Collapse ▼] │
│   (empty)                                            │
│                                                      │
│ 🔴 Orphaned Sessions (5)               [Collapse ▼] │
│   ☑ tt-bash-8fs                                     │
│   ☑ tt-bash-tfg                                     │
│   ☑ tt-cc-s9y                                       │
│   ☑ tt-tfe-iej                                      │
│   ☑ tt-tui-bi4                                      │
│                                                      │
│   [✓ Select All] [Adopt Selected (5)] [Kill All]   │
└─────────────────────────────────────────────────────┘
```

### Revolutionary Workflow: Script-Based Spawning

**Users can create tmux sessions externally, then bulk-adopt in Tabz!**

#### Integration Examples

**1. Development Environment Setup:**
```bash
#!/bin/bash
# setup-dev-environment.sh

# Create 10 tmux sessions with tt- prefix
tmux new -d -s tt-cc-main "claude"
tmux new -d -s tt-bash-api "cd ~/api && npm run dev"
tmux new -d -s tt-bash-frontend "cd ~/frontend && npm start"
tmux new -d -s tt-bash-db "docker-compose up"
tmux new -d -s tt-tfe-explore "tfe ~/project"
tmux new -d -s tt-bash-logs "tail -f /var/log/app.log"
tmux new -d -s tt-bash-test "npm test -- --watch"
tmux new -d -s tt-cc-review "claude --prompt 'review mode'"
tmux new -d -s tt-bash-monitor "htop"
tmux new -d -s tt-tui-games "tui-classics"

echo "✅ Created 10 sessions. Open Tabz → O: 10 → Select All → Adopt!"
```

**Then in Tabz:**
1. Header shows **O: 10**
2. Click **O: 10** in header OR right-click → spawn menu → "📂 Session Manager (10 orphaned)"
3. Modal opens with orphans section
4. Check all boxes (or click "Select All")
5. Click **"Adopt Selected (10)"**
6. **BOOM - 10 tabs appear instantly!**

**2. tmuxplexer Integration:**
```bash
# In tmuxplexer TUI, create workspace
tmux new -s tt-bash-api "cd ~/api && npm run dev"
tmux new -s tt-bash-frontend "cd ~/frontend && npm start"
tmux new -s tt-cc-main "cd ~/project && claude"

# Switch to Tabz browser window
# O: 3 appears in header → Adopt all 3 → Full UI control!
```

**3. CLI Aliases for Power Users:**
```bash
# Add to ~/.bashrc or ~/.zshrc
alias spawn-claude="tmux new -d -s tt-cc-$(date +%s) claude"
alias spawn-bash="tmux new -d -s tt-bash-$(date +%s)"
alias spawn-tfe="tmux new -d -s tt-tfe-$(date +%s) tfe"

# Usage: spawn-claude, then adopt in Tabz
```

### Implementation Plan

#### Phase 1: Detect Orphans (1 hour)

**Backend already has sessions**, just need to detect orphans in frontend:

```typescript
// src/hooks/useWebSocketManager.ts
// After receiving tmux-sessions-list

const orphanedSessions = useMemo(() => {
  // Get all session names from stored terminals
  const storedSessions = new Set(
    storedTerminals
      .filter(t => t.sessionName)
      .map(t => t.sessionName)
  )

  // Find tmux sessions NOT in localStorage
  return activeSessions.filter(session =>
    !storedSessions.has(session)
  )
}, [activeSessions, storedTerminals])

// Pass to parent via callback
useEffect(() => {
  onOrphansDetected?.(orphanedSessions)
}, [orphanedSessions])
```

**Update SimpleTerminalApp.tsx:**
```typescript
const [orphanedSessions, setOrphanedSessions] = useState<string[]>([])

// In useWebSocketManager call
const wsManager = useWebSocketManager({
  // ... existing props
  onOrphansDetected: setOrphanedSessions
})

// Calculate orphan count
const orphanCount = orphanedSessions.length
```

#### Phase 2: Update Header Stats (30 minutes)

```tsx
// src/SimpleTerminalApp.tsx - Header
<div className="header-stats-container">
  <span className="stat active-stat" title="Active terminals">
    A: {activeCount}
  </span>
  <span
    className={`stat detached-stat ${detachedCount > 0 ? 'has-detached' : ''}`}
    title="Detached sessions"
    onClick={() => detachedCount > 0 && setShowSessionsModal(true)}
  >
    D: {detachedCount}
  </span>
  <span
    className={`stat orphan-stat ${orphanCount > 0 ? 'has-orphans' : ''}`}
    title="Orphaned tmux sessions (click to adopt)"
    onClick={() => orphanCount > 0 && setShowSessionsModal(true)}
  >
    O: {orphanCount}
  </span>
</div>
```

**CSS:**
```css
.orphan-stat {
  color: #ff6b6b;
}

.orphan-stat.has-orphans {
  color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
  cursor: pointer;
  font-weight: 600;
}
```

#### Phase 3: Add Orphans Group to Modal (1-2 hours)

**Rename modal and add orphans:**
```typescript
// src/components/DetachedSessionsModal.tsx → SessionsModal.tsx

interface SessionsModalProps {
  isOpen: boolean
  onClose: () => void
  detachedSessions: StoredTerminal[]
  orphanedSessions: string[]  // NEW
  onReattach: (terminalIds: string[]) => void
  onAdoptOrphans: (sessionNames: string[]) => void  // NEW
  onKill: (terminalIds: string[]) => void
  onKillOrphans: (sessionNames: string[]) => void  // NEW
}

// Add state for orphan selection
const [orphanSelectedIds, setOrphanSelectedIds] = useState<Set<string>>(new Set())

// Render orphans group (REUSE existing checkbox pattern from detached!)
{orphanedSessions.length > 0 && (
  <div className="session-group">
    <div className="session-group-header">
      <span>🔴 Orphaned Sessions ({orphanedSessions.length})</span>
    </div>
    <div className="session-group-content">
      {orphanedSessions.map(sessionName => (
        <div key={sessionName} className="session-item orphan-item">
          <input
            type="checkbox"
            checked={orphanSelectedIds.has(sessionName)}
            onChange={() => toggleOrphanSelection(sessionName)}
          />
          <span className="session-icon">❓</span>
          <span className="session-name">{sessionName}</span>
        </div>
      ))}

      {/* Bulk Actions */}
      <div className="modal-actions">
        <button
          disabled={orphanSelectedIds.size === 0}
          onClick={() => onAdoptOrphans(Array.from(orphanSelectedIds))}
        >
          🔄 Adopt Selected ({orphanSelectedIds.size})
        </button>
        <button
          disabled={orphanSelectedIds.size === 0}
          onClick={() => onKillOrphans(Array.from(orphanSelectedIds))}
        >
          ✕ Kill Selected ({orphanSelectedIds.size})
        </button>
      </div>
    </div>
  </div>
)}
```

#### Phase 4: Implement Adoption (1 hour)

```typescript
// src/SimpleTerminalApp.tsx

const handleAdoptOrphans = async (sessionNames: string[]) => {
  console.log(`🔄 Adopting ${sessionNames.length} orphaned sessions...`)

  for (const sessionName of sessionNames) {
    // Infer terminal type from prefix
    const terminalType = sessionName.startsWith('tt-cc-') ? 'claude-code'
                       : sessionName.startsWith('tt-bash-') ? 'bash'
                       : sessionName.startsWith('tt-tfe-') ? 'tui-tool'
                       : sessionName.startsWith('tt-tui-') ? 'tui-tool'
                       : 'bash'  // default

    // Find spawn option for this type
    const option = spawnOptions.find(opt => opt.terminalType === terminalType)
    if (!option) {
      console.warn(`No spawn option for type: ${terminalType}`)
      continue
    }

    // Create terminal in localStorage
    const newTerminal = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: sessionName.replace('tt-', '').replace(/-/g, ' '),  // "tt-bash-api" → "bash api"
      terminalType,
      icon: option.icon,
      sessionName,
      status: 'spawning',
      windowId: currentWindowId,
      createdAt: Date.now(),
      theme: option.defaultTheme || 'default',
      transparency: option.defaultTransparency || 85,
      background: option.defaultBackground || 'dark-neutral',
      fontSize: option.defaultFontSize || 16,
      fontFamily: option.defaultFontFamily || "'Berkeley Mono', monospace",
      command: option.command,
      workingDir: option.workingDir || '~',
    }

    addTerminal(newTerminal)

    // Trigger reconnection
    await handleReconnectTerminal(newTerminal, option)
  }

  setShowSessionsModal(false)
  console.log(`✅ Adopted ${sessionNames.length} sessions`)
}

const handleKillOrphans = async (sessionNames: string[]) => {
  for (const sessionName of sessionNames) {
    try {
      await fetch(`${API_URL}/api/tmux/kill/${sessionName}`, {
        method: 'POST'
      })
      console.log(`✅ Killed orphan: ${sessionName}`)
    } catch (error) {
      console.error(`Failed to kill ${sessionName}:`, error)
    }
  }

  setShowSessionsModal(false)
}
```

#### Phase 5: Update Spawn Menu Integration (15 minutes)

**Update existing detached sessions spawn option to include orphans:**

```tsx
// src/SimpleTerminalApp.tsx - Spawn menu rendering

{/* UPDATED: Show when EITHER detached OR orphans exist */}
{(detachedCount > 0 || orphanCount > 0) && (
  <div
    className="spawn-option session-manager-option"
    onClick={() => setShowSessionsModal(true)}
  >
    <span className="spawn-icon">📂</span>
    <div className="spawn-details">
      <div className="spawn-label">
        Session Manager
        {detachedCount > 0 && orphanCount > 0 && ` (${detachedCount + orphanCount})`}
        {detachedCount > 0 && orphanCount === 0 && ` (${detachedCount} detached)`}
        {detachedCount === 0 && orphanCount > 0 && ` (${orphanCount} orphaned)`}
      </div>
      <div className="spawn-description">
        {detachedCount > 0 && orphanCount > 0 && 'Manage detached & orphaned sessions'}
        {detachedCount > 0 && orphanCount === 0 && 'Reattach detached sessions'}
        {detachedCount === 0 && orphanCount > 0 && 'Adopt orphaned tmux sessions'}
      </div>
    </div>
  </div>
)}
```

**Benefits of unified approach:**
- Single menu item (cleaner UI)
- Modal already has grouped sections (detached + orphans)
- Users see both types of sessions in one place
- No need for additional CSS styling

#### Phase 6: Update CLAUDE.md Documentation (30 minutes)

**Add section on External Session Integration:**

```markdown
## External Session Integration

### Spawning Sessions for Tabz from TUI Apps

You can create tmux sessions outside Tabz and adopt them as tabs:

1. **Create session with `tt-` prefix:**
   ```bash
   tmux new -s tt-bash-mywork
   tmux new -s tt-cc-review
   tmux new -s tt-tfe-explore
   ```

2. **Adopt in Tabz:**
   - Header shows O: 3 (orphan count)
   - Click O: 3 or open Session Manager
   - Select sessions to adopt
   - Click "Adopt Selected" → Becomes full Tabz tabs

### Use Cases

- **tmuxplexer integration** - Create complex layouts in TUI, manage in UI
- **CLI scripting** - Spawn sessions from scripts, organize in Tabz
- **Remote sessions** - Create on server, adopt locally (if backend can reach)
- **Quick spawns** - `tmux new -s tt-bash-work` from any terminal

### Naming Convention

- `tt-bash-*` → Adopted as Bash terminal
- `tt-cc-*` → Adopted as Claude Code
- `tt-tfe-*` → Adopted as TFE
- `tt-tui-*` → Adopted as TUI tool

### Example Workflow

```bash
#!/bin/bash
# setup-workspace.sh

# Create development environment
tmux new -d -s tt-cc-main "claude"
tmux new -d -s tt-bash-api "cd ~/api && npm run dev"
tmux new -d -s tt-bash-frontend "cd ~/frontend && npm start"
tmux new -d -s tt-tfe-explore "tfe ~/project"

echo "✅ Created 4 sessions. Open Tabz → O: 4 → Adopt!"
```

**CLI Aliases for Quick Spawning:**
```bash
alias spawn-claude="tmux new -d -s tt-cc-$(date +%s) claude"
alias spawn-bash="tmux new -d -s tt-bash-$(date +%s)"
alias spawn-tfe="tmux new -d -s tt-tfe-$(date +%s) tfe"
```
```

### Files to Modify

**Frontend:**
- `src/hooks/useWebSocketManager.ts` - Detect orphans, add callback
- `src/SimpleTerminalApp.tsx` - Header stats, orphan state, unified spawn menu, adopt/kill handlers
- `src/SimpleTerminalApp.css` - Orphan stat styling (header only)
- `src/components/DetachedSessionsModal.tsx` → `SessionsModal.tsx` - Add orphans group
- `src/components/DetachedSessionsModal.css` → `SessionsModal.css` - Orphan group styling

**Documentation:**
- `CLAUDE.md` - Add "External Session Integration" section

**Backend:**
- No changes needed! (Already has `/api/tmux/kill/:name`)

### Testing Checklist

**Orphan Detection:**
- [ ] Create tmux session manually: `tmux new -s tt-bash-test`
- [ ] Header shows O: 1
- [ ] Click O: 1 opens modal
- [ ] Session appears in orphans group with correct icon

**External Session Creation (tt-* Prefix):**
- [ ] Create `tt-bash-mywork` - Shows as bash terminal with 🔧 icon
- [ ] Create `tt-cc-review` - Shows as Claude Code with 🤖 icon
- [ ] Create `tt-tfe-explore` - Shows as TFE with 🎨 icon
- [ ] Create `tt-tui-radio` - Shows as TUI tool with 📟 icon
- [ ] All correctly infer terminal type from prefix
- [ ] All adopt with correct default settings (theme, font, etc.)

**Spawn Menu Integration:**
- [ ] D: 0, O: 0 - Session Manager option NOT shown in spawn menu
- [ ] D: 2, O: 0 - Shows "📂 Session Manager (2 detached)"
- [ ] D: 0, O: 3 - Shows "📂 Session Manager (3 orphaned)"
- [ ] D: 2, O: 3 - Shows "📂 Session Manager (5)" with combined count
- [ ] Click option opens Session Manager modal
- [ ] Modal shows both detached and orphans sections when both exist

**Bulk Adoption:**
- [ ] Create 5 sessions with script (different types)
- [ ] Header shows O: 5
- [ ] Select all checkboxes
- [ ] Click "Adopt Selected (5)"
- [ ] 5 tabs appear instantly in current window
- [ ] All terminals connect properly
- [ ] All have correct icons, themes, and settings

**Reconnection Fix:**
- [ ] Spawn terminals normally
- [ ] Hard refresh
- [ ] Terminals reconnect within 30 seconds
- [ ] No orphans appear (all matched correctly)
- [ ] After 30 seconds, no more reconnection spam

**Kill Orphans:**
- [ ] Select orphan checkboxes
- [ ] Click "Kill Selected"
- [ ] Sessions disappear from tmux ls
- [ ] O: count decreases
- [ ] Modal updates immediately

**Documentation:**
- [ ] CLAUDE.md has "External Session Integration" section
- [ ] Examples work correctly (copy-paste from docs)
- [ ] CLI aliases work as documented

### Benefits

1. **Fixes reconnection issues** - Clear visibility into why terminals aren't connecting
2. **Scriptable workflows** - Create 10 sessions, adopt all at once
3. **Multi-agent coordination** - Spawn specialized Claude instances via script
4. **Development automation** - One command = full dev environment
5. **Microservices management** - Each service in a tab
6. **Remote session adoption** - SSH into server, create sessions, adopt locally

---

## 🎯 PRIORITY 1.5: Global Tab Bar (Ghosted Tabs)

**Priority**: High (Better multi-window UX)
**Estimated Time**: 2-3 hours
**Status**: Planning phase
**Depends On**: Priority 1 (Session Manager must be complete first)

### The Concept

**Current behavior:** Each window only shows its own tabs
**New behavior:** All windows show ALL tabs, with visual distinction

### Visual Design

**Tab Bar in Window 1:**
```
[🤖 Claude Code]  [🔧 Bash API]  [🎨 TFE]  [📟 Radio]  [🔍 Logs]
   ^^^solid^^^       ^^^solid^^^   ^^^solid^^^  ~~dimmed~~  ~~dimmed~~
   (this window)     (this window) (this window) (Window 2)  (Window 2)
```

**What happens on click:**
- **Solid tab** → Focus that tab (normal behavior)
- **Dimmed tab** → Teleport to current window, then focus

**Hover tooltips:**
- Solid: "Focus terminal"
- Dimmed: "Move here from Window 2"

### Benefits

1. **Unified mental model** - "All my terminals are always visible"
2. **No popout button needed** - Just click tab in other window
3. **Perfect for multi-monitor** - See everything, grab what you need
4. **Simpler Session Manager** - No "active in other windows" group needed
5. **Like browser bookmarks** - Same bar across all windows

### Implementation Plan

#### Phase 1: Remove Window Filtering (30 minutes)

**Show all tabs in every window:**
```typescript
// src/SimpleTerminalApp.tsx

// OLD: Window-scoped tabs
const visibleTerminals = storedTerminals.filter(t =>
  (t.windowId || 'main') === currentWindowId && !t.isHidden && !t.isDetached
)

// NEW: Global tabs (all windows)
const allTabs = storedTerminals.filter(t => !t.isHidden && !t.isDetached)

// Group by ownership
const ownedByThisWindow = allTabs.filter(t =>
  (t.windowId || 'main') === currentWindowId
)
const ownedByOtherWindows = allTabs.filter(t =>
  (t.windowId || 'main') !== currentWindowId
)
```

#### Phase 2: Visual Distinction (30 minutes)

**Add styling for ghosted tabs:**
```tsx
// Tab rendering
const isOwnedByThisWindow = (terminal.windowId || 'main') === currentWindowId

<div
  className={`tab ${terminal.id === activeTerminalId ? 'active' : ''} ${
    !isOwnedByThisWindow ? 'ghosted' : ''
  }`}
  onClick={() => handleTabClick(terminal.id)}
  title={
    isOwnedByThisWindow
      ? 'Focus terminal'
      : `Move here from ${getWindowName(terminal.windowId)}`
  }
>
  <span className="tab-icon">{terminal.icon}</span>
  <span className="tab-name">{terminal.name}</span>
  {/* ... close button, etc */}
</div>
```

**CSS:**
```css
/* Ghosted tabs (owned by other windows) */
.tab.ghosted {
  opacity: 0.5;
  filter: grayscale(0.5);
}

.tab.ghosted:hover {
  opacity: 0.7;
  filter: grayscale(0.3);
  cursor: pointer;
}

/* Active ghosted tab (rare but possible during transition) */
.tab.ghosted.active {
  opacity: 0.6;
  border-color: rgba(255, 215, 0, 0.4);
}
```

#### Phase 3: Teleport on Click (1 hour)

**Update tab click handler to support teleportation:**
```typescript
// src/SimpleTerminalApp.tsx

const handleTabClick = (terminalId: string) => {
  const terminal = storedTerminals.find(t => t.id === terminalId)
  if (!terminal) return

  const isOwnedByThisWindow = (terminal.windowId || 'main') === currentWindowId

  // If owned by another window, teleport it here
  if (!isOwnedByThisWindow) {
    console.log(`📡 Teleporting ${terminal.name} to current window`)

    // Update terminal ownership
    updateTerminal(terminalId, {
      windowId: currentWindowId
    })

    // Optional: Show toast notification
    // showToast(`Moved ${terminal.name} to this window`)
  }

  // Focus the tab (happens after teleport completes)
  setActiveTerminal(terminalId)
  setFocusedTerminal(terminalId)
}
```

**Handle split collapse when teleporting split panes:**
```typescript
// If teleporting a split pane, collapse split in original window
const parentSplit = storedTerminals.find(t =>
  t.splitLayout?.panes?.some(p => p.terminalId === terminalId)
)

if (parentSplit && parentSplit.windowId !== currentWindowId) {
  // Collapse split in original window (same logic as popout)
  collapseSplitAfterRemoval(terminalId, ...)
}
```

#### Phase 4: Remove Popout Button (30 minutes)

**Since clicking tabs handles teleportation:**
```tsx
// Remove ↗ button from tab bar
// Remove ↗ button from footer (unless in split - then it's "pop to new tab")

// Footer logic:
{terminal.splitLayout && terminal.splitLayout.type !== 'single' && (
  <button onClick={() => handlePopOutPane(terminal.id)} title="Pop out to new tab">
    ↗
  </button>
)}
// Only shows for split panes to promote them to full tabs
```

**Update context menu:**
```typescript
// Remove "Pop Out to New Window" option
// It's redundant - just click tab in other window!
```

### Files to Modify

**Frontend:**
- `src/SimpleTerminalApp.tsx` - Remove window filtering, add teleport handler, remove popout button
- `src/SimpleTerminalApp.css` - Add ghosted tab styling
- `src/hooks/usePopout.ts` - May need to extract teleport logic

**No Backend Changes!**

### Testing Checklist

**Visual Display:**
- [ ] Window 1 shows all tabs (owned + ghosted)
- [ ] Window 2 shows all tabs (owned + ghosted)
- [ ] Owned tabs: Solid, full color
- [ ] Ghosted tabs: Dimmed, grayscale
- [ ] Active tab has gold border (even if ghosted)

**Teleportation:**
- [ ] Click ghosted tab → Teleports to current window
- [ ] Tab becomes solid in current window
- [ ] Tab becomes ghosted in original window
- [ ] WebSocket connection stays alive during teleport
- [ ] Terminal content preserved (no data loss)

**Split Handling:**
- [ ] Teleport split pane → Collapses split in original window
- [ ] Remaining pane promotes to full tab
- [ ] Split container removed correctly

**Edge Cases:**
- [ ] Teleport while terminal is outputting data → No data loss
- [ ] Teleport active terminal → Becomes active in new window
- [ ] Rapid clicks on ghosted tab → No duplicate teleports
- [ ] Close ghosted tab → Removes from correct window

**Backward Compatibility:**
- [ ] Existing window assignments preserved after upgrade
- [ ] localStorage migration smooth
- [ ] No breaking changes to session manager

### Benefits Over Current System

**Before (Window-Scoped):**
- Tab in Window 1 → Click ↗ → Opens new Window 2 with that tab
- Can't see what's in other windows
- Have to remember which tab is where

**After (Global Tab Bar):**
- All windows show all tabs
- Dimmed tabs = in other windows
- Click dimmed tab → Instant teleport
- Perfect spatial awareness across monitors

### What This Doesn't Change

- Session Manager still has detached/orphans (Priority 1)
- Footer reorganization still happens (Priority 2)
- Preview feature still comes later (Priority 3)
- This is purely about **tab visibility and movement**

---

## ✅ PRIORITY 2: Footer Reorganization & Terminal-Specific Detach [COMPLETED]

**Priority**: High (UX improvement + feature enhancement)
**Estimated Time**: 2-3 hours
**Status**: ✅ **COMPLETED** - November 10, 2025

### Goals

1. **Reorganize footer buttons** - Terminal controls (left) vs Customization (right)
2. **Add detach to footer** - Per-terminal detach instead of tab-level (avoids tmux/split confusion)
3. **Handle split collapse** - Reuse popout logic for graceful split handling

### Current Footer Layout (Mixed Controls)
```
Left: [Terminal Info] [Font -] [Font +] [🔄 Refresh] [↗ Pop Out] [✕ Close]
Right: [🎨 Customize]
```

**Problems:**
- Font controls are customization, but on left with terminal controls
- No detach option for individual terminals in splits
- Right-click tab detach is confusing for splits (which terminal?)

### New Footer Layout (Separated by Purpose)

```
Left (Terminal Controls): [Terminal Info] [🔄 Refresh] [⊟ Detach] [↗ Pop Out] [✕ Close]
Right (Customization): [Font -] [Font +] [↻ Reset] [🎨 Customize]
```

**Benefits:**
- ✅ Clear separation: Controls vs Customization
- ✅ Terminal-specific detach (works perfectly with splits)
- ✅ Pop out already handles split collapse (reuse logic!)
- ✅ Avoids mixing tmux splits with app splits

### Implementation Plan

#### Phase 1: Reorganize Footer Buttons (30 minutes)

**Move font controls to right side:**
```tsx
// src/SimpleTerminalApp.tsx - Footer rendering

{/* LEFT: Terminal Controls */}
<div className="footer-left">
  {/* Terminal info (name, session) */}
  <span className="terminal-info">
    {terminal.icon} {terminal.name}
    {terminal.sessionName && (
      <span className="session-name">({terminal.sessionName})</span>
    )}
  </span>

  {/* Control buttons */}
  <button onClick={() => handleRefreshTerminal(terminal.id)} title="Refresh terminal">
    🔄
  </button>

  {!terminal.isDetached && (
    <button
      onClick={() => handleDetachTerminal(terminal.id)}
      title="Detach (keep session running in background)"
    >
      ⊟
    </button>
  )}

  {terminal.splitLayout && terminal.splitLayout.type !== 'single' && (
    <button onClick={() => handlePopOutPane(terminal.id)} title="Pop out to new tab">
      ↗
    </button>
  )}

  <button onClick={() => handleCloseTerminal(terminal.id)} title="Close terminal">
    ✕
  </button>
</div>

{/* RIGHT: Customization */}
<div className="footer-right">
  <button onClick={() => handleFontChange(terminal.id, -1)} title="Decrease font size">
    Font -
  </button>

  <button onClick={() => handleFontChange(terminal.id, 1)} title="Increase font size">
    Font +
  </button>

  <button onClick={() => handleResetToDefaults(terminal.id)} title="Reset to spawn defaults">
    ↻
  </button>

  <button onClick={() => setCustomizeModalOpen(true)} title="Customize">
    🎨
  </button>
</div>
```

**Update CSS for two-column layout:**
```css
/* src/SimpleTerminalApp.css */
.terminal-footer {
  display: flex;
  justify-content: space-between;  /* Left and right sections */
  align-items: center;
  padding: 8px 12px;
  gap: 16px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

#### Phase 2: Implement Terminal-Specific Detach (1-2 hours)

**Add detach handler with split collapse:**
```typescript
// src/SimpleTerminalApp.tsx

const handleDetachTerminal = async (terminalId: string) => {
  const terminal = storedTerminals.find(t => t.id === terminalId)
  if (!terminal) return

  console.log(`⊟ Detaching terminal: ${terminal.name} (${terminal.sessionName})`)

  // 1. Detach from tmux via API
  if (terminal.sessionName) {
    try {
      const response = await fetch(`${API_URL}/api/tmux/detach/${terminal.sessionName}`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error(`Failed to detach: ${response.statusText}`)
      }
    } catch (error) {
      console.error('[handleDetachTerminal] Error detaching from tmux:', error)
      alert('Failed to detach terminal. Check backend logs.')
      return
    }
  }

  // 2. Update terminal state: mark as detached, clear windowId (global)
  updateTerminal(terminalId, {
    isDetached: true,
    windowId: undefined,  // Make global, not window-scoped
    lastActiveTime: Date.now(),
    lastAttachedWindowId: currentWindowId,
    agentId: undefined  // Clear WebSocket agent ID
  })

  // 3. Handle split collapse (REUSE POPOUT LOGIC!)
  const parentSplit = storedTerminals.find(t =>
    t.splitLayout?.type !== 'single' &&
    t.splitLayout?.panes?.some(p => p.terminalId === terminalId)
  )

  if (parentSplit) {
    console.log('[handleDetachTerminal] Terminal is in split, collapsing...')

    // Find remaining pane
    const remainingPane = parentSplit.splitLayout.panes.find(
      p => p.terminalId !== terminalId
    )

    if (remainingPane) {
      // Collapse split - clear layout on container
      updateTerminal(parentSplit.id, {
        splitLayout: { type: 'single', panes: [] }
      })

      // Unhide remaining pane
      updateTerminal(remainingPane.terminalId, {
        isHidden: false
      })

      // Set remaining pane as active
      setActiveTerminal(remainingPane.terminalId)
      setFocusedTerminal(remainingPane.terminalId)

      console.log('[handleDetachTerminal] ✅ Split collapsed, remaining pane promoted')
    } else {
      // No remaining pane - close container
      console.log('[handleDetachTerminal] No remaining pane, closing container')
      removeTerminal(parentSplit.id)
    }
  }

  console.log(`✅ Detached terminal: ${terminal.name}`)
}
```

**Key insight:** This is almost identical to `handlePopOutPane` logic! Could extract shared function:

```typescript
// src/utils/splitUtils.ts (NEW FILE)

export function collapseSplitAfterRemoval(
  terminalId: string,
  terminals: StoredTerminal[],
  updateTerminal: (id: string, updates: Partial<StoredTerminal>) => void,
  removeTerminal: (id: string) => void,
  setActiveTerminal: (id: string) => void,
  setFocusedTerminal: (id: string) => void
) {
  const parentSplit = terminals.find(t =>
    t.splitLayout?.type !== 'single' &&
    t.splitLayout?.panes?.some(p => p.terminalId === terminalId)
  )

  if (!parentSplit) return false // Not in a split

  const remainingPane = parentSplit.splitLayout.panes.find(
    p => p.terminalId !== terminalId
  )

  if (remainingPane) {
    // Collapse split
    updateTerminal(parentSplit.id, {
      splitLayout: { type: 'single', panes: [] }
    })

    updateTerminal(remainingPane.terminalId, {
      isHidden: false
    })

    setActiveTerminal(remainingPane.terminalId)
    setFocusedTerminal(remainingPane.terminalId)
  } else {
    // No remaining pane - close container
    removeTerminal(parentSplit.id)
  }

  return true // Was in split, handled
}
```

#### Phase 3: Update Tab Context Menu (15 minutes)

**Remove detach from context menu for split tabs:**
```typescript
// src/SimpleTerminalApp.tsx - Context menu options

const getContextMenuOptions = (terminal: StoredTerminal) => {
  const options = [
    {
      label: 'Rename Tab',
      icon: '✏️',
      action: () => handleRenameTab(terminal.id)
    },
    // ... other options ...
  ]

  // Only add detach for non-split tabs (single terminals)
  if (!terminal.splitLayout || terminal.splitLayout.type === 'single') {
    options.push({
      label: 'Detach (Keep Running)',
      icon: '⊟',
      action: () => handleDetachTab(terminal.id),
      color: 'text-yellow-400'
    })
  }

  return options
}
```

**Note:** Keep `handleDetachTab` for simple tabs, but it now mostly delegates to `handleDetachTerminal`.

#### Phase 4: Update Detached List Display (Optional - 30 minutes)

If detached panes still show confusing names, improve display:

```typescript
// src/components/SessionsModal.tsx

const getTerminalDisplayInfo = (terminal: StoredTerminal) => {
  // Check if terminal was part of a split when detached
  const wasSplit = terminal.lastAttachedWindowId &&
                   terminal.splitLayout?.panes?.length > 0

  return {
    name: terminal.name,
    subtitle: wasSplit ? '(was in split)' : null,
    sessionName: terminal.sessionName,
    detachedTime: terminal.lastActiveTime
  }
}
```

### Files to Modify

**Frontend:**
- `src/SimpleTerminalApp.tsx` - Footer reorganization, detach handler, context menu
- `src/SimpleTerminalApp.css` - Footer layout (left/right split)
- `src/utils/splitUtils.ts` (NEW) - Shared split collapse logic
- `src/components/SessionsModal.tsx` (optional) - Better display for detached splits

**No Backend Changes Required!** (Already has `/api/tmux/detach/:name`)

### Testing Checklist

**Footer Layout:**
- [ ] Terminal controls on left (Info, Refresh, Detach, Pop Out, Close)
- [ ] Customization on right (Font -, Font +, Reset, Customize)
- [ ] Visual separation between sections
- [ ] Buttons properly aligned

**Detach Functionality:**
- [ ] Detach button appears for active terminals
- [ ] Detach button hidden for already-detached terminals
- [ ] Single terminal: Detach removes from tab bar
- [ ] Split terminal: Detach collapses split, promotes remaining pane
- [ ] Detached terminals appear in sessions modal
- [ ] Can reattach from sessions modal

**Split Collapse:**
- [ ] Left pane detached → right pane becomes full tab
- [ ] Right pane detached → left pane becomes full tab
- [ ] Active terminal switches to remaining pane
- [ ] No orphaned split containers

**Backward Compatibility:**
- [ ] Tab context menu still works for non-split tabs
- [ ] Pop out still works correctly
- [ ] Close terminal still works correctly
- [ ] All existing footer functionality preserved

---

## 🎯 UP NEXT: Unified Session Manager with Previews

**Priority**: High (Innovative session management feature)
**Estimated Time**: 4-6 hours
**Status**: Planning phase

### Vision

Convert DetachedSessionsModal → SessionsModal with tmux capture-pane previews for ALL sessions (active + detached). Makes it easy to see what's running across all windows and copy text from terminals without switching.

### Why This is Better Than Current Implementation

**Current Issues**:
1. Can't see what's in detached sessions without reattaching
2. Can't preview active sessions in other windows
3. Copy/paste requires switching to terminal
4. TUI apps (tmuxplexer) don't support mouse text selection

**Solution**: HTML `<pre>` previews with selectable text!

### Features

#### 1. Always Accessible Modal
- **Header stats become button**: Click "A: X D: Y" → Opens modal (even when D: 0)
- **Spawn menu integration**: Keep "📂 Detached Sessions" option when D > 0

#### 2. Grouped Session List

```tsx
┌─────────────────────────────────────────────────────┐
│ Session Manager                           [Refresh] │
├─────────────────────────────────────────────────────┤
│ 🟢 Active in This Window (2)          [Collapse ▼] │
│   🤖 Claude Code (tt-cc-ll8)                        │
│      ┌──────────────────────────────────┐           │
│      │ > npm run dev                    │ Preview   │
│      │ ✓ built in 1.79s                 │ (Last 20  │
│      │ > awaiting user input            │  lines)   │
│      └──────────────────────────────────┘           │
│      [👁️ Preview] [📋 Copy] [⊟ Detach] [✕ Close]   │
│                                                      │
│ 🟡 Active in Other Windows (1)        [Collapse ▼] │
│   📟 Bash (tt-bash-xyz) - Window 2                  │
│      ┌──────────────────────────────────┐           │
│      │ matt@desktop:~/projects$ ls      │           │
│      │ src/ package.json README.md      │           │
│      └──────────────────────────────────┘           │
│      [👁️ Preview] [📋 Copy] [↗ Move Here] [✕ Close]│
│                                                      │
│ ⏸️  Detached Sessions (2)              [Collapse ▼] │
│   🎨 TFE (tt-tfe-abc) - Detached 5m ago             │
│      [👁️ Preview] [🔄 Reattach] [✕ Kill]           │
└─────────────────────────────────────────────────────┘
```

#### 3. Preview Modal (Full Screen)

```tsx
┌─────────────────────────────────────────────────────┐
│ Preview: Claude Code (tt-cc-ll8)        [📋 Copy] ✕│
├─────────────────────────────────────────────────────┤
│ > npm run dev                                       │
│                                                      │
│ ✓ built in 1.79s                                    │
│                                                      │
│ VITE v5.0.0  ready in 1234 ms                       │
│                                                      │
│ ➜  Local:   http://localhost:5173/                  │
│ ➜  Network: use --host to expose                    │
│                                                      │
│ <pre> element with selectable text!                 │
└─────────────────────────────────────────────────────┘
```

#### 4. Session Actions

**Active in Current Window**:
- 👁️ **Preview** - Full-screen preview modal
- 📋 **Copy** - Copy preview text to clipboard
- ⊟ **Detach** - Move to detached list
- ✕ **Close** - Kill session

**Active in Other Windows**:
- 👁️ **Preview** - See what's happening
- 📋 **Copy** - Copy text without switching windows
- ↗ **Move Here** - Transfer terminal to current window
- ✕ **Close** - Kill session

**Detached**:
- 👁️ **Preview** - See what was running
- 📋 **Copy** - Copy text before killing
- 🔄 **Reattach** - Move back to active
- ✕ **Kill** - Remove session

### Implementation Plan

#### Phase 1: Rename & Restructure (1 hour)

```typescript
// 1. Rename component
DetachedSessionsModal.tsx → SessionsModal.tsx
DetachedSessionsModal.css → SessionsModal.css

// 2. Update interface
interface SessionsModalProps {
  isOpen: boolean
  onClose: () => void
  activeSessions: StoredTerminal[]      // NEW
  activeOtherWindows: StoredTerminal[]  // NEW
  detachedSessions: StoredTerminal[]    // Existing
  currentWindowId: string                // NEW
  onReattach: (terminalIds: string[]) => void
  onDetach: (terminalId: string) => void         // NEW
  onMove: (terminalId: string, targetWindow: string) => void  // NEW
  onKill: (terminalIds: string[]) => void
}

// 3. Add grouping state
const [expandedGroups, setExpandedGroups] = useState({
  activeCurrentWindow: true,
  activeOtherWindows: false,
  detached: true
})
```

#### Phase 2: Add Preview Backend (30 minutes)

```javascript
// backend/routes/api.js
router.get('/api/tmux/preview/:name', asyncHandler(async (req, res) => {
  const sessionName = req.params.name
  const lines = parseInt(req.query.lines || '50', 10)

  try {
    // Capture last N lines from tmux pane
    const content = execSync(
      `tmux capture-pane -t "${sessionName}" -e -p -S -${lines}`,
      { encoding: 'utf8' }
    )

    res.json({
      success: true,
      preview: content,
      lines: content.split('\n').length
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
}))
```

#### Phase 3: Preview Modal Component (1-2 hours)

```tsx
// src/components/SessionsModal.tsx
const [showPreview, setShowPreview] = useState(false)
const [selectedSession, setSelectedSession] = useState<string | null>(null)
const [previewContent, setPreviewContent] = useState<string>('')

const handleShowPreview = async (sessionName: string, terminalName: string) => {
  setSelectedSession(terminalName)
  setShowPreview(true)

  try {
    const response = await fetch(`/api/tmux/preview/${sessionName}?lines=50`)
    const result = await response.json()

    if (result.success) {
      setPreviewContent(result.preview)
    } else {
      setPreviewContent(`Error: ${result.error}`)
    }
  } catch (err) {
    setPreviewContent('Error fetching preview')
  }
}

const handleCopyPreview = () => {
  navigator.clipboard.writeText(previewContent)
  // Show toast: "Copied to clipboard!"
}

// Preview Modal JSX
{showPreview && (
  <div className="preview-modal-overlay" onClick={() => setShowPreview(false)}>
    <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
      <div className="preview-header">
        <span>Preview: {selectedSession}</span>
        <button onClick={handleCopyPreview}>📋 Copy</button>
        <button onClick={() => setShowPreview(false)}>✕</button>
      </div>
      <pre className="preview-text">{previewContent}</pre>
    </div>
  </div>
)}
```

#### Phase 4: Session Grouping UI (1-2 hours)

```tsx
// Group sessions by status
const groupedSessions = useMemo(() => {
  const active = terminals.filter(t => !t.isDetached && !t.isHidden)

  return {
    activeCurrentWindow: active.filter(t =>
      (t.windowId || 'main') === currentWindowId
    ),
    activeOtherWindows: active.filter(t =>
      (t.windowId || 'main') !== currentWindowId
    ),
    detached: terminals.filter(t => t.isDetached)
  }
}, [terminals, currentWindowId])

// Render group
const renderGroup = (
  title: string,
  icon: string,
  sessions: StoredTerminal[],
  groupKey: keyof typeof expandedGroups
) => {
  const isExpanded = expandedGroups[groupKey]

  return (
    <div className="session-group">
      <div
        className="session-group-header"
        onClick={() => toggleGroup(groupKey)}
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>{icon} {title} ({sessions.length})</span>
      </div>
      {isExpanded && (
        <div className="session-group-content">
          {sessions.map(renderSession)}
        </div>
      )}
    </div>
  )
}
```

#### Phase 5: CSS Styling (30 minutes - Reuse Opustrator Styles)

```css
/* Preview Modal */
.preview-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  z-index: 10000;
}

.preview-modal-content {
  background: rgba(15, 15, 25, 0.98);
  border: 2px solid rgba(255, 215, 0, 0.4);
  border-radius: 16px;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
}

.preview-text {
  flex: 1;
  overflow: auto;
  padding: 16px;
  font-family: 'Berkeley Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  user-select: text; /* CRITICAL: Allows text selection */
}

/* Session Groups */
.session-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
}

.session-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
}
```

### Files to Modify

**Frontend:**
- `src/components/DetachedSessionsModal.tsx` → `SessionsModal.tsx` (~400 lines total, +200 new)
- `src/components/DetachedSessionsModal.css` → `SessionsModal.css` (~300 lines total, +100 new)
- `src/SimpleTerminalApp.tsx` - Update import, pass new props
- `src/SimpleTerminalApp.css` - Keep existing header stats styling

**Backend:**
- `backend/routes/api.js` - Add preview endpoint (~20 lines)

### Key Benefits

1. **Selectable Text** - Unlike TUI apps, HTML `<pre>` allows mouse selection!
2. **Cross-Window Visibility** - See what's running in other windows without switching
3. **Easy Copy/Paste** - Copy terminal output without switching contexts
4. **Session Discovery** - Find that detached session you forgot about
5. **Move Between Windows** - Transfer terminals across multi-monitor setup
6. **Quick Preview** - See last 50 lines inline or full-screen modal

### Testing Checklist

- [ ] Group all active sessions by current/other windows
- [ ] Group all detached sessions
- [ ] Collapse/expand groups independently
- [ ] Preview button shows last 50 lines
- [ ] Preview modal full-screen with scrolling
- [ ] Copy button copies to clipboard
- [ ] Text is selectable in preview (critical!)
- [ ] Move Here button transfers terminal to current window
- [ ] Detach button moves active → detached
- [ ] Reattach button moves detached → active
- [ ] All existing features still work (bulk operations, etc.)

---

## 📋 Backlog (Future Enhancements)

### Medium Priority

#### News Ticker Feature
Transform header into scrolling status bar showing real-time terminal events. Click events to jump to terminals. Would show Claude Code statuslines, command completions, etc. **Estimate: 6-8 hours**

#### Mobile Responsiveness
Test and optimize for tablets/phones. Touch-friendly controls, virtual keyboard handling. **Estimate: 6-8 hours**

#### Light Theme Support
Create light color palettes and backgrounds. Add theme toggle. **Estimate: 4-5 hours**

### Low Priority

#### Tab Reordering UI
Currently can only drag to split. Add visual reordering in tab bar. **Note:** Tab order already persists in store. **Estimate: 2-3 hours**

#### Additional Keyboard Shortcuts
Most shortcuts work (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+1-9). Missing: Ctrl+Shift+T to reopen last closed tab. **Estimate: 1-2 hours**

---

## 📚 Documentation

For completed features, bug fixes, and detailed implementation notes, see:
- **[CHANGELOG.md](CHANGELOG.md)** - All completed features organized by version
- **[CLAUDE.md](CLAUDE.md)** - Project overview, architecture, and debugging guide
- **[LESSONS_LEARNED.md](LESSONS_LEARNED.md)** - Bug fixes and architectural decisions

**Last Updated**: November 10, 2025
**Current Version**: v1.2.2
**Repository**: https://github.com/GGPrompts/Tabz
