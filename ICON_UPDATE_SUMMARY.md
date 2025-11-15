# Icon System Updates - Spawn Menu & Settings Modal

## ✅ Changes Made

### 1. Spawn Menu (Main App)
**Location**: `src/SimpleTerminalApp.tsx`

**Updates**:
- ❌ Emoji icon → ✅ `<AvatarIcon>` with gradient (md size)
- ❌ 📁 emoji → ✅ `<Folder>` Lucide icon for working directory

**Visual Result**:
- Beautiful gradient avatars for each terminal type
- Professional folder icon with path
- Consistent sizing across all spawn options

### 2. Settings Modal
**Location**: `src/components/SettingsModal.tsx`

**Updates**:
- **Spawn Options List**: ❌ Emoji → ✅ `<AvatarIcon>` (sm size)
- **Projects List**: ❌ 📁 → ✅ `<Folder>` Lucide icon (blue)
- **Section Header**: ❌ 📁 → ✅ `<Folder>` inline icon

**Visual Result**:
- Each spawn option shows gradient avatar
- Projects show blue folder icons
- Clean, professional appearance

## 🎨 Icon Usage Summary

### Throughout the App

**Tabs**:
- Terminal icons: `<InlineTerminalIcon size="sm" />`
- Split panes: `<InlineTerminalIcon size="xs" />`
- Detached: `<Pin>` (yellow)

**Spawn Menu**:
- Terminal avatars: `<AvatarIcon size="md" />`
- Working directory: `<Folder>` icon

**Settings Modal**:
- Spawn options: `<AvatarIcon size="sm" />`
- Projects: `<Folder>` icon (blue)
- Section headers: `<Folder>` inline

**Carousel (Grid View)**:
- Empty state: `<Rocket>` (large)
- Card fallback: `<AvatarIcon size="xl" />`
- Card titles: `<AvatarIcon size="xs" />`
- Hover cards: `<AvatarIcon size="sm" />`

**Header Buttons**:
- Grid view: `<LayoutGrid>` / `<FileText>`
- Clear: `<Trash2>`
- Settings: `<Settings>` (rotates on hover)
- Keyboard: `<Keyboard>` (scales on hover)

**Empty States**:
- No terminals: `<TerminalLucideIcon>` (large, muted)

## 📸 What You'll See

### Spawn Menu
1. Click the `+` button to open spawn menu
2. Each option shows a gradient avatar (Claude Code = orange, Bash = gray, etc.)
3. Working directory shows folder icon instead of emoji

### Settings Modal (⚙️)
1. Click Settings button
2. "Spawn Options" tab shows gradient avatars for each option
3. "Global Defaults" tab shows folder icon in section header
4. Projects list shows blue folder icons

## 🔧 Troubleshooting

### Terminal Connection Issues

If terminals won't connect after the port change:

1. **Clear localStorage**:
   - Open browser console (F12)
   - Run: `localStorage.clear()`
   - Refresh page

2. **Or use the Clear button**:
   - Click the Trash icon (🗑️) in header
   - This clears old terminal state

3. **Fresh start**:
   ```bash
   ./stop.sh
   ./start-tmux.sh
   ```
   - Refresh browser: http://localhost:5174

### If Icons Don't Show

The frontend should auto-reload with Vite, but if not:
- Refresh the browser
- Check browser console for errors
- Make sure port 5174 is loading

## ✨ Complete Icon Locations

Every emoji has been replaced with professional icons:

| Location | Old | New |
|----------|-----|-----|
| Tabs | 💻 🤖 🐚 | Colored Lucide icons |
| Spawn menu | 💻 etc | Gradient avatars |
| Settings | 💻 📁 | Avatars + Folder |
| Carousel | 🚀 💻 | Rocket + Avatars |
| Header | 🎴 🗑️ ⚙️ ⌨️ | LayoutGrid, Trash, Settings, Keyboard |
| Empty state | 📟 | Terminal icon (large) |
| Footer | 💻 | Inline icon |
| Detached | 📌 | Pin (yellow) |

---

**Status**: ✅ **COMPLETE**

All icons updated throughout the entire app!
