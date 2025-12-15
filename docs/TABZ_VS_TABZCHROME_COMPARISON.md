# Tabz vs TabzChrome: Reconnect/Resize Logic Comparison

**Date**: December 10, 2025
**Purpose**: Document differences in WebSocket reconnection, terminal refresh, and resize/refit logic between the two projects to identify improvements that can be ported.

---

## Architecture Overview

| Aspect | Tabz (Web App) | TabzChrome (Chrome Extension) |
|--------|----------------|-------------------------------|
| **Frontend** | React SPA with Zustand | Chrome Side Panel with React |
| **WebSocket Location** | Direct in React hooks | Service Worker (background.ts) |
| **Persistence** | Zustand + localStorage | Chrome Storage API |
| **Session Prefix** | `tt-` | `ctt-` |

---

## 1. WebSocket Reconnection

| Feature | Tabz | TabzChrome | Better? |
|---------|------|------------|---------|
| **Backoff Formula** | `baseDelay * Math.pow(2, attempts)` (1s base) | `Math.pow(2, attempts) * 0.5` (0.5s base) | **Tabz** - starts slower, more resilient |
| **Max Delay** | 30 seconds | 30 seconds | Same |
| **Max Attempts** | 10 | 10 | Same |
| **Reconnect Trigger** | `setTimeout()` in hook | Chrome Alarms API | **TabzChrome** - survives service worker idle |
| **Keepalive** | None needed (always-on SPA) | 25s interval ping | **TabzChrome** - required for service worker |
| **State Reset** | Clears agents, marks terminals `spawning` | Broadcasts WS_CONNECTED | **Tabz** - more thorough cleanup |

**Key Difference**: TabzChrome uses Chrome Alarms API because service workers idle after 30s. Tabz can rely on simple `setTimeout()`.

---

## 2. Terminal Refresh on Tab Switch

| Feature | Tabz | TabzChrome | Better? |
|---------|------|------------|---------|
| **Trigger** | `isSelected` prop change | `isActive` prop change | Same pattern |
| **Delay** | 50ms | 100ms | **Tabz** - faster |
| **Actions** | `fit()` → `refresh()` → `focus()` | HTTP POST to backend + `fit()` → `refresh()` | **TabzChrome** - also refreshes tmux |
| **Tmux Refresh** | Not done | `POST /api/tmux/refresh/{session}` | **TabzChrome** - handles tmux redraw |
| **Post-Reconnect** | 1200ms delay then refit | 1200ms delay + `triggerResizeTrick()` | **TabzChrome** - more thorough |

**Key Difference**: TabzChrome sends an HTTP request to force `tmux refresh-client` on tab switch, which Tabz doesn't do. This ensures tmux redraws properly.

---

## 3. Resize/Refit Logic

| Feature | Tabz | TabzChrome | Better? |
|---------|------|------------|---------|
| **Debounce (normal)** | 1000ms | 100ms first, 1000ms subsequent | **TabzChrome** - faster first resize |
| **Debounce (TUI)** | 20ms | N/A (no TUI distinction) | **Tabz** - specialized handling |
| **Resize Lock** | None | `isResizingRef` + write queue | **TabzChrome** - prevents corruption |
| **Write Queue** | None | `writeQueueRef` buffers during resize | **TabzChrome** - prevents isWrapped error |
| **Output Quiet Period** | None | 150ms defer if output recent | **TabzChrome** - prevents tmux corruption |
| **ResizeObserver Debounce** | Not specified | 150ms | TabzChrome has explicit debounce |
| **Resize Trick** | Not found | `-1 col, wait, +1 col` | **TabzChrome** - forces complete redraw |
| **TUI Tool Detection** | Yes (pyradio, lazygit, etc.) | No | **Tabz** - handles TUI apps better |
| **Ctrl+L After Resize** | Yes for TUI tools | No | **Tabz** - ncurses apps work better |

**Key Difference**: TabzChrome has a sophisticated resize lock mechanism that queues writes during resize to prevent the dreaded `isWrapped` buffer corruption error. Tabz doesn't have this, but has better TUI tool handling.

---

## 4. Session Persistence & Recovery

| Feature | Tabz | TabzChrome | Better? |
|---------|------|------------|---------|
| **Storage** | Zustand + localStorage | Chrome Storage API | Platform-appropriate |
| **Recovery Trigger** | `query-tmux-sessions` message | `terminals` message from backend | Similar |
| **Matching Strategy** | 4-tier (sessionName → requestId → agentId → type) | Profile name extraction from ID | **Tabz** - more fallbacks |
| **Recovery Complete Flag** | Not found | `recoveryComplete` boolean | **TabzChrome** - prevents premature cleanup |
| **Window Isolation** | Window ID filtering | `ctt-` prefix + terminalOwners | Both good |
| **RECONNECT Deduplication** | Not found | `reconnectedTerminalsRef` Set | **TabzChrome** - prevents duplicate messages |

**Key Difference**: TabzChrome has a `recoveryComplete` flag that prevents Chrome storage from being wiped before backend recovery finishes.

---

## 5. Error Handling

| Feature | Tabz | TabzChrome | Better? |
|---------|------|------------|---------|
| **Malformed Message Rate Limit** | 10/minute, then terminate | Same | Same |
| **JSON Parse Error** | Terminate connection | Terminate connection | Same |
| **Fit Failures** | Try/catch, log, continue | Try/catch, release lock, flush queue | **TabzChrome** - cleans up state |
| **Dead Connection Cleanup** | Every 5s interval | Every 5s interval | Same |
| **Terminal Output Isolation** | `terminalOwners` Map | `terminalOwners` Map | Same |

---

## What TabzChrome Has That Tabz Doesn't

### 1. Resize Lock Mechanism
**File**: `extension/components/Terminal.tsx:44-124`

```typescript
const isResizingRef = useRef(false)
const writeQueueRef = useRef<string[]>([])

const safeWrite = (data: string) => {
  if (isResizingRef.current) {
    writeQueueRef.current.push(data)  // Queue during resize
  } else {
    xtermRef.current?.write(data)
  }
}

const flushWriteQueue = () => {
  requestAnimationFrame(() => {
    if (!isResizingRef.current) {
      writeQueueRef.current.forEach(data => xtermRef.current?.write(data))
      writeQueueRef.current = []
    }
  })
}
```

**Why it matters**: Prevents the `isWrapped` buffer corruption error that occurs when `xterm.resize()` is called while data is being written.

### 2. Output Quiet Period
**File**: `extension/components/Terminal.tsx:55-60`

```typescript
const OUTPUT_QUIET_PERIOD = 150  // ms to wait after output
const lastOutputTimeRef = useRef(0)

// In fitTerminal():
if (Date.now() - lastOutputTimeRef.current < OUTPUT_QUIET_PERIOD) {
  // Defer resize
}
```

**Why it matters**: Prevents tmux status bar corruption during active output.

### 3. Resize Trick (Force Redraw)
**File**: `extension/components/Terminal.tsx:126-174`

```typescript
const triggerResizeTrick = () => {
  const currentCols = xtermRef.current.cols

  // Step 1: Resize down by 1 column
  xtermRef.current.resize(currentCols - 1, rows)

  // Step 2: Wait and resize back
  setTimeout(() => {
    xtermRef.current.resize(currentCols, rows)
  }, 100)
}
```

**Why it matters**: Forces complete canvas redraw after theme/font changes or manual refresh.

### 4. HTTP Tmux Refresh on Tab Switch
**File**: `extension/components/Terminal.tsx:722-727`

```typescript
if (tmuxSession) {
  fetch(`http://localhost:8129/api/tmux/refresh/${encodeURIComponent(tmuxSession)}`, {
    method: 'POST'
  }).catch(() => {})
}
```

**Why it matters**: Ensures tmux redraws properly when switching tabs.

### 5. VS16 Sanitization
**File**: `extension/components/Terminal.tsx:492`

```typescript
const sanitizedData = message.data.replace(/\uFE0F/g, '')
```

**Why it matters**: Removes emoji variation selector (U+FE0F) that causes tmux to miscalculate character width.

### 6. RECONNECT Deduplication
**File**: `extension/hooks/useTerminalSessions.ts`

```typescript
const reconnectedTerminalsRef = useRef(new Set<string>())

// Only send RECONNECT once per terminal
if (!reconnectedTerminalsRef.current.has(t.id)) {
  reconnectedTerminalsRef.current.add(t.id)
  sendMessage({ type: 'RECONNECT', terminalId: t.id })
}
```

---

## What Tabz Has That TabzChrome Doesn't

### 1. TUI Tool Detection & Handling
**File**: `src/hooks/useTerminalResize.ts:38-76`

```typescript
const isTUITool =
  agent.terminalType === 'tui-tool' ||
  agent.name?.toLowerCase().includes('pyradio') ||
  agent.name?.toLowerCase().includes('lazygit') ||
  agent.name?.toLowerCase().includes('bottom')

// Use faster debounce for TUI tools
const debounceMs = isTUITool ? 20 : 1000
```

**Why it matters**: TUI/ncurses apps need faster resize response.

### 2. Ctrl+L After Resize for TUI Tools
**File**: `src/components/Terminal.tsx`

```typescript
// After resize for TUI tools, send Ctrl+L to refresh
if (isTUITool) {
  setTimeout(() => {
    wsRef.current?.send(JSON.stringify({
      type: 'command',
      terminalId,
      data: '\x0c'  // Ctrl+L
    }))
  }, 100)
}
```

**Why it matters**: ncurses apps get confused when resized and need explicit refresh.

### 3. 4-Tier Session Matching
**File**: `src/hooks/useWebSocketManager.ts:405-460`

```typescript
// Match priority:
// 1. By sessionName (most reliable)
// 2. By requestId (newly spawned)
// 3. By agentId (already connected)
// 4. By spawning status + type (last resort)
```

**Why it matters**: More fallback options for reconnection edge cases.

### 4. Broadcast Middleware for Multi-Window
**File**: `src/stores/simpleTerminalStore.ts`

Uses Zustand broadcast middleware to sync state across browser windows/tabs.

---

## TODO: Improvements for Tabz

### Critical (Prevents Buffer Corruption)

- [ ] **Add resize lock mechanism** - Port from TabzChrome `Terminal.tsx:44-124`
  - Add `isResizingRef` boolean
  - Add `writeQueueRef` array
  - Create `safeWrite()` function
  - Create `flushWriteQueue()` function

- [ ] **Add write queue for output during resize** - Buffer writes while resizing
  - Queue all terminal writes during resize
  - Flush after resize lock releases

- [ ] **Add output quiet period** - Port from TabzChrome
  - Track `lastOutputTimeRef`
  - Defer resize if output < 150ms ago
  - Add max deferral counter to prevent infinite loops

### Recommended

- [ ] **Add resize trick function** - Port `triggerResizeTrick()` for forced redraws
  - Useful for theme changes, font changes, manual refresh

- [ ] **Add HTTP tmux refresh on tab switch** - Ensure tmux redraws properly
  - Add backend endpoint `/api/tmux/refresh/:session`
  - Call on tab activation

- [ ] **Add VS16 sanitization** - Remove emoji variation selector from output
  - `data.replace(/\uFE0F/g, '')`

- [ ] **Add RECONNECT deduplication** - Prevent duplicate reconnect messages
  - Track reconnected terminals in Set
  - Clear on new connection

### Nice to Have

- [ ] **Add recoveryComplete flag** - Prevent premature session cleanup
  - Wait for backend recovery before removing stale sessions

---

## Key File Locations

### TabzChrome
| Component | File | Lines |
|-----------|------|-------|
| Resize lock | `extension/components/Terminal.tsx` | 44-124 |
| Resize trick | `extension/components/Terminal.tsx` | 126-174 |
| Output quiet period | `extension/components/Terminal.tsx` | 55-60, 271-278 |
| Tab switch refresh | `extension/components/Terminal.tsx` | 700-777 |
| WebSocket reconnect | `extension/background/background.ts` | 641-658 |
| Session reconciliation | `extension/hooks/useTerminalSessions.ts` | 103-212 |

### Tabz
| Component | File | Lines |
|-----------|------|-------|
| TUI tool detection | `src/hooks/useTerminalResize.ts` | 38-76 |
| Window resize | `src/hooks/useTerminalResize.ts` | 73-76 |
| ResizeObserver | `src/hooks/useTerminalResize.ts` | 82-120 |
| Tab switch refresh | `src/components/Terminal.tsx` | 652-668 |
| WebSocket reconnect | `src/hooks/useWebSocketManager.ts` | 514-526 |
| Session matching | `src/hooks/useWebSocketManager.ts` | 405-460 |

---

## Summary

TabzChrome evolved to solve **terminal buffer corruption bugs**. The key innovations are:

1. **Resize Lock + Write Queue** - The isWrapped error fix
2. **Output Quiet Period** - Prevents resize during active output
3. **Resize Trick** - Forces complete redraw when needed

Tabz is better at **TUI tool handling** (faster resize, Ctrl+L refresh) but is more vulnerable to buffer corruption during resize operations.

**Priority**: Port the resize lock mechanism to Tabz to prevent isWrapped errors.
