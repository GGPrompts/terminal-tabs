# Lessons Learned - Tabz

A living document capturing critical bugs, their root causes, and fixes to prevent future regressions.

---

## Table of Contents

- [Split Terminal & Reconnection Issues (Nov 10, 2025)](#split-terminal--reconnection-issues-nov-10-2025)

---

## Split Terminal & Reconnection Issues (Nov 10, 2025)

### Context
After implementing UX improvements in the `polish` branch (context menus, split enhancements, refresh button), terminals stopped reconnecting properly after page refresh, especially the first terminal in splits.

### Root Cause Analysis

The `polish` branch changed the split terminal architecture:
- **Old (main branch):** Split containers were just UI placeholders with no sessions
- **New (polish branch):** First pane **references the container terminal itself** (`terminalId: splitMode.terminalId`)
- **Critical detail:** Container keeps its `agentId` and `sessionName` for the first pane to use

This architectural change broke multiple reconnection assumptions that worked in `main`.

---

### Bug #1: Split Containers Blocked from Reconnection

**Symptom:** First pane in splits never reconnects after refresh - stuck at "connecting"

**Root Cause:**
```typescript
// useWebSocketManager.ts - Reconnection logic
if (terminal.splitLayout && terminal.splitLayout.type !== 'single') {
  console.log('⏭️ Skipping split container')
  return  // ❌ Blocks ALL containers, including ones with sessions!
}
```

The skip logic assumed split containers never have sessions. But in polish branch, **the container IS the first pane** and holds its session.

**The Fix:**
```typescript
// Only skip HIDDEN containers (panes with their own terminals)
// Allow VISIBLE containers (which hold the first pane's session)
if (terminal.splitLayout && terminal.splitLayout.type !== 'single' && terminal.isHidden) {
  console.log('⏭️ Skipping hidden split container')
  return  // ✅ Only blocks containers that are UI-only
}
```

**File:** `src/hooks/useWebSocketManager.ts:302-306`

**Lesson:** When skip logic exists, always verify assumptions. Architecture changes can invalidate blanket skip rules.

---

### Bug #2: Backend Registry Removal During Popout

**Symptom:** After popping out a terminal, reconnection sometimes failed with "terminal not found"

**Root Cause:**
```typescript
// backend/routes/api.js - Detach API
const terminalToRemove = allTerminals.find(t => t.sessionName === name)
if (terminalToRemove) {
  await terminalRegistry.closeTerminal(terminalToRemove.id, false)
  // ❌ Removes terminal from backend registry BEFORE new window reconnects!
}
```

This created a race condition:
1. Window 1 pops out terminal → calls detach API
2. Detach API removes terminal from backend registry
3. Window 2 opens and tries to reconnect → terminal gone from registry → fails

**The Fix:**
```typescript
// Just detach from tmux, don't remove from registry
execSync(`tmux detach-client -s "${name}" 2>/dev/null || true`)
// ✅ Terminal stays in registry, new window can reconnect
```

**File:** `backend/routes/api.js:800-813` (removed 14 lines)

**Lesson:** When handing off state between windows, don't destroy backend resources prematurely. Let reconnection happen first, cleanup later.

---

### Bug #3: Band-Aid Auto-Fix Treating Symptoms

**Symptom:** Split containers got stuck in 'spawning' status

**Root Cause:** This was a **symptom** of Bug #1 - containers couldn't reconnect because they were being skipped.

**The Band-Aid:**
```typescript
// This ran on EVERY tmux-sessions-list message (multiple times per second!)
storedTerminals.forEach(terminal => {
  if (terminal.splitLayout && terminal.splitLayout.type !== 'single' && terminal.status !== 'active') {
    updateTerminal(terminal.id, { status: 'active' })  // ❌ Force it active without fixing root cause
  }
})
```

**The Fix:**
Removed the band-aid entirely. After fixing Bug #1, containers reconnect properly and don't get stuck.

**File:** `src/hooks/useWebSocketManager.ts:291-297` (removed)

**Lesson:** Band-aids that run frequently (every message, every render) are red flags. Fix the root cause instead of masking symptoms.

---

### Bug #4: Popout Activating Wrong Terminal

**Symptom:** After popping out a split, new window showed blank screen or wrong terminal

**Root Cause:**
```typescript
// usePopout.ts - Opening new window
const url = `?window=${newWindowId}&active=${terminalId}`
// ❌ Activates container ID, but container has no session after unpacking!
```

When splits are unpacked during popout, the container becomes a normal tab with `splitLayout: { type: 'single', panes: [] }`. But the URL still points to the container ID, which has no way to render content.

**The Fix:**
```typescript
// Activate first pane instead of container (pane has the session)
let activeTerminalId = terminalId
if (isSplitContainer && terminal.splitLayout.panes.length > 0) {
  activeTerminalId = terminal.splitLayout.panes[0].terminalId
  console.log('Activating first pane (container has no session)')
}
const url = `?window=${newWindowId}&active=${activeTerminalId}`
// ✅ New window shows terminal with actual content
```

**File:** `src/hooks/usePopout.ts:164-169`

**Lesson:** When unpacking/transforming data structures, update all references. Container ID ≠ pane ID after unpacking.

---

### Bug #5: Container SessionName Cleared During Popout

**Symptom:** First terminal in popped-out split never reconnected - stuck at "connecting" forever

**Root Cause:**
```typescript
// usePopout.ts - Unpacking split for popout
updateTerminal(terminalId, {
  splitLayout: { type: 'single', panes: [] },  // Clear split
  sessionName: isSplitContainer ? undefined : terminal.sessionName,
  // ❌ Clears sessionName thinking container doesn't need it
})
```

The comment said: "Clear sessionName to prevent collision with pane terminals during reconnection."

But this was **wrong** for polish branch architecture! The container **IS** the first pane's terminal. Clearing its sessionName destroyed the session it needed.

**Evidence:**
- `tmux ls` showed session `tt-tfe-g11` exists ✓
- Terminal in localStorage had `sessionName: undefined` ✗
- Reconnection logic couldn't find the session

**The Fix:**
```typescript
updateTerminal(terminalId, {
  splitLayout: { type: 'single', panes: [] },
  sessionName: terminal.sessionName,
  // ✅ Keep it! Container IS the first pane, needs its session
})
```

**File:** `src/hooks/usePopout.ts:81-83`

**Lesson:** Comments can be wrong, especially after architectural changes. Verify assumptions don't just trust old comments.

---

### Bug #6: Multi-Window Trash Not Syncing

**Symptom:** Clicking trash in Window 1 killed all sessions globally, but Window 2's UI didn't update - showed ghost terminals with broken connections

**Root Cause:**
The trash button:
1. Killed ALL tmux sessions (global effect)
2. Cleared localStorage (syncs via Zustand persist)
3. Reloaded current window only

Other windows received the localStorage update (empty terminals array) via Zustand persist, but didn't reload to reflect it. Users saw stale UI with dead terminals.

**The Fix:**
```typescript
// Listen for storage events from other windows
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'simple-terminal-storage' && e.newValue) {
      const newState = JSON.parse(e.newValue)
      // If another window cleared all terminals, reload this window too
      if (newState.state?.terminals?.length === 0 && storedTerminals.length > 0) {
        console.log('🗑️ Detected trash from another window, reloading...')
        setTimeout(() => window.location.reload(), 500)
      }
    }
  }
  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [storedTerminals.length])
```

**File:** `src/SimpleTerminalApp.tsx:350-370`

**Lesson:** Global destructive actions (killing all sessions) must coordinate across all windows. localStorage sync ≠ UI update without reload.

---

## Key Takeaways

### 1. Architecture Changes Break Assumptions
When you change fundamental architecture (e.g., "first pane IS the container"), audit all code that makes assumptions about the old architecture:
- Skip logic
- Cleanup logic
- Reference handling
- Comments that explain "why"

### 2. Test Reconnection Thoroughly
After any changes to terminal/session handling, test:
- [ ] Normal terminal refresh
- [ ] Split terminal refresh (both panes)
- [ ] Pop out single terminal
- [ ] Pop out split (both panes)
- [ ] Multi-window coordination

### 3. Band-Aids Are Red Flags
Code that runs frequently to "fix" status should trigger investigation:
- Forcing status to 'active' every message? Why isn't it active naturally?
- Clearing/resetting state repeatedly? What's corrupting it?
- setTimeout workarounds? What's the race condition?

Fix root causes, not symptoms.

### 4. Storage Events for Multi-Window Sync
When using localStorage for cross-window state:
- **Zustand persist** syncs state automatically ✓
- **But doesn't trigger re-renders or reloads** ✗
- Use `storage` event listener for coordination
- Destructive actions (clear all) need explicit reload

### 5. Container vs Pane Semantics Matter
In split architecture:
- **Container:** The tab with `splitLayout` property
- **Pane:** Individual terminals inside the split
- **Polish branch twist:** First pane references container ID

When unpacking splits (popout, close), preserve this relationship or create new terminals.

---

## Debugging Checklist

When investigating reconnection issues:

```bash
# 1. Check tmux sessions exist
tmux ls | grep "^tt-"

# 2. Check localStorage has sessionName
# In browser console:
window.terminalStore.getState().terminals.map(t => ({
  name: t.name,
  sessionName: t.sessionName,
  windowId: t.windowId,
  isHidden: t.isHidden,
  splitLayout: t.splitLayout?.type
}))

# 3. Check backend logs for reconnection
tmux capture-pane -t tabz:logs -p -S -200 | grep "Reconnecting"

# 4. Check frontend logs for skip messages
# Browser console: look for "Skipping split container"

# 5. Verify WebSocket ownership
# Backend should show: "Adding terminal owner" for each connection
tmux capture-pane -t tabz:logs -p -S -100 | grep "owner"
```

---

## Template for Future Entries

When adding new lessons:

```markdown
## [Issue Name] ([Date])

### Context
Brief description of what changed or what you were trying to do.

### Root Cause Analysis
What was the actual problem? Include code snippets showing the bug.

### The Fix
What did you change? Include before/after code.

**File:** Path to file and line numbers

**Lesson:** One-sentence takeaway to prevent future occurrences.
```

---

**Last Updated:** November 10, 2025
