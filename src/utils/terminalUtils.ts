// Terminal utility functions

// Terminal type to icon mapping
export const getTerminalIcon = (terminalType: string, name?: string): string => {
  // For TUI tool terminals, check the tool name
  if ((terminalType === "tui-tool" || terminalType === "bash") && name) {
    const tuiIconMap: { [key: string]: string } = {
      "file-manager": "📁",
      lazygit: "🔀",
      bottom: "📊",
      calcure: "📅",
      lnav: "📜",
      aichat: "🤖",
      micro: "📝",
      spotify: "🎵",
      httpie: "🌐",
      pyradio: "📻",
    };
    if (tuiIconMap[name]) {
      return tuiIconMap[name];
    }
  }

  const iconMap: { [key: string]: string } = {
    "claude-code": "🤖",
    opencode: "💻",
    codex: "📚",
    gemini: "♊",
    orchestrator: "👑",
    bash: "🐚",
    dashboard: "📊",
    script: "📜",
    "docker-ai": "🐋",
    "tui-tool": "🛠️", // Default icon for TUI tools
  };
  return iconMap[terminalType] || "🖥️";
};

// Generate a unique terminal ID
export const generateTerminalId = (): string => {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate terminal dimensions in columns and rows
export const calculateTerminalDimensions = (width: number, height: number): { cols: number; rows: number } => {
  const cols = Math.floor(width / 8);
  const rows = Math.floor((height - 80) / 17);
  return { cols, rows };
};

// Calculate fullscreen terminal dimensions
export const calculateFullscreenDimensions = (): { cols: number; rows: number } => {
  const cols = Math.floor((window.innerWidth - 40) / 8);
  const rows = Math.floor((window.innerHeight - 100) / 17);
  return { cols, rows };
};

// Calculate maximized terminal layout
export const calculateMaximizedLayout = (sidebarOpen: boolean) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Account for sidebar if open (sidebar is ~250px)
  const sidebarWidth = sidebarOpen ? 360 : 0;
  const horizontalMargin = 10;
  const verticalMargin = 10;

  // Calculate the actual size we want the terminal to be in viewport pixels
  const targetWidth = viewportWidth - sidebarWidth - horizontalMargin * 2;
  const targetHeight = viewportHeight - verticalMargin * 2 - 60; // 60px for header/controls

  // Position at the edge of the sidebar
  const xPosition = sidebarWidth + horizontalMargin;

  return {
    position: { x: xPosition, y: verticalMargin },
    size: { width: targetWidth, height: targetHeight },
    dimensions: calculateTerminalDimensions(targetWidth, targetHeight)
  };
};