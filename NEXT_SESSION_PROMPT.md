# Next Session: Terminal Customization UI

## 🎯 Goal
Add live terminal customization to the footer bar and enhance the spawn options editor.

---

## Task 1: Footer Customization Panel

### Current State
- Footer shows terminal name, type, and session info
- No way to customize **active** terminals after spawning
- Theme, transparency, font, font size are set at spawn time only

### What to Build
Add a **customization panel in the footer** that appears when a terminal is active:

**Controls needed**:
1. **Theme Selector** - Dropdown of all 14 themes (amber, matrix, etc.)
2. **Transparency Slider** - 0-100% with live preview
3. **Font Family Dropdown** - Common terminal fonts (JetBrains Mono, Fira Code, etc.)
4. **Font Size Slider** - 10-24px range

**Behavior**:
- Changes apply **INSTANTLY** to active terminal (live updates)
- Changes are **NOT saved to spawn-options.json** (ephemeral, session-only)
- Settings stored in `simpleTerminalStore.ts` per terminal ID
- Reset when terminal is closed
- Maybe add a "Reset to Default" button

**UI Location**:
- Right side of footer (where there's empty space)
- Could be an expandable panel (click ⚙️ icon to show/hide)
- Or always visible with compact controls

**Design Notes**:
- Keep it minimal and unobtrusive
- Use same glassmorphic style as rest of app
- Should not interfere with terminal name/info on left side
- Mobile-friendly (maybe collapse to icon on small screens)

---

## Task 2: Add Font Settings to Spawn Options Manager

### Current State
- SettingsModal (⚙️ button) edits spawn-options.json
- Has theme, transparency, workingDir, etc.
- Missing: font family, font size

### What to Add
In `src/components/SettingsModal.tsx`, add these fields:

1. **Font Family** field
   - Text input or dropdown
   - Common options: "JetBrains Mono", "Fira Code", "Source Code Pro", "Menlo", "Consolas"
   - Optional field (defaults to system font if not specified)

2. **Font Size** field
   - Number input (10-24 range)
   - Optional field (defaults to 14px if not specified)

**Schema Update**:
```json
{
  "label": "Claude Code",
  "command": "claude",
  "terminalType": "claude-code",
  "defaultTheme": "amber",
  "defaultTransparency": 100,
  "defaultFontFamily": "JetBrains Mono",  ← NEW
  "defaultFontSize": 14                    ← NEW
}
```

**Implementation Notes**:
- Update `spawn-options.json` schema
- Pass font settings through spawn flow to Terminal component
- xterm.js has `fontSize` and `fontFamily` options - apply these
- Make sure live footer customization (Task 1) overrides spawn defaults

---

## Technical Considerations

### State Management
```typescript
// Add to simpleTerminalStore.ts Terminal interface
interface Terminal {
  // ... existing fields
  fontFamily?: string;
  fontSize?: number;
  // theme and transparency already exist
}
```

### Terminal Component Updates
The `Terminal.tsx` component needs to:
1. Accept font/theme/transparency props
2. Apply them to xterm.js instance
3. Update when props change (for live footer updates)

### Footer Component
Might want to extract footer into `components/TerminalFooter.tsx` for cleaner code:
```typescript
// New component structure
<TerminalFooter
  terminal={activeTerminal}
  onThemeChange={(theme) => updateTerminal(id, { theme })}
  onTransparencyChange={(transparency) => updateTerminal(id, { transparency })}
  onFontChange={(fontFamily, fontSize) => updateTerminal(id, { fontFamily, fontSize })}
/>
```

---

## User Experience Flow

### Scenario 1: Quick Customization (Footer)
1. User spawns Claude Code terminal with amber theme
2. Decides they want matrix theme instead
3. Opens footer customization panel
4. Selects "Matrix Rain" from theme dropdown
5. Terminal immediately switches to green-on-black
6. Adjusts transparency slider to 95%
7. Terminal background becomes slightly more opaque
8. Settings persist until tab is closed

### Scenario 2: Setting Spawn Defaults (Settings Modal)
1. User opens ⚙️ Settings Modal
2. Edits "Claude Code" profile
3. Sets defaultFontFamily: "Fira Code"
4. Sets defaultFontSize: 16
5. Saves to spawn-options.json
6. All future Claude Code spawns use Fira Code 16px
7. Can still override per-terminal using footer controls

---

## Optional Enhancements (Nice to Have)

1. **Preset Themes** - Quick buttons for "Dark Mode", "Light Mode", "Hacker" presets
2. **Save as Profile** - Button in footer to save current settings as new spawn option
3. **Copy Settings** - Copy active terminal's settings to clipboard
4. **Keyboard Shortcuts** - Ctrl+= / Ctrl+- to increase/decrease font size
5. **Color Picker** - For advanced users who want custom colors

---

## Files to Modify

**Required**:
- `src/SimpleTerminalApp.tsx` - Add footer customization UI
- `src/components/SettingsModal.tsx` - Add font fields
- `src/stores/simpleTerminalStore.ts` - Add font fields to Terminal interface
- `src/components/Terminal.tsx` - Apply font/theme changes to xterm.js
- `public/spawn-options.json` - Update with font settings

**Optional** (if extracting footer):
- `src/components/TerminalFooter.tsx` (new)
- `src/components/TerminalFooter.css` (new)

---

## Testing Checklist

- [ ] Spawn terminal with default settings
- [ ] Change theme via footer - updates instantly
- [ ] Change transparency via footer - updates instantly
- [ ] Change font/size via footer - updates instantly
- [ ] Close terminal - settings don't persist
- [ ] Add font settings to spawn-options.json via Settings Modal
- [ ] Spawn terminal - respects new font defaults
- [ ] Override spawn defaults with footer controls
- [ ] Mobile view - footer controls don't break layout
- [ ] Multiple terminals - each has independent settings

---

## Questions to Consider

1. **Footer Layout**: Always visible controls or expandable panel?
2. **Font Selector**: Dropdown with presets or text input for custom fonts?
3. **Reset Button**: Should there be "Reset to Spawn Defaults" in footer?
4. **Visual Feedback**: Show current values (e.g., "14px", "85%") on sliders?
5. **Persistence**: Should there be an option to "Save as New Default" from footer?

---

## Design Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│  [Tabs: Claude Code | TFE | Bash]                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Terminal Content Area                                     │
│  (xterm.js output)                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🤖 Claude Code (claude-code) • local • NONE                │
│                                                             │
│ Customize: [Theme ▼] [⬤──────○ 85%] [Font ▼] [─○── 14px] │
└─────────────────────────────────────────────────────────────┘
         ↑                                                  ↑
    Terminal Info                             Customization Panel
```

---

## Priority

**High Priority**:
- Task 2 (Font settings in spawn options) - Easy, fills gap in current editor

**Medium Priority**:
- Task 1 (Footer customization) - More complex, but very useful UX improvement

**Suggested Approach**:
Start with Task 2 (add font to SettingsModal), then tackle Task 1 (footer panel).
This way you can test font settings work before building the live customization UI.

---

**Last Updated**: November 7, 2025
**Ready for**: Next coding session
