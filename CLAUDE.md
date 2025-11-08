# CLAUDE.md - Terminal Tabs

## 🎯 Project Overview

Terminal Tabs is a **lightweight, tab-based terminal interface** for the web. Built with React, TypeScript, and xterm.js, it provides a simple alternative to complex canvas-based terminal managers.

**Version**: 1.0.0
**Status**: MVP Complete
**Architecture**: Tab-based UI with WebSocket terminal backend
**Extracted from**: [Opustrator](https://github.com/GGPrompts/opustrator) v3.14.2

---

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
```
src/
├── SimpleTerminalApp.tsx       # Main app with tab bar
├── components/
│   └── Terminal.tsx            # xterm.js terminal component
├── stores/
│   ├── simpleTerminalStore.ts  # Zustand store (terminals array)
│   └── useSettingsStore.ts     # Global settings
├── services/
│   └── SimpleSpawnService.ts   # Minimal spawning service
├── styles/
│   └── terminal-themes.ts      # 14 terminal themes
└── types.ts                    # Shared TypeScript types
```

### Backend (Node.js + Express + PTY)
```
backend/
├── server.js                   # Express + WebSocket server
├── modules/
│   ├── terminal-registry.js    # Terminal state management
│   ├── pty-handler.js          # PTY process spawning
│   └── unified-spawn.js        # Terminal spawning logic
└── routes/
    └── api.js                  # REST API endpoints
```

### Communication
- **WebSocket**: Real-time terminal I/O
- **REST API**: Terminal management, file operations

---

## 🎨 Core Principles

1. **Simplicity Over Features** - Minimal, focused functionality
2. **Tab-Based Only** - No canvas, no dragging, no zoom complexity
3. **Fast & Lightweight** - ~74 npm packages (vs 200+ in Opustrator)
4. **Mobile-Friendly** - Works on tablets/phones (future goal)
5. **Easy to Deploy** - Frontend (Vercel/Netlify) + Backend (any VPS)

---

## 📐 Development Rules

### ALWAYS:
1. **Keep It Simple** - If it adds complexity, think twice
2. **Test Terminal Types** - Verify Claude Code, Bash, TFE work
3. **Mobile-First CSS** - Use responsive design patterns
4. **Document Changes** - Update README.md and this file
5. **No Canvas Code** - This is the tab-based version, no dragging/zoom

### NEVER:
1. **Don't Add Canvas Features** - Dragging, resizing, zoom, pan = NO
2. **Don't Import from Opustrator Canvas Code** - Keep it independent
3. **Don't Over-Engineer** - Simple solutions win
4. **Don't Break WebSocket Protocol** - Backend compatibility is critical

---

## 🚀 Key Features (MVP Complete)

✅ **Tab-Based Interface** - Browser-style tabs for terminals
✅ **15 Terminal Types** - Claude Code, Bash, TFE, LazyGit, etc.
✅ **Full Terminal Emulation** - xterm.js with WebGL rendering
✅ **WebSocket Communication** - Real-time I/O
✅ **Theme System** - 14 themes with aliases (amber, matrix, etc.)
✅ **Spawn Menu** - Right-click spawn with 15 options
✅ **Connection Status** - WebSocket connection indicator

---

## 📋 Current State

### What Works
- Spawning terminals (Claude Code, Bash, TFE tested)
- Tab switching
- Terminal I/O (keyboard input, output display)
- WebSocket auto-reconnect
- Basic styling (glassmorphic panels)
- Spawn menu with 15 terminal types
- **Tab persistence** - Terminals persist through refresh with tmux sessions
- **Per-tab customization** - Font size, theme, transparency persist per tab
- **Conditional scrollbar** - Hidden with tmux (default), visible without

### What Needs Work
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)
- Tab reordering (drag tabs)
- Mobile responsiveness improvements
- Split panes (future)

---

## 🔧 Configuration

### spawn-options.json
Located at `public/spawn-options.json` - defines available terminal types:

```json
{
  "spawnOptions": [
    {
      "label": "Claude Code",
      "command": "claude",
      "terminalType": "claude-code",
      "icon": "🤖",
      "description": "Claude Code (interactive mode)",
      "defaultSize": { "width": 1200, "height": 800 },
      "defaultTheme": "amber",
      "defaultTransparency": 100
    }
  ]
}
```

### Theme Aliases
Use intuitive aliases in spawn-options:
- `amber` → Retro Amber (orange monochrome)
- `green` → Matrix Rain (green on black)
- `purple` → Cyberpunk Neon
- `pink` → Vaporwave Dreams
- `blue` → Holographic
- `ocean` → Deep Ocean
- `dark` → GitHub Dark

---

## 🐛 Known Issues

1. **No Keyboard Shortcuts** - Missing Ctrl+T, Ctrl+W, etc.
2. **Mobile Untested** - May need responsive CSS work
3. **Single Window** - Can't pop out tabs (future: window.open())

## ✅ Recently Fixed (Nov 8, 2025)

### Terminal Persistence Implementation
**The Critical Fix:** xterm.js requires non-zero container dimensions to initialize properly.

**Problem:** Using `display: none` to hide inactive tabs prevented xterm.js from initializing on those terminals. After refresh, only the currently active tab would render - all others showed emoji icons but blank terminal areas.

**Solution (from Opustrator):**
```tsx
// OLD (broken):
style={{ display: terminal.id === activeTerminalId ? 'block' : 'none' }}

// NEW (working):
style={{
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  visibility: terminal.id === activeTerminalId ? 'visible' : 'hidden',
  zIndex: terminal.id === activeTerminalId ? 1 : 0,
}}
```

**Why this works:**
- All terminals render with full dimensions (stacked via absolute positioning)
- xterm.js can initialize properly on all terminals
- `visibility: hidden` hides inactive terminals without removing dimensions
- `isSelected` prop triggers Terminal.tsx refresh when tab becomes active (lines 870-886)

**Additional fixes:**
- Conditional scrollbar based on `useTmux` setting (tmux: hidden, non-tmux: visible with 10k scrollback)
- Footer customizations now properly persist per-tab through localStorage
- Spawn options modal shows default font size (16px) when editing options

**Files Modified:**
- `src/SimpleTerminalApp.tsx` (lines 949-981) - Absolute positioning + visibility
- `src/components/Terminal.tsx` (lines 78, 183) - Conditional scrollback
- `src/components/Terminal.css` (lines 151-186) - Conditional scrollbar styling
- `src/components/SettingsModal.tsx` (lines 111-123) - Default font size display

## ✅ Recently Fixed (Nov 7, 2025)

### Critical Terminal Spawning Bugs
1. **Commands Not Executing** ✅ - Bash terminals now properly execute commands from spawn-options.json
2. **Working Directory Validation** ✅ - Tilde paths (`~/projects`) now expand correctly
3. **Duplicate Terminal Bug** ✅ - Fixed race condition using `useRef` for synchronous spawn tracking
4. **Silent Failures** ✅ - Added error logging for failed validations
5. **Settings UI** ✅ - Added SettingsModal (⚙️ button) to edit spawn-options.json

See PLAN.md for detailed technical documentation of these fixes.

---

## 📊 Project Metrics

| Metric | Value |
|--------|-------|
| Dependencies | 74 packages |
| Lines of Code | ~44,000 |
| Frontend Size | ~200KB gzipped |
| Backend Port | 8127 |
| Terminal Types | 15 |
| Themes | 14 |

---

## 🎯 Design Goals

### Primary Goals
1. **Easy to Use** - Spawn terminal, start typing
2. **Fast** - Instant spawning, no lag
3. **Reliable** - WebSocket auto-reconnect, error recovery
4. **Beautiful** - Modern glassmorphic UI, smooth animations

### Non-Goals
1. **Canvas Features** - No dragging, resizing, zoom
2. **Infinite Workspace** - Tabs only, not spatial
3. **Complex Layouts** - Keep it simple
4. **Desktop PWA** - Web-first, not Electron

---

## 🔗 Links

- **GitHub**: https://github.com/GGPrompts/terminal-tabs
- **Parent Project**: https://github.com/GGPrompts/opustrator
- **xterm.js Docs**: https://xtermjs.org/

---

## 📝 Notes for AI Assistants

- This project was extracted from Opustrator to create a simpler tab-based version
- The backend is shared with Opustrator (same WebSocket protocol)
- Focus on simplicity - no canvas features should be added
- Test spawning terminals after changes (Bash, TFE, Claude Code)
- Keep dependencies minimal - avoid adding new npm packages

---

**Last Updated**: November 8, 2025
