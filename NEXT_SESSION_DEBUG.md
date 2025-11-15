# Debug Session - Chrome Extension Terminal Display

## Current Status (Nov 15, 2025)

### ✅ What's Working

1. **Backend Running Correctly**
   - Port 8128 listening (confirmed via `lsof`)
   - WebSocket server active
   - Logs show: `[success] [Server] WebSocket client connected`
   - Active WS: 1, Terminals: 0

2. **Extension Built & Loaded**
   - All TypeScript compiles successfully
   - Extension loads in Chrome without errors
   - Popup displays 15 spawn options
   - Side panel UI renders

3. **Code Integration Complete**
   - ✅ Terminal.tsx component created (lightweight xterm.js wrapper)
   - ✅ Background worker routes TERMINAL_INPUT, TERMINAL_OUTPUT, TERMINAL_RESIZE
   - ✅ Message types added to messaging.ts
   - ✅ Side panel imports Terminal component
   - ✅ Spawn options clickable (added `value` prop to CommandItems)

### ❌ What's NOT Working

1. **Side Panel Shows "Disconnected"**
   - Badge displays red "Disconnected" instead of green "Connected"
   - Backend logs show WebSocket IS connected
   - Disconnect between backend state and UI state

2. **Spawn Options Grayed Out (Maybe)**
   - User reports options are grayed out
   - We added `value` props to fix cmdk selectability
   - May still have CSS/interaction issue

3. **No Terminal Display**
   - Clicking "Bash" doesn't spawn visible terminal
   - Terminal component never renders

## 🔍 Root Cause Hypothesis

**WebSocket Connection Timing Issue:**
- Background worker connects to backend ✅
- Backend logs confirm connection ✅
- BUT: Side panel doesn't receive `WS_CONNECTED` message ❌

**Possible causes:**
1. Side panel loads before background worker establishes connection
2. Message broadcasting isn't reaching side panel
3. Side panel message listener not set up correctly
4. Race condition between panel open and WS handshake

## 🐛 Debug Steps for Next Session

### Step 1: Verify Message Flow

**Check background worker console:**
```javascript
// Open chrome://extensions/
// Click "Service worker" under Terminal Tabs
// Look for:
console.log('📤 Sending to clients:', message)
```

**Check side panel console:**
```javascript
// Right-click side panel → Inspect
// Look for:
[Sidepanel] Message received: WS_CONNECTED
```

### Step 2: Test Direct WebSocket State

Add this to `sidepanel.tsx` to bypass message system:

```typescript
useEffect(() => {
  // Direct check - does background worker have WS connection?
  chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }, (response) => {
    console.log('[Sidepanel] Direct WS status:', response)
    setWsConnected(response?.connected || false)
  })
}, [])
```

Then add to `background.ts`:

```typescript
case 'GET_WS_STATUS':
  sendResponse({ connected: ws?.readyState === WebSocket.OPEN })
  break
```

### Step 3: Force Reconnect on Panel Open

The issue might be that side panel opens AFTER background worker connects, so it misses the initial `WS_CONNECTED` broadcast.

**Fix:** Make background worker send current status when panel requests it:

```typescript
// In sidepanel.tsx - request status on mount
useEffect(() => {
  sendMessage({ type: 'REQUEST_WS_STATUS' })
}, [])

// In background.ts - respond with current status
case 'REQUEST_WS_STATUS':
  broadcastToClients({
    type: ws?.readyState === WebSocket.OPEN ? 'WS_CONNECTED' : 'WS_DISCONNECTED'
  })
  break
```

### Step 4: Check Terminal Spawn Flow

If side panel shows "Connected" after above fixes, test spawn:

1. Click "Bash" in popup
2. Check background worker console for `SPAWN_TERMINAL` message
3. Check backend logs for spawn request
4. Check if `terminal-spawned` event is broadcast back
5. Check if side panel receives event and creates terminal

**Expected backend log:**
```
[info] Spawning terminal: bash
[info] Created tmux session: tt-bash-xxxxx
```

**Expected side panel log:**
```
[Sidepanel] Received WS_MESSAGE: terminal-spawned
[Terminal] Initializing xterm for terminal: terminal-xxxxx
```

## 📁 Key Files to Check

### Extension Files
- `extension/background/background.ts` - WebSocket handling, message routing
- `extension/sidepanel/sidepanel.tsx` - Connection status display
- `extension/components/Terminal.tsx` - xterm.js rendering
- `extension/shared/messaging.ts` - Message type definitions

### Backend Files
- `backend/server.js` - WebSocket server (lines 27-60)
- `backend/.env` - PORT=8128 configuration

## 🔧 Quick Verification Commands

```bash
# Check backend is running on correct port
lsof -i :8128 | grep LISTEN

# Watch backend logs in real-time
tail -f /tmp/extension-backend-clean.log

# Check for WebSocket activity
tail -f /tmp/extension-backend-clean.log | grep -E "WebSocket|connected|spawn"

# Verify extension build is current
ls -lt dist-extension/assets/*.js | head -5
```

## 💡 Alternative Approaches

If message broadcasting is fundamentally broken:

### Option A: Use Chrome Storage for State Sync
```typescript
// Background worker updates storage
chrome.storage.local.set({ wsConnected: true })

// Side panel watches storage
chrome.storage.onChanged.addListener((changes) => {
  if (changes.wsConnected) {
    setWsConnected(changes.wsConnected.newValue)
  }
})
```

### Option B: Use Port Connections Instead of Messages
```typescript
// Side panel creates persistent port
const port = chrome.runtime.connect({ name: 'sidepanel' })
port.onMessage.addListener((msg) => {
  if (msg.type === 'WS_CONNECTED') setWsConnected(true)
})

// Background tracks ports and sends updates
connectedPorts.forEach(port => {
  port.postMessage({ type: 'WS_CONNECTED' })
})
```

## 📊 Session Summary

**Time spent:** ~3 hours
**Lines changed:** ~500
**Files modified:** 8
**Progress:** 80% complete (backend works, frontend integration has timing issue)

**Blocker:** Message passing between background worker and side panel not working reliably for WebSocket state updates.

**Next action:** Add direct status polling mechanism (Step 2 above) to bypass message broadcasting issue.

---

## 🚀 Success Criteria

Extension is complete when:
1. ✅ Side panel shows "Connected" badge (green) when backend is running
2. ✅ Clicking "Bash" spawns terminal in side panel
3. ✅ Terminal displays xterm.js with cursor
4. ✅ Typing `ls` shows directory listing
5. ✅ Multiple terminals work (tabs switch correctly)

**We are 1-2 debug iterations away from working terminals!**
