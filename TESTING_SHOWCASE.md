# Testing the Component Showcase Branch

## 🚀 Quick Start

This worktree uses **different ports** so you can run it alongside your main instance:

- **Frontend**: http://localhost:5174 (instead of 5173)
- **Backend**: http://localhost:8128 (instead of 8127)

### Start the App

```bash
./start-tmux.sh
```

Then open your browser to: **http://localhost:5174**

### Stop the App

```bash
./stop.sh
```

---

## 🎨 What to Test

### 1. Professional Icon System

**Tab Icons**:
- Open the app
- Spawn multiple terminals (Bash, Claude Code, Python, etc.)
- Notice the professional Lucide icons instead of emojis
- Each terminal type has a unique colored icon

**Header Buttons**:
- Grid view button: `LayoutGrid` icon (instead of 🎴)
- Settings button: `Settings` icon (instead of ⚙️) - rotates on hover
- Keyboard shortcuts: `Keyboard` icon (instead of ⌨️) - scales on hover
- Clear sessions: `Trash2` icon (instead of 🗑️) - scales on hover

### 2. Terminal Carousel (Grid View)

**How to access**:
1. Spawn 2+ terminals
2. Click the Grid icon (top right header)

**What to see**:
- Beautiful carousel with auto-play
- Live terminal thumbnails (updates every 5 seconds)
- Hover over cards to see terminal details
- Click any card to switch to that terminal (returns to single view)
- Empty state: Large Rocket icon instead of emoji

**Carousel Features**:
- Auto-play advances every 3 seconds
- Hover pauses auto-play
- Arrow buttons for manual navigation
- Responsive layout (try resizing window)

### 3. Avatar Icons for AI Agents

**Gradient Avatars**:
- Spawn Claude Code terminal
- In Grid View, notice the orange gradient avatar with Bot icon
- Spawn Gemini terminal → Purple gradient with Sparkles icon
- Each AI agent has a distinct gradient background

**Where to find avatars**:
- Grid view carousel cards (large)
- Card titles (tiny)
- Hover card details (small)

### 4. Inline Terminal Icons

**In tabs**:
- Each tab shows a colored icon matching the terminal type
- Bash → Gray Shell icon
- Python → Blue FileCode icon
- LazyGit → Orange GitBranch icon
- Claude Code → Orange Bot icon

**In split panes**:
- Create a split (drag a tab to edge)
- Notice mini icons for each pane in the split tab

**Detached terminals**:
- Detach a terminal (right-click → Detach)
- Notice yellow Pin icon in the tab
- Click "📌 Detached" button to see dropdown with terminal icons

### 5. Empty States

**No terminals**:
- Clear all terminals (trash icon)
- See large muted Terminal icon instead of emoji 📟

**No preview in carousel**:
- Grid view → Terminals without canvas show gradient avatars
- Beautiful fallback with terminal type icon

---

## 🎯 Testing Checklist

### Icons
- [ ] All emojis replaced with professional icons
- [ ] Tab icons are colored and crisp
- [ ] Header buttons use Lucide icons
- [ ] Settings icon rotates on hover
- [ ] Split pane tabs show mini icons
- [ ] Detached icon is yellow Pin
- [ ] Footer shows terminal icon

### Carousel
- [ ] Grid view button works
- [ ] Carousel shows all terminals
- [ ] Auto-play advances every 3 seconds
- [ ] Hover pauses auto-play
- [ ] Arrow buttons work
- [ ] Clicking card switches to terminal and returns to single view
- [ ] Live thumbnails update (watch for 5+ seconds)
- [ ] Hover cards show terminal details with avatars

### Avatars
- [ ] AI agents have gradient backgrounds
- [ ] Claude Code: Orange gradient + Bot icon
- [ ] Gemini: Purple gradient + Sparkles icon
- [ ] OpenCode: Purple gradient + Code icon
- [ ] Avatars appear in carousel cards
- [ ] Avatars appear in hover cards

### Responsive
- [ ] Resize window - carousel adapts
- [ ] Mobile view (narrow window) - carousel stacks
- [ ] All icons scale properly

---

## 🐛 Troubleshooting

### Port already in use

If you see "port 8128 already in use":
```bash
# Kill existing process on that port
lsof -ti:8128 | xargs kill -9

# Or change ports in:
# - backend/.env (PORT=8129)
# - vite.config.ts (port: 5175, target: 8129)
```

### Icons not showing

If icons are missing:
```bash
# Rebuild
npm run build

# Or restart dev server
./stop.sh
./start-tmux.sh
```

### Carousel thumbnails blank

Thumbnails need active terminals with rendered xterm.js instances:
- Make sure terminals are fully loaded (not just spawning)
- Wait 5 seconds for first thumbnail update
- Try typing in the terminal to trigger a render

---

## 📸 Screenshots to Take

For your portfolio/README:

1. **Grid View**: Full carousel with multiple terminals
2. **Avatar Detail**: Close-up of gradient avatar in carousel card
3. **Tab Bar**: Show colorful terminal icons in tabs
4. **Header**: Show professional Lucide icons in header buttons
5. **Hover Card**: Terminal details with avatar
6. **Split Panes**: Split tab showing mini icons

---

## 🎉 What's New

See these files for complete details:
- `CAROUSEL_IMPLEMENTATION.md` - Carousel feature details
- `ICON_SYSTEM_IMPLEMENTATION.md` - Icon system details
- `IMPLEMENTATION_PLAN.md` - Original plan (more components available!)

---

**Happy Testing!** 🚀

If you find any issues, just let me know and I'll fix them.
