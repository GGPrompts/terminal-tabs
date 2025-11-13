# Continuation Prompt: Split Terminal UX + Auto-Cleanup Complete

## What Was Completed (November 11, 2025)

### Session Summary
This session completed the split terminal implementation with full drag-locking, proper cleanup, and automatic terminal cleanup on process exit.

### Split Terminals Show as Merged Tabs ✅
- Split panes no longer hidden - each shows as a separate tab
- Tabs styled to look merged with orange ↔ separator
- CSS classes: `.split-left`, `.split-middle`, `.split-right`
- Visual: `[💻 TFE] ↔ [🐚 Bash]` (connected appearance)
- Split container tabs now hidden - only pane tabs show in tab bar

### Context Menu for All Actions ✅
- **Detach** - Detaches terminal, keeps tmux session alive, shows grayed 📌 tab
- **Unsplit** - Converts split pane back to regular tab (split tabs only)
- **Pop out to new window** - Moves tab/split to new browser window
- Removed all pane buttons (✕📌↗) from split views - everything through context menu

### Detached Terminal System ✅
- Detached terminals stay in localStorage (not removed like close)
- Show as grayed tabs with 📌 icon in ALL windows
- Click to re-attach from any window/monitor
- Works for both split panes and regular terminals

### Split Pane Locking ✅ (FIXED November 11, 2025)
- **Split panes cannot be dragged individually** - Dragging disabled via `useSortable({ disabled: true })`
- **Split panes cannot be split again** - Blocking logic prevents edge zone operations on any terminal that is part of a split
- **No corruption from nested splits** - Both source AND target checked before allowing merge
- **Visual feedback** - Cursor changes to `default` (non-draggable) for split panes
- **Clear messaging** - Blocked overlay shows 🔒 "Split panes are locked" with "Unsplit" hint

### Visual Focus States ✅ (FIXED November 11, 2025)
- **Active border on both split tabs** - CSS `.split-active` class applies orange border to all siblings
- **Focused tab name turns orange** - CSS `.focused .tab-label` turns focused pane's name orange
- **Fixed emoji display** - Each split pane tab shows its own `terminal.icon`
- **Split container tabs hidden** - Only pane tabs render in tab bar

### Implementation Details

**Files Modified (November 11, 2025):**

**Split Terminal Implementation:**
- `src/SimpleTerminalApp.tsx`:
  - Added `disabled` flag to `useSortable` for split pane tabs (lines 84-100)
  - **CRITICAL FIX**: Fixed tab bar filter to show both panes (lines 1112-1132)
  - **CRITICAL FIX**: Fixed rendering filter to show both panes (lines 1400-1413)
  - Fixed `onActivate` to set container as active for split panes (lines 1142-1151)
  - Enhanced `handleCloseTerminal` to clean up splits properly (lines 693-762)
  - Enhanced `handleContextDetach` to clean up splits before detaching (lines 632-715)
  - Fixed context menu to show "Unsplit" on both tabs (lines 1667-1691)
  - Improved `handleContextUnsplit` to work on either tab (lines 602-622)
  - Updated cursor style for non-draggable tabs (line 203)
  - Added `.locked` class for split panes (line 206)
  - Updated blocked overlay message (lines 241-247)

- `src/hooks/useDragDrop.ts`:
  - Added `isTerminalPartOfSplit()` helper function (lines 48-56)
  - Updated blocking logic to check both source AND target (lines 83-109, 180-209, 224-240)
  - Enhanced error messages for locked split panes (lines 236-239)
  - **CRITICAL FIX**: Removed `isHidden: true` when creating splits (line 274-276)
  - Order panes by visual position - left before right, top before bottom (lines 253-281)

- `src/SimpleTerminalApp.css`:
  - Added `.locked` cursor styles (lines 410-417)
  - Visual focus states already implemented (lines 395-408)

**Auto-Cleanup on Terminal Exit:**
- `src/hooks/useWebSocketManager.ts`:
  - Added import for `useSimpleTerminalStore` (line 3)
  - Enhanced `terminal-closed` handler to clean up splits (lines 212-324)
  - **CRITICAL FIX**: Use fresh state from Zustand store, not closure variable (lines 217, 239, 259, 287)
  - Updated terminal switching filter to use new split logic (lines 288-307)
  - Added debug logging for terminal lookup issues (lines 214-232)

- `backend/modules/terminal-registry.js`:
  - **CRITICAL FIX**: Check if tmux session actually ended vs just detached (lines 135-159)
  - Emit 'closed' event when tmux session ends (not just PTY) (line 151)
  - Only mark as 'disconnected' if session still exists (line 146)

**Key Architecture:**
- `splitTabInfo` map tracks each tab's position (left/middle/right/single)
- Split panes have `disabled: true` in useSortable - cannot be dragged
- Drag blocking checks if either source OR target is part of a split
- Clicking any split tab focuses its corresponding pane (`setFocusedTerminal`)
- Context menu actions use `contextMenu.terminalId` and `focusedTerminalId`
- Detach: calls `/api/tmux/detach`, sends WebSocket close, marks `status: 'detached'`

## All Issues Resolved ✅

### Split Terminal Implementation (Complete)
1. ✅ **Split panes locked together** - Cannot be dragged individually (disabled in useSortable)
2. ✅ **No nested splits** - Cannot split into or from split panes (edge zone blocking)
3. ✅ **No duplicates** - Dragging split panes is completely blocked
4. ✅ **Emoji display correct** - Each pane shows its own icon
5. ✅ **Visual focus states** - Orange border on all split tabs when active, orange name for focused pane
6. ✅ **Both pane tabs visible** - Fixed rendering filter to show both panes (MAJOR BUG FIX)
7. ✅ **Tab order matches layout** - Left before right, top before bottom
8. ✅ **Close cleanup** - Closing a pane properly converts remaining pane to single tab
9. ✅ **Unsplit on both tabs** - Context menu shows "Unsplit" on either tab in a split
10. ✅ **Detach cleanup** - Detaching a split pane removes it from split, no escape sequence corruption

### Auto-Cleanup on Terminal Exit (Complete)
11. ✅ **Backend detection** - Detects when tmux session ends vs just detached
12. ✅ **Frontend cleanup** - Receives terminal-closed WebSocket message and removes tab
13. ✅ **Split cleanup on exit** - If exited terminal is in split, properly cleans up split structure
14. ✅ **Fresh state handling** - Uses Zustand store directly to avoid stale closure state
15. ✅ **Auto-switch terminals** - Automatically switches to next available terminal after exit

## Architecture Notes

**Split container vs panes:**
- Container terminal: Has `splitLayout.type = 'horizontal' | 'vertical'` - hidden from tab bar
- Pane terminals: Referenced in `splitLayout.panes[]` array - shown as individual tabs with merged styling
- Pane terminals DON'T have their own `splitLayout` property
- Use `splitTabInfo` map to determine if a terminal is part of a split
- Use `isTerminalPartOfSplit()` helper to check if terminal is a pane (in useDragDrop hook)

**Focus vs Active:**
- `activeTerminalId` = which tab is selected (container for splits)
- `focusedTerminalId` = within a split, which pane has keyboard focus
- For splits: Both panes get `.split-active` class, only focused pane gets `.focused` class

**Drag Blocking:**
- Split panes have `disabled: true` on useSortable hook → cannot be dragged
- Edge zone (split) operations blocked if source OR target is part of a split
- Center zone (reorder) operations still work for regular tabs
- Clear visual feedback: default cursor + 🔒 overlay when blocked

**Auto-Cleanup on Exit:**
- Backend detects when PTY process exits
- For tmux terminals: checks if session still exists (detached vs ended)
- For non-tmux terminals: immediately emits 'closed' event
- Frontend receives 'terminal-closed' WebSocket message
- Automatically removes tab and cleans up split if needed
- Switches to next available terminal or closes empty window

## Testing Guide

To verify split tabs work correctly:

1. **Create a split**: Drag a regular tab to the edge of another regular tab
   - ✅ Both pane tabs should appear in tab bar with merged styling
   - ✅ Left/right splits: left tab appears first
   - ✅ Top/bottom splits: top tab appears first

2. **Verify locked state**: Try dragging a split pane tab
   - ✅ Should not move (default cursor, no drag)

3. **Verify no nesting**: Try dragging regular tab to edge of split pane
   - ✅ Shows 🔒 "Split panes are locked" overlay

4. **Verify visual states**:
   - ✅ Click either pane → both tabs get orange border
   - ✅ Focus switches between panes → focused tab name turns orange
   - ✅ Each pane tab shows its own emoji (not duplicated)

5. **Verify close cleanup**: Click X on either pane tab
   - ✅ Remaining pane converts back to regular single tab
   - ✅ No orphaned containers

6. **Verify unsplit**: Right-click either tab → "Unsplit"
   - ✅ Both tabs show "Unsplit" option
   - ✅ Converts clicked pane to regular tab

7. **Verify auto-cleanup**: Type `exit` or press Ctrl+D in a terminal
   - ✅ Tab automatically closes
   - ✅ If in a split, remaining pane converts to regular tab
   - ✅ Switches to next available terminal
   - ✅ Works for both tmux and non-tmux terminals

8. **Verify detach from split**: Right-click split pane → "Detach"
   - ✅ Pane detaches cleanly without escape sequences
   - ✅ Remaining pane converts to regular tab
   - ✅ No `1;2c0;276;0c` corruption in terminals
