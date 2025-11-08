// Terminal Theme Definitions with enhanced visual effects
export interface TerminalTheme {
  name: string;
  xterm: any; // XTerm theme object
  css: string; // Additional CSS for effects
  glowColor?: string;
  particleColor?: string;
  fontFamily?: string; // Terminal font family
  fontSize?: number; // Terminal font size
  fontWeight?: string; // Terminal font weight
  letterSpacing?: string; // Terminal letter spacing
}

export const terminalThemes: Record<string, TerminalTheme> = {
  default: {
    name: "Default",
    xterm: {
      background: "rgba(10, 10, 15, 0.85)", // Dark neutral blue-grey
      foreground: "#d4d4d4",
      cursor: "#ffffff",
      cursorAccent: "#000000",
      selectionBackground: "rgba(255, 255, 255, 0.2)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#cd3131",
      green: "#0dbc79",
      yellow: "#e5e510",
      blue: "#2472c8",
      magenta: "#bc3fbc",
      cyan: "#11a8cd",
      white: "#e5e5e5",
      brightBlack: "#9ca3af", // Readable gray for metadata/timestamps/diffs
      brightRed: "#f14c4c",
      brightGreen: "#23d18b",
      brightYellow: "#f5f543",
      brightBlue: "#3b8eea",
      brightMagenta: "#d670d6",
      brightCyan: "#29b8db",
      brightWhite: "#ffffff",
    },
    css: ``,
    glowColor: "#2472c8",
  },

  cyberpunk: {
    name: "Cyberpunk Neon",
    xterm: {
      background: "rgba(20, 0, 30, 0.85)", // Dark purple-black
      foreground: "#00ffff",
      cursor: "#ff00ff",
      cursorAccent: "#000000",
      selectionBackground: "rgba(255, 0, 255, 0.3)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#ff0055",
      green: "#00ff88",
      yellow: "#ffee00",
      blue: "#00aaff",
      magenta: "#ff00ff",
      cyan: "#00ffff",
      white: "#ffffff",
      brightBlack: "#ffa640", // Neon orange for high visibility
      brightRed: "#ff5588",
      brightGreen: "#55ffaa",
      brightYellow: "#ffff55",
      brightBlue: "#55ccff",
      brightMagenta: "#ff55ff",
      brightCyan: "#55ffff",
      brightWhite: "#ffffff",
    },
    css: `
      text-shadow: 0 0 3px currentColor, 0 0 8px currentColor;
      animation: neonPulse 2s ease-in-out infinite alternate;
    `,
    glowColor: "#00ffff",
  },

  retro: {
    name: "Retro Amber",
    xterm: {
      background: "rgba(20, 15, 0, 0.85)", // Dark amber-black
      foreground: "#ffb000",
      cursor: "#ffb000",
      cursorAccent: "#000000",
      selectionBackground: "rgba(255, 176, 0, 0.3)",
      selectionForeground: "#000000",
      black: "#000000",
      red: "#ff4444",
      green: "#44ff44",
      yellow: "#ffff44",
      blue: "#4444ff",
      magenta: "#ff44ff",
      cyan: "#44ffff",
      white: "#ffb000",
      brightBlack: "#d4a574", // Light amber/tan for readability
      brightRed: "#ff6666",
      brightGreen: "#66ff66",
      brightYellow: "#ffff66",
      brightBlue: "#6666ff",
      brightMagenta: "#ff66ff",
      brightCyan: "#66ffff",
      brightWhite: "#ffd700",
    },
    css: `
      text-shadow: 0 0 2px #ffb000, 0 0 5px #ff8800;
      filter: contrast(1.2) brightness(1.1);
    `,
    glowColor: "#ffb000",
  },

  matrix: {
    name: "Matrix Rain",
    xterm: {
      background: "rgba(0, 15, 0, 0.85)", // Dark green-black
      foreground: "#00ff00",
      cursor: "#00ff00",
      cursorAccent: "#003300",
      selectionBackground: "rgba(0, 255, 0, 0.2)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#ff0000",
      green: "#00ff00",
      yellow: "#ffff00",
      blue: "#0066ff",
      magenta: "#ff00ff",
      cyan: "#00ffff",
      white: "#ccffcc",
      brightBlack: "#7dff94", // Bright green for visibility (matches theme)
      brightRed: "#ff3333",
      brightGreen: "#33ff33",
      brightYellow: "#ffff33",
      brightBlue: "#3399ff",
      brightMagenta: "#ff33ff",
      brightCyan: "#33ffff",
      brightWhite: "#ffffff",
    },
    css: `
      text-shadow: 0 0 3px #00ff00, 0 0 10px #00ff00;
      animation: matrixGlow 3s ease-in-out infinite;
    `,
    glowColor: "#00ff00",
  },

  holographic: {
    name: "Holographic",
    xterm: {
      background: "rgba(0, 20, 15, 0.85)", // Dark teal-black
      foreground: "#00ff88",
      cursor: "#00ff88",
      cursorAccent: "#000000",
      selectionBackground: "rgba(0, 255, 136, 0.3)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#ff6b9d",
      green: "#00ff88",
      yellow: "#88ff00",
      blue: "#00ff44",
      magenta: "#00ff99",
      cyan: "#00ffaa",
      white: "#e0ffe0",
      brightBlack: "#a4ffdd", // Bright teal for visibility
      brightRed: "#ff9dbc",
      brightGreen: "#44ffaa",
      brightYellow: "#aaff44",
      brightBlue: "#44ff88",
      brightMagenta: "#44ffbb",
      brightCyan: "#44ffcc",
      brightWhite: "#ffffff",
    },
    css: `
      text-shadow: 0 0 8px rgba(0, 255, 136, 0.6), 0 0 2px rgba(0, 255, 136, 1);
      animation: holographicShift 4s ease-in-out infinite;
    `,
    glowColor: "#00ff88",
  },

  vaporwave: {
    name: "Vaporwave",
    xterm: {
      background: "rgba(25, 0, 20, 0.85)", // Dark magenta-black
      foreground: "#ff71ce",
      cursor: "#01cdfe",
      cursorAccent: "#05ffa1",
      selectionBackground: "rgba(255, 113, 206, 0.3)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#ff006e",
      green: "#05ffa1",
      yellow: "#ffff00",
      blue: "#01cdfe",
      magenta: "#ff71ce",
      cyan: "#01cdfe",
      white: "#fffb96",
      brightBlack: "#c9a0dc", // Soft purple for visibility
      brightRed: "#ff4499",
      brightGreen: "#39ffc6",
      brightYellow: "#ffff66",
      brightBlue: "#4de8ff",
      brightMagenta: "#ff99e1",
      brightCyan: "#4de8ff",
      brightWhite: "#ffffff",
    },
    css: `
      text-shadow: 2px 2px 0px #01cdfe, -2px -2px 0px #ff71ce;
      animation: vaporwaveGlitch 5s infinite;
    `,
    glowColor: "#ff71ce",
  },

  aurora: {
    name: "Aurora Borealis",
    xterm: {
      background: "rgba(0, 15, 20, 0.85)", // Dark cyan-black
      foreground: "#e0f7fa",
      cursor: "#80deea",
      cursorAccent: "#004d40",
      selectionBackground: "rgba(128, 222, 234, 0.3)",
      selectionForeground: "#ffffff",
      black: "#000000",
      red: "#ff5252",
      green: "#69f0ae",
      yellow: "#ffd740",
      blue: "#448aff",
      magenta: "#e040fb",
      cyan: "#18ffff",
      white: "#e0f7fa",
      brightBlack: "#9ed8e8", // Light cyan for visibility
      brightRed: "#ff8a80",
      brightGreen: "#b9f6ca",
      brightYellow: "#ffe57f",
      brightBlue: "#82b1ff",
      brightMagenta: "#ea80fc",
      brightCyan: "#84ffff",
      brightWhite: "#ffffff",
    },
    css: `
      background: linear-gradient(135deg, 
        rgba(24, 255, 255, 0.05),
        rgba(224, 64, 251, 0.05),
        rgba(69, 240, 174, 0.05)) !important;
      text-shadow: 0 0 20px rgba(128, 222, 234, 0.5);
      animation: auroraWave 8s ease-in-out infinite;
    `,
    glowColor: "#18ffff",
  },

  synthwave: {
    name: "Synthwave",
    xterm: {
      background: "rgba(25, 10, 20, 0.85)", // Dark purple-pink
      foreground: "#f92aad",
      cursor: "#fdca40",
      cursorAccent: "#242038",
      selectionBackground: "rgba(249, 42, 173, 0.3)",
      selectionForeground: "#ffffff",
      black: "#242038",
      red: "#f92aad",
      green: "#3cff00",
      yellow: "#fdca40",
      blue: "#2892d7",
      magenta: "#a736d9",
      cyan: "#16b2d5",
      white: "#f7f7f7",
      brightBlack: "#bd93f9", // Bright purple for visibility
      brightRed: "#ff5ac4",
      brightGreen: "#6dff3d",
      brightYellow: "#ffdc6d",
      brightBlue: "#4db5ff",
      brightMagenta: "#c15dff",
      brightCyan: "#3dd5ff",
      brightWhite: "#ffffff",
    },
    css: `
      text-shadow: 0 0 5px currentColor, 0 0 15px currentColor;
      background: linear-gradient(180deg,
        rgba(249, 42, 173, 0.05) 0%,
        rgba(40, 146, 215, 0.05) 100%) !important;
      animation: synthwavePulse 3s ease-in-out infinite;
    `,
    glowColor: "#f92aad",
  },
};

// CSS Keyframe animations
export const terminalAnimations = `
  @keyframes neonPulse {
    0% { filter: brightness(1) contrast(1); }
    100% { filter: brightness(1.1) contrast(1.1); }
  }

  @keyframes matrixGlow {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 1; }
  }

  @keyframes holographicShift {
    0% { filter: hue-rotate(0deg); }
    50% { filter: hue-rotate(30deg); }
    100% { filter: hue-rotate(0deg); }
  }

  @keyframes vaporwaveGlitch {
    0%, 100% { transform: translate(0); }
    20% { transform: translate(-1px, 1px); }
    40% { transform: translate(1px, -1px); }
    60% { transform: translate(0px, 1px); }
    80% { transform: translate(1px, 0); }
  }

  @keyframes auroraWave {
    0%, 100% { 
      filter: hue-rotate(0deg) brightness(1); 
      transform: translateY(0);
    }
    25% { filter: hue-rotate(30deg) brightness(1.1); }
    50% { 
      filter: hue-rotate(-30deg) brightness(0.95); 
      transform: translateY(-2px);
    }
    75% { filter: hue-rotate(15deg) brightness(1.05); }
  }

  @keyframes synthwavePulse {
    0%, 100% { 
      filter: saturate(1) brightness(1);
      transform: scale(1);
    }
    50% { 
      filter: saturate(1.2) brightness(1.1);
      transform: scale(1.002);
    }
  }

  /* Scanline effect for retro theme */
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }

  /* Border glow animation */
  @keyframes borderGlow {
    0%, 100% { 
      box-shadow: 0 0 10px var(--glow-color, #00ffff),
                  inset 0 0 10px rgba(255, 255, 255, 0.1);
    }
    50% { 
      box-shadow: 0 0 20px var(--glow-color, #00ffff),
                  inset 0 0 20px rgba(255, 255, 255, 0.2);
    }
  }
`;

// Theme aliases - map intuitive names to actual theme keys
const themeAliases: Record<string, string> = {
  // Intuitive name → actual key
  "amber": "retro",                    // "amber" → "Retro Amber"
  "green": "matrix",                   // "green" → "Matrix Rain"
  "purple": "cyberpunk",               // "purple" → "Cyberpunk Neon"
  "pink": "vaporwave",                 // "pink" → "Vaporwave Dreams"
  "blue": "holographic",               // "blue" → "Holographic"
  "ocean": "deep-ocean",               // "ocean" → "Deep Ocean"
  "dark": "github-dark",               // "dark" → "GitHub Dark"
  "light": "solarized-light",          // "light" → "Solarized Light"
  "solarized": "solarized-dark",       // "solarized" → "Solarized Dark"
};

// Get theme by terminal type or theme key
export function getThemeForTerminalType(
  terminalTypeOrThemeKey: string,
): TerminalTheme {
  // First check if it's an alias
  const resolvedKey = themeAliases[terminalTypeOrThemeKey] || terminalTypeOrThemeKey;

  // Then check if it's a direct theme key
  if (terminalThemes[resolvedKey]) {
    return terminalThemes[resolvedKey];
  }

  // Otherwise use the terminal type mapping
  const themeMap: Record<string, string> = {
    "claude-code": "holographic",
    opencode: "synthwave",
    orchestrator: "aurora",
    gemini: "vaporwave",
    "docker-ai": "cyberpunk",
    bash: "matrix",
    dashboard: "retro",
    script: "cyberpunk",
  };

  return terminalThemes[themeMap[resolvedKey] || "cyberpunk"];
}

// Apply theme-specific CSS class
export function getTerminalClassName(terminalTypeOrThemeKey: string): string {
  const theme = getThemeForTerminalType(terminalTypeOrThemeKey);
  return `terminal-theme-${theme.name.toLowerCase().replace(/\s+/g, "-")}`;
}
