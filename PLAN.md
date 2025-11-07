# PLAN.md - Terminal Tabs Roadmap

## 🎯 Vision

Create the **simplest, fastest web-based terminal interface** with browser-style tabs. Focus on reliability, speed, and mobile-friendliness over complex features.

---

## 📅 Release Roadmap

### v1.0 - MVP (✅ CURRENT)
**Status**: Complete
- [x] Tab-based interface
- [x] Terminal spawning (15 types)
- [x] WebSocket I/O
- [x] Theme system
- [x] Basic styling

### v1.1 - Persistence (Next)
**Target**: 1-2 weeks
- [ ] Tab persistence (localStorage)
- [ ] Session recovery on refresh
- [ ] Terminal state preservation
- [ ] Last active tab restoration

### v1.2 - UX Improvements
**Target**: 2-3 weeks
- [ ] Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab)
- [ ] Tab reordering (drag & drop)
- [ ] Tab context menu (close, close others, close right)
- [ ] Settings modal (edit spawn-options.json)
- [ ] Tab icons (show terminal type icon)

### v1.3 - Mobile Support
**Target**: 1 month
- [ ] Responsive CSS for tablets/phones
- [ ] Touch-friendly tab switching
- [ ] Mobile keyboard support
- [ ] Portrait/landscape layouts
- [ ] PWA manifest

### v2.0 - Advanced Features
**Target**: 2-3 months
- [ ] Split panes (horizontal/vertical)
- [ ] Tab groups/folders
- [ ] Search across terminals
- [ ] Command history
- [ ] Copy/paste improvements
- [ ] Export terminal output

---

## 🚀 Priority Tasks

### High Priority (Do First)

#### 1. Tab Persistence (P0)
**Why**: Users lose all terminals on refresh - bad UX
**Tasks**:
- Store terminal IDs in localStorage
- Save active tab index
- Reconnect to existing tmux sessions on refresh
- Show "Reconnecting..." state during recovery

**Files**:
- `src/stores/simpleTerminalStore.ts` - Add persistence
- `src/SimpleTerminalApp.tsx` - Handle reconnection

**Estimate**: 4-6 hours

---

#### 2. Keyboard Shortcuts (P0)
**Why**: Power users expect keyboard navigation
**Shortcuts**:
- `Ctrl+T` - New terminal (show spawn menu)
- `Ctrl+W` - Close active tab
- `Ctrl+Tab` / `Ctrl+Shift+Tab` - Switch tabs
- `Ctrl+1-9` - Jump to tab N
- `Ctrl+Shift+T` - Reopen last closed tab

**Files**:
- `src/SimpleTerminalApp.tsx` - Add keyboard event handlers
- Create `src/hooks/useKeyboardShortcuts.ts`

**Estimate**: 3-4 hours

---

#### 3. Remove Unused Canvas Code (P1)
**Why**: Still loading unnecessary components
**Tasks**:
- Remove unused stores (canvasStore, useUIStore, useAgentsStore)
- Remove unused components (Sidebar, FileTree, all Draggable*)
- Remove unused utils (backgroundUtils, terminalUtils)
- Clean up CSS (remove canvas-specific styles)

**Estimate**: 2-3 hours

---

### Medium Priority (Nice to Have)

#### 4. Settings Modal (P1)
**Features**:
- Edit spawn-options.json in Monaco editor
- Change default theme/transparency
- Configure keyboard shortcuts
- Set default working directory

**Files**:
- Create `src/components/SettingsModal.tsx`
- Add settings button to header

**Estimate**: 4-5 hours

---

#### 5. Tab Context Menu (P2)
**Features**:
- Right-click tab → context menu
- "Close", "Close Others", "Close to Right"
- "Rename Tab"
- "Duplicate Terminal"
- "Copy Terminal ID"

**Estimate**: 2-3 hours

---

#### 6. Mobile Responsive Design (P2)
**Tasks**:
- Media queries for tablets (< 1024px)
- Media queries for phones (< 768px)
- Touch-friendly tab bar
- Collapsible header on mobile
- Virtual keyboard handling

**Files**:
- `src/SimpleTerminalApp.css` - Add responsive styles
- Test on iOS Safari, Android Chrome

**Estimate**: 6-8 hours

---

### Low Priority (Future)

#### 7. Split Panes (P3)
**Features**:
- Horizontal split (top/bottom)
- Vertical split (left/right)
- Nested splits
- Drag to resize splits

**Complexity**: High (may add too much complexity)
**Estimate**: 2-3 days

---

#### 8. Tab Groups (P3)
**Features**:
- Group related terminals
- Collapse/expand groups
- Color-code groups

**Estimate**: 1-2 days

---

#### 9. Pop-Out Windows (P3)
**Features**:
- Pop out tab to new window
- Drag tab out of window
- `window.open()` with WebSocket sharing

**Estimate**: 1 week

---

## 🐛 Bug Fixes Needed

### Critical Bugs
1. **localStorage Clear on Mount** - Remove the `localStorage.clear()` hack from SimpleTerminalApp.tsx (line 68)
2. **Debug Logging** - Remove excessive console.log statements

### Minor Bugs
1. Tab bar overflows with many tabs (need scrolling or compression)
2. Connection status sometimes shows wrong state
3. Spawn menu doesn't close on Escape key

---

## 🎨 UI/UX Improvements

### Quick Wins
1. **Tab Close Animation** - Smooth fade out when closing
2. **Tab Hover Effects** - Show close button on hover only
3. **Loading States** - Better visual feedback during spawn
4. **Empty State** - Improve "No terminals" message with helpful tips
5. **Tab Width** - Dynamic width based on label length

### Design Polish
1. Add terminal type icon to each tab (use emoji from spawn-options)
2. Color-code tabs by terminal type (agent vs utility)
3. Show terminal status (active, idle, error) with colored dot
4. Tooltip on tab hover (show full name, type, status)

---

## 🔧 Technical Debt

### Code Quality
- [ ] Add TypeScript strict mode
- [ ] Remove unused imports
- [ ] Extract magic numbers to constants
- [ ] Add JSDoc comments to public APIs
- [ ] Consistent error handling

### Testing
- [ ] Unit tests for SimpleSpawnService
- [ ] Unit tests for simpleTerminalStore
- [ ] E2E tests for terminal spawning
- [ ] E2E tests for tab switching

### Performance
- [ ] Lazy load Terminal component
- [ ] Virtualize tab bar for 50+ tabs
- [ ] Debounce resize events
- [ ] Profile WebSocket message handling

---

## 📦 Dependencies to Consider

### Useful Additions
- `react-hotkeys-hook` - Better keyboard shortcut handling
- `dnd-kit` - For tab reordering (lightweight drag & drop)
- `zustand-persist` - Built-in localStorage persistence
- `@radix-ui/react-dropdown-menu` - Tab context menu

### Dependencies to Remove
- Many unused components still imported
- Can remove canvas-specific stores

---

## 🌐 Deployment Strategy

### Frontend Deployment (Vercel/Netlify)
```bash
# Build frontend
npm run build

# Deploy to Vercel
vercel --prod

# Or Netlify
netlify deploy --prod
```

### Backend Deployment (DigitalOcean/AWS/Railway)
```bash
# PM2 for process management
pm2 start backend/server.js --name terminal-tabs-backend

# Nginx reverse proxy
# /etc/nginx/sites-available/terminal-tabs
location /ws {
  proxy_pass http://localhost:8127;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

### Environment Variables
```bash
# Backend
PORT=8127
NODE_ENV=production

# Frontend (Vite)
VITE_WS_URL=wss://your-domain.com/ws
```

---

## 🎯 Success Metrics

### v1.1 Goals
- Tab persistence working for 95% of sessions
- < 500ms to restore session on refresh
- Zero data loss on refresh

### v1.2 Goals
- All keyboard shortcuts work correctly
- Tab reordering feels smooth (60fps)
- Settings modal can edit spawn-options without restart

### v1.3 Goals
- Works on iPad (1024x768)
- Works on iPhone (375x667)
- Touch gestures feel native

---

## 💡 Feature Ideas (Backlog)

### Community Requests (if we get users)
- [ ] Terminal search (Ctrl+F within terminal)
- [ ] Export terminal output to file
- [ ] Share terminal session (read-only URL)
- [ ] Terminal recording/playback
- [ ] Custom terminal colors per tab
- [ ] Tab bookmarks (save frequently used terminals)

### Integration Ideas
- [ ] GitHub Copilot in terminal
- [ ] AI command suggestions
- [ ] Claude directly in terminal (deeper integration)
- [ ] File tree sidebar (optional toggle)

---

## 🚫 Anti-Roadmap (Things We Won't Do)

1. **No Canvas Features** - Dragging, zooming, infinite workspace
2. **No Complex Layouts** - Keep it tab-based, not spatial
3. **No Desktop App** - Web-first, not Electron
4. **No Multiplayer** - Single-user experience
5. **No AI Features** - Terminal types handle AI (Claude Code, etc.)

---

## 📝 Next Session Tasks

**Quick Wins (< 1 hour each)**:
1. Remove `localStorage.clear()` hack
2. Add Escape key to close spawn menu
3. Add tab icons from spawn-options
4. Remove debug console.logs
5. Add loading spinner during terminal spawn

**Medium Tasks (1-3 hours each)**:
1. Implement tab persistence
2. Add Ctrl+T keyboard shortcut
3. Create settings modal
4. Add tab context menu
5. Remove unused canvas components

---

**Last Updated**: November 7, 2025
