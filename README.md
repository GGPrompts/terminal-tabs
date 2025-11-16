# Tabz

**Tab>_** - A simple, lightweight tab-based terminal interface built with React, TypeScript, and xterm.js. Spawn multiple terminals in browser tabs with full terminal emulation powered by a Node.js backend.

## 🌿 Feature Branches

**Multiple experimental branches are in development!** See **[FEATURE_BRANCHES.md](FEATURE_BRANCHES.md)** for complete details.

Quick overview:
- **master** (this branch) - ✅ Production-ready, stable version
- **feat/component-showcase** - 🎨 Advanced UI components (terminals working)
- **feat/tmux-only-simple** - ⚠️ Simplified architecture (terminals NOT working yet)
- **feat/chrome-extension** - 🌐 Chrome extension version (build issues)
- **feat/ai-experiments** - 🤖 AI-powered features (terminals working + AI)
- **tmux-manager** - 🚀 Go backend replacement (Phase 1 complete)

---

## Features

### Core Features
- **Tab-Based Interface** - Multiple terminals in browser tabs, like VS Code's terminal panel
- **15 Terminal Types** - Claude Code, Bash, TFE, LazyGit, and more
- **Full Terminal Emulation** - Powered by xterm.js with WebGL rendering
- **WebSocket Communication** - Real-time terminal I/O
- **Persistent Backend** - Node.js backend with PTY support
- **Lightweight** - Minimal dependencies, fast startup

### Tmux Integration
- **Dual Context Menu System**
  - **Tab Menu** (right-click tab) - Session operations: detach, unsplit, move window, kill session
  - **Pane Menu** (right-click terminal) - Pane operations: split, swap, mark, zoom, respawn, kill pane
- **Tmux Window Switcher** - Navigate between tmux windows via submenu (shows when multiple windows exist)
- **Dynamic Mark/Unmark** - Menu updates based on actual tmux pane state
- **Full Keyboard Shortcuts** - All tmux operations available via `Alt+Key` (no Ctrl+B prefix needed)
  - `Alt+H/V` - Split horizontal/vertical
  - `Alt+U/D` - Swap pane up/down
  - `Alt+M` - Mark pane
  - `Alt+S` - Swap with marked pane
  - `Alt+R` - Respawn pane
  - `Alt+X` - Kill pane
  - `Alt+Z` - Zoom toggle
  - `Alt+Arrow` - Navigate panes
  - See all shortcuts in Hotkeys Help Modal (⌨️ button in header)

## Quick Start

### Install Dependencies

```bash
# Install frontend dependencies
npm install --ignore-scripts

# Install backend dependencies
cd backend && npm install && cd ..
```

### Run the App

```bash
# Terminal 1: Start backend
cd backend && npm start

# Terminal 2: Start frontend
npm run dev
```

Access at http://localhost:5173

## Architecture

- **Frontend**: React + TypeScript + Vite + xterm.js
- **Backend**: Node.js + Express + node-pty + WebSocket
- **State**: Zustand for terminal management
- **Styling**: Plain CSS

## Configuration

Terminal types are configured in `public/spawn-options.json`. Each terminal can specify:

- `label` - Display name
- `command` - Command to execute
- `terminalType` - Type identifier
- `icon` - Emoji icon
- `defaultTheme` - Terminal color theme
- `defaultTransparency` - Opacity level (0-100)
- `defaultSize` - Initial width/height

## Project Structure

```
tabz/
├── src/
│   ├── SimpleTerminalApp.tsx      # Main app component
│   ├── components/
│   │   └── Terminal.tsx           # xterm.js terminal component
│   ├── stores/
│   │   └── simpleTerminalStore.ts # Zustand state
│   └── styles/
│       └── terminal-themes.ts      # Theme definitions
├── backend/
│   ├── server.js                   # Express + WebSocket server
│   ├── modules/
│   │   ├── terminal-registry.js    # Terminal state management
│   │   ├── pty-handler.js          # PTY process handling
│   │   └── unified-spawn.js        # Terminal spawning logic
│   └── routes/
│       └── api.js                  # REST API endpoints
└── public/
    └── spawn-options.json          # Terminal type configurations
```

## Extracted from Opustrator

This project was extracted from the larger [Opustrator](https://github.com/GGPrompts/opustrator) project, keeping only the essential tab-based terminal functionality without the infinite canvas features.

## License

MIT
