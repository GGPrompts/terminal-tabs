# Next Session - Priority Fixes

## 🎯 Quick Wins (45 minutes total)

### 1. Fix BroadcastMiddleware Error (15 min)
**File**: `src/stores/broadcastMiddleware.ts` line 118

**Problem**: Trying to clone functions in Zustand store
**Solution**: Only broadcast serializable data

```typescript
// Find line 118 and replace broadcast logic:
const serializable = {
  terminals: state.terminals,
  activeTerminalId: state.activeTerminalId,
  focusedTerminalId: state.focusedTerminalId,
};
channel.postMessage({ type: 'state-update', state: serializable });
```

---

### 2. Debug Carousel (20 min)
**File**: `src/components/showcase/TerminalCarousel.tsx`

**Add at line 25**:
```typescript
useEffect(() => {
  console.log('[Carousel] Rendering with terminals:', terminals.length);
  console.log('[Carousel] Active ID:', activeTerminalId);
}, [terminals, activeTerminalId]);
```

**Then check browser console** to see if component renders.

---

### 3. Fix Terminal Dimensions (10 min)
**File**: `src/components/Terminal.tsx` line ~260

**Change retry logic**:
```typescript
// Increase interval and max retries
if (retryCount < 20) {  // Was 10
  setTimeout(attemptOpen, 100)  // Was 50ms
}
```

---

## 🧪 Testing Steps

1. Clear localStorage: `localStorage.clear()`
2. Reload: http://localhost:5173
3. Spawn 2 terminals
4. Click Grid icon
5. Check console for carousel logs

---

## 📁 Key Files Summary

**Icon System (Working ✅)**:
- `src/config/terminalIcons.tsx`
- `src/components/ui/avatar-icon.tsx`

**Carousel (Needs Debug 🔧)**:
- `src/components/showcase/TerminalCarousel.tsx`

**Errors to Fix (🐛)**:
- `src/stores/broadcastMiddleware.ts` - Line 118
- `src/components/Terminal.tsx` - Line ~260

---

**Current Ports**: Frontend 5173, Backend 8127
