# tmux-only-simple Branch

**Git Worktree Location**: `~/projects/terminal-tabs-tmux-only`
**Branch**: `feat/tmux-only-simple`
**Status**: 🚧 IN PROGRESS - **Terminal NOT working yet**

## What This Is

A radical architectural simplification that turns Tabz from a "tab manager" into a "tmux session browser". Removes Zustand, simplifies state management, focuses on tmux attach/detach workflow.

## Current Status

- ✅ **UI Components Built**: Session list, session cards, control panel
- ❌ **Terminal NOT Working**: xterm.js not integrated into MinimalTerminalView
- ❌ **No WebSocket**: Can't connect to backend yet
- ⚠️ **UI Only**: Can browse sessions but not interact with terminals

## What's Missing

1. Integrate xterm.js into MinimalTerminalView component
2. Add WebSocket connection to backend
3. Handle terminal I/O (input/output)
4. Add terminal resize/refit logic
5. Test with actual tmux sessions

## Key Files

- `src/SimpleTmuxApp.tsx` - Main app (list/grid view modes)
- `src/components/TmuxSessionList.tsx` - Session browser
- `src/components/MinimalTerminalView.tsx` - Terminal stub (**NOT WORKING**)
- `src/components/TmuxControlPanel.tsx` - Session management

## How to Work on This

```bash
cd ~/projects/terminal-tabs-tmux-only

# Install dependencies
npm install

# Start dev server (won't show terminals yet)
npm run dev
```

## Main Documentation

See [FEATURE_BRANCHES.md](../terminal-tabs/FEATURE_BRANCHES.md) in the main repo for complete overview of all branches.
