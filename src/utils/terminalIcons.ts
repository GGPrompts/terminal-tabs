// Get the icon for a terminal type or tool
export const getTerminalIcon = (terminalType: string, name?: string): string => {
  // TUI tool icons - check name first for specific tools
  const tuiIcons: Record<string, string> = {
    'file-manager': '📁',
    'mc': '📁',
    'lazygit': '🔀',
    'bottom': '📊',
    'calcure': '📅',
    'lnav': '📜',
    'aichat': '🤖',
    'micro': '📝',
    'spotify': '🎵',
    'httpie': '🌐',
    'htop': '📊',
    'pyradio': '📻',
  };

  // Check for TUI tool by name
  if (name) {
    const nameLower = name.toLowerCase();
    for (const [tool, icon] of Object.entries(tuiIcons)) {
      if (nameLower.includes(tool)) {
        return icon;
      }
    }
  }

  // Terminal type icons
  const typeIcons: Record<string, string> = {
    'claude-code': '🤖',
    'opencode': '🔮',
    'codex': '⚡',
    'gemini': '♊',
    'orchestrator': '🎭',
    'docker-ai': '🐳',
    'bash': '💻',
    'dashboard': '📊',
    'script': '📜',
    'tui-tool': '🖥️',
  };

  return typeIcons[terminalType] || '📟';
};