# Tabz

**Tab>_** - A simple, lightweight tab-based terminal interface built with React, TypeScript, and xterm.js. Spawn multiple terminals in browser tabs with full terminal emulation powered by a Node.js backend.

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

### gg-hub Integration (Optional)
- **Project-Based Terminals** - Auto-populate spawn menu with projects from gg-hub manifest
- **Dual Spawn Options** - Manual tools (`spawn-options.json`) + Projects (`gg-hub-spawn-options.json`)
- **Command Execution API** - Execute commands in tmux with split modes
- **Claude Detection** - Real-time Claude Code status detection in ANY terminal type
- **Status Badges** - Live status updates: ✓ Ready, 🔧 Tool, ⏳ Processing

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

Access at http://localhost:3007

## Architecture

- **Frontend**: React + TypeScript + Vite + xterm.js
- **Backend**: Node.js + Express + node-pty + WebSocket
- **State**: Zustand for terminal management
- **Styling**: Plain CSS

## Configuration

### Spawn Options

Tabz supports two spawn option files:

1. **`public/spawn-options.json`** - Manual tools (htop, vim, Claude, etc.)
2. **`public/gg-hub-spawn-options.json`** - Auto-generated from gg-hub projects (optional)

Each spawn option can specify:

- `label` - Display name
- `command` - Command to execute
- `terminalType` - Type identifier (bash, claude-code, tui-tool, etc.)
- `icon` - Emoji icon
- `workingDir` - Working directory for the terminal
- `defaultTheme` - Terminal color theme
- `defaultTransparency` - Opacity level (0-100)
- `defaultFontSize` - Font size
- `defaultFontFamily` - Font family

### Global Defaults

Set in `spawn-options.json`:
```json
{
  "globalDefaults": {
    "workingDirectory": "~",
    "theme": "holographic",
    "background": "carbon",
    "transparency": 90,
    "useTmux": true
  }
}
```

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
