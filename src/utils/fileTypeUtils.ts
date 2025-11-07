// File type detection utilities

export type FileType = "markdown" | "code" | "text" | "json" | "image";

export interface FileTypeInfo {
  type: FileType;
  language?: string;
}

export interface FileIconInfo {
  icon: string;
  color: string;
}

export interface FileTheme {
  headerFrom: string;
  headerTo: string;
  border: string;
}

// Code language mapping
const codeExtensions: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  java: "java",
  cpp: "cpp",
  c: "c",
  cs: "csharp",
  php: "php",
  go: "go",
  rs: "rust",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  r: "r",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  ps1: "powershell",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  html: "html",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  conf: "ini",
  dockerfile: "dockerfile",
  makefile: "makefile",
  cmake: "cmake",
  vue: "vue",
  lua: "lua",
  perl: "perl",
  elm: "elm",
  clj: "clojure",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  haskell: "haskell",
  hs: "haskell",
  ml: "ocaml",
  fs: "fsharp",
  dart: "dart",
  graphql: "graphql",
  gql: "graphql",
  vim: "vim",
  tex: "latex",
  asm: "asm6502",
  diff: "diff",
  patch: "diff",
};

// Detect file type and language from extension
export const getFileTypeAndLanguage = (filePath: string): FileTypeInfo => {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  // Markdown files
  if (["md", "markdown"].includes(ext)) {
    return { type: "markdown" };
  }

  // JSON files
  if (ext === "json") {
    return { type: "json", language: "json" };
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext)) {
    return { type: "image" };
  }

  // Code files with syntax highlighting
  if (codeExtensions[ext]) {
    return { type: "code", language: codeExtensions[ext] };
  }

  // Default to plain text
  return { type: "text" };
};

// Get file icon and color based on file name
export const getFileIcon = (fileName: string): FileIconInfo => {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const iconMap: Record<string, FileIconInfo> = {
    js: { icon: "📜", color: "#f7df1e" },
    jsx: { icon: "⚛️", color: "#61dafb" },
    ts: { icon: "📘", color: "#3178c6" },
    tsx: { icon: "⚛️", color: "#3178c6" },
    py: { icon: "🐍", color: "#3776ab" },
    md: { icon: "📝", color: "#a78bfa" },
    markdown: { icon: "📝", color: "#a78bfa" },
    json: { icon: "⚙️", color: "#f59e0b" },
    yaml: { icon: "📋", color: "#f97316" },
    yml: { icon: "📋", color: "#f97316" },
    toml: { icon: "🔧", color: "#9c4121" },
    ini: { icon: "🧩", color: "#10b981" },
    conf: { icon: "🧩", color: "#0ea5e9" },
    env: { icon: "🔐", color: "#84cc16" },
    png: { icon: "🖼️", color: "#00add8" },
    jpg: { icon: "📷", color: "#ff9900" },
    jpeg: { icon: "📷", color: "#ff9900" },
    gif: { icon: "🎬", color: "#00ff00" },
    svg: { icon: "🎨", color: "#ffb13b" },
    html: { icon: "🌐", color: "#e34c26" },
    css: { icon: "🎨", color: "#1572b6" },
  };
  return iconMap[ext] || { icon: "📄", color: "#f3f4f6" };
};

// Get theme colors based on file type
export const getFileTheme = (filePath: string, type: FileType): FileTheme => {
  const ext = (filePath.split(".").pop() || "").toLowerCase();
  const base: FileTheme = {
    headerFrom: "rgba(156, 163, 175, 0.18)", // gray-400
    headerTo: "rgba(107, 114, 128, 0.18)", // gray-500
    border: "rgba(156, 163, 175, 0.35)",
  };

  // Per-extension theming for better differentiation - Much darker for documentation
  if (ext === "md" || ext === "markdown") {
    return {
      headerFrom: "rgba(30, 20, 45, 0.3)",  // Much darker purple
      headerTo: "rgba(25, 30, 50, 0.3)",     // Dark blue-purple
      border: "rgba(139, 92, 246, 0.15)",    // Very subtle purple border
    };
  }
  if (ext === "json") {
    return {
      headerFrom: "rgba(35, 25, 15, 0.3)",   // Dark amber
      headerTo: "rgba(30, 20, 10, 0.3)",     // Darker amber
      border: "rgba(251, 191, 36, 0.2)",     // Subtle golden border
    };
  }
  if (ext === "yml" || ext === "yaml") {
    return {
      headerFrom: "rgba(30, 15, 20, 0.3)",   // Dark red-orange
      headerTo: "rgba(35, 20, 15, 0.3)",     // Dark orange
      border: "rgba(249, 115, 22, 0.2)",     // Subtle orange border
    };
  }
  if (ext === "toml" || ext === "ini" || ext === "conf" || ext === "env") {
    return {
      headerFrom: "rgba(16, 185, 129, 0.25)",
      headerTo: "rgba(59, 130, 246, 0.25)",
      border: "rgba(16, 185, 129, 0.55)",
    };
  }
  if (ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx") {
    return {
      headerFrom: "rgba(6, 182, 212, 0.25)",
      headerTo: "rgba(59, 130, 246, 0.25)",
      border: "rgba(59, 130, 246, 0.55)",
    };
  }
  if (ext === "py" || ext === "rs" || ext === "go") {
    return {
      headerFrom: "rgba(59, 130, 246, 0.25)",
      headerTo: "rgba(139, 92, 246, 0.25)",
      border: "rgba(139, 92, 246, 0.55)",
    };
  }
  if (type === "image") {
    return {
      headerFrom: "rgba(236, 72, 153, 0.25)",
      headerTo: "rgba(249, 115, 22, 0.25)",
      border: "rgba(236, 72, 153, 0.55)",
    };
  }
  return base;
};

// Apply opacity to RGBA color string
export const applyOpacityToRgba = (rgbaString: string, opacity: number): string => {
  // Extract rgba values and replace the alpha channel
  const match = rgbaString.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      // Replace the alpha value with our opacity
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
    }
  }
  return rgbaString;
};

export const applyOpacityToGradient = (gradientString: string, opacity: number): string => {
  // Apply opacity to all colors in a gradient
  // Match hex colors and convert to rgba
  let result = gradientString.replace(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g, (match) => {
    const hex = match.substring(1);
    const fullHex = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;
    const r = parseInt(fullHex.substr(0, 2), 16);
    const g = parseInt(fullHex.substr(2, 2), 16);
    const b = parseInt(fullHex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  });

  // Also apply to existing rgba colors
  result = result.replace(/rgba?\(([^)]+)\)/g, (match) => {
    return applyOpacityToRgba(match, opacity);
  });

  return result;
};