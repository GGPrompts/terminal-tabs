# PLAN.md - Terminal Tabs Roadmap

## 🚨 CURRENT STATUS

**Date**: November 10, 2025
**Version**: v1.2.2 (polish branch)
**Branch**: `polish`

### What's Working 🎉
- ✅ Terminal persistence & reconnection
- ✅ Multi-window support with popout
- ✅ Split terminals (horizontal/vertical)
- ✅ Detached sessions management
- ✅ Tmux health monitoring (15-second check)
- ✅ Per-tab customization
- ✅ Tab context menu (right-click)
- ✅ Code quality improvements (-1,596 lines!)

**For completed features, see [CHANGELOG.md](CHANGELOG.md)**

---

## 🎯 NEXT UP: Footer Reorganization & Terminal-Specific Detach

**Priority**: High (UX improvement + feature enhancement)
**Estimated Time**: 2-3 hours
**Status**: Planning phase

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
