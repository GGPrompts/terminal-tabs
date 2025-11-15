# Tmux-Only Worktree Configuration

**Branch:** `feat/tmux-only-simple`
**Location:** `/home/matt/projects/terminal-tabs-tmux-only`
**Port:** **8131** (to avoid conflicts with other worktrees)

---

## Port Configuration

This worktree uses **port 8131** for backend to avoid conflicts:

```
Main repo:        /terminal-tabs              → Port 8127
Extension:        /terminal-tabs-extension    → Port 8128
AI Experiments:   /terminal-tabs-ai           → Port 8129
Component Demo:   /terminal-tabs-showcase     → Port 8130
Tmux-Only:        /terminal-tabs-tmux-only    → Port 8131 ✅ (this worktree)
Tmux Manager:     /tmux-manager               → Port 8132
```

---

## Files Configured

### Backend
- ✅ `backend/.env` - `PORT=8131`

### Frontend
- ✅ `src/components/MinimalTerminalView.tsx` - WebSocket: `ws://localhost:8131`
- ✅ `src/utils/consoleForwarder.ts` - API: `http://localhost:8131`

---

## Starting the Tmux-Only Version

```bash
# From the worktree directory
cd /home/matt/projects/terminal-tabs-tmux-only

# Start backend + frontend in tmux
./start-tmux.sh

# Or manually:
cd backend && npm start  # Runs on port 8131
cd .. && npm run dev     # Frontend on port 5173
```

---

## Testing

**Backend:** http://localhost:8131
**Frontend:** http://localhost:5173
**WebSocket:** ws://localhost:8131

To verify backend is running:
```bash
lsof -i :8131
```

To check tmux sessions:
```bash
tmux ls | grep tabz
```

---

## What Makes This Version Different

**Tmux-Only Features:**
- Simplified terminal management (tmux sessions only, no complex state)
- Minimal UI (no canvas, no dragging, no zoom)
- Single terminal per session
- Fast spawning (< 100ms)
- Perfect tmux integration

**Removed from Main:**
- Multi-window support (kept simple)
- Split terminals (use tmux native splits)
- Complex terminal state management
- Canvas-based layouts

---

## Backend Logs

```bash
# View backend logs
tmux attach -t tabz:backend

# Capture last 50 lines
tmux capture-pane -t tabz:backend -p -S -50

# View frontend logs
tmux attach -t tabz:frontend
```

---

**Ready to test!** Backend configured for port 8131, frontend updated, all conflicts avoided.
