import React, { useState, useEffect, useRef } from "react";
import { FileTree, FileTreeHandle } from "./FileTree";
import { DirectorySelector } from "./DirectorySelector";
import {
  Star,
  Filter,
  Search,
  FileText,
  Code,
  Image,
  Archive,
  X,
  Plus,
  Folder,
  FileJson,
  FileCode,
} from "lucide-react";
import { FileCreationModal } from "./FileCreationModal";
import { useSettingsStore } from "../stores/useSettingsStore";
import UnifiedSpawnService from "../services/UnifiedSpawnService";

// Background themes removed - using DraggableFileViewer themes instead
/*
const VIEWER_BACKGROUNDS = {
  dark: {
    name: 'Dark',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    color: '#e0e0e0',
    codeBackground: 'rgba(0, 0, 0, 0.3)',
    headerBg: 'rgba(0, 0, 0, 0.4)',
  },
  midnight: {
    name: 'Midnight',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    color: '#e2e8f0',
    codeBackground: 'rgba(15, 23, 42, 0.5)',
    headerBg: 'rgba(15, 23, 42, 0.6)',
  },
  ocean: {
    name: 'Ocean',
    background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0284c7 100%)',
    color: '#e0f2fe',
    codeBackground: 'rgba(7, 89, 133, 0.3)',
    headerBg: 'rgba(12, 74, 110, 0.5)',
  },
  forest: {
    name: 'Forest',
    background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)',
    color: '#dcfce7',
    codeBackground: 'rgba(21, 128, 61, 0.2)',
    headerBg: 'rgba(20, 83, 45, 0.5)',
  },
  sunset: {
    name: 'Sunset',
    background: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #ea580c 100%)',
    color: '#fed7aa',
    codeBackground: 'rgba(154, 52, 18, 0.2)',
    headerBg: 'rgba(124, 45, 18, 0.5)',
  },
  purple: {
    name: 'Purple',
    background: 'linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #7c3aed 100%)',
    color: '#f3e8ff',
    codeBackground: 'rgba(107, 33, 168, 0.2)',
    headerBg: 'rgba(88, 28, 135, 0.5)',
  },
  carbon: {
    name: 'Carbon',
    background: 'linear-gradient(135deg, #000000 0%, #111111 50%, #1a1a1a 100%)',
    color: '#ffffff',
    codeBackground: 'rgba(0, 0, 0, 0.5)',
    headerBg: 'rgba(0, 0, 0, 0.7)',
  },
  paper: {
    name: 'Paper',
    background: 'linear-gradient(135deg, #faf5f0 0%, #f5ebe0 50%, #ede4d3 100%)',
    color: '#3d2817',
    codeBackground: 'rgba(255, 255, 255, 0.5)',
    headerBg: 'rgba(250, 245, 240, 0.8)',
  },
};
*/

interface EnhancedFileViewerProps {
  onFileSelect: (path: string, content?: string, isImage?: boolean) => void;
  wsRef?: React.MutableRefObject<WebSocket | null>; // For spawning terminals
}

// Export favorites management for use in FileTree
export const useFavorites = () => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = useSettingsStore.getState().fileFavorites;
    if (saved && saved.length > 0) {
      setFavorites(new Set(saved));
    }
  }, []);

  const saveFavorites = (newFavorites: Set<string>) => {
    useSettingsStore.getState().updateSettings({
      fileFavorites: Array.from(newFavorites),
    });
    setFavorites(newFavorites);
  };

  const toggleFavorite = (path: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(path)) {
      newFavorites.delete(path);
    } else {
      newFavorites.add(path);
    }
    saveFavorites(newFavorites);
  };

  return { favorites, toggleFavorite, saveFavorites };
};

interface FileFilter {
  name: string;
  extensions?: string[];
  dirPrefixes?: string[];
  icon: React.ReactNode;
  active: boolean;
}

const EnhancedFileViewerComponent: React.FC<EnhancedFileViewerProps> = ({
  onFileSelect,
  wsRef,
}) => {
  const { favorites, toggleFavorite } = useFavorites();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [lastSpawnedSession, setLastSpawnedSession] = useState<string | null>(null);
  const fileTreeRef = useRef<FileTreeHandle>(null);

  // Get file icon based on extension (reused from FileTree logic)
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const codeExts = [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "cpp",
      "c",
      "h",
      "cs",
      "go",
      "rs",
      "php",
      "rb",
      "swift",
      "kt",
    ];
    const docExts = ["md", "txt", "pdf", "doc", "docx"];
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "webp"];
    const archiveExts = ["zip", "tar", "gz", "rar", "7z"];
    const jsonExts = ["json", "yaml", "yml", "toml"];

    if (codeExts.includes(ext || ""))
      return <FileCode size={14} className="file-icon code" />;
    if (docExts.includes(ext || ""))
      return <FileText size={14} className="file-icon doc" />;
    if (imageExts.includes(ext || ""))
      return <Image size={14} className="file-icon image" />;
    if (archiveExts.includes(ext || ""))
      return <Archive size={14} className="file-icon archive" />;
    if (jsonExts.includes(ext || ""))
      return <FileJson size={14} className="file-icon json" />;
    return <FileText size={14} className="file-icon" />;
  };

  // Listen for spawned terminals and pan to them
  useEffect(() => {
    if (!wsRef?.current || !lastSpawnedSession) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'terminal-spawned' && message.data) {
          // Check if this is our spawned terminal
          if (message.data.sessionId === lastSpawnedSession ||
              message.data.sessionName === lastSpawnedSession) {
            console.log('[EnhancedFileViewer] Our terminal spawned:', message.data.id);

            // Pan to the new terminal with zoom reset
            if (typeof (window as any).panToNewTerminal === 'function') {
              (window as any).panToNewTerminal(message.data.id);
            }

            // Clear the tracked session
            setLastSpawnedSession(null);
          }
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef, lastSpawnedSession]);

  // Fullscreen viewer states removed - using DraggableFileViewer instead
  /*
  const [fullscreen, setFullscreen] = useState<{
    path: string;
    content?: string;
    dataUri?: string;
    kind: "text" | "markdown" | "code" | "json" | "image";
    language?: string;
    loading: boolean;
    error?: string;
  } | null>(null);
  const [fsEdit, setFsEdit] = useState(false);
  const [fsShowRaw, setFsShowRaw] = useState(false);
  const [fsContent, setFsContent] = useState("");
  const [fsFontSize, setFsFontSize] = useState(14);
  const [fsBackground, setFsBackground] = useState(() => {
    return localStorage.getItem('fs-viewer-background') || 'dark';
  });
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const backgroundButtonRef = useRef<HTMLButtonElement>(null);
  */
  const [showFileCreationModal, setShowFileCreationModal] = useState(false);
  const [showDirSelector, setShowDirSelector] = useState(false);

  // Use working directory from settings store instead of local state
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const workingDirectory = useSettingsStore((s) => s.workingDirectory);
  const fileTreeMaxDepth = useSettingsStore((s) => s.fileTreeMaxDepth);


  // Fullscreen viewer effects removed - using DraggableFileViewer instead
  /*
  useEffect(() => {
    if (fullscreen?.kind === "markdown") {
      setFsContent(fullscreen.content || "");
      setFsEdit(false);
      setFsShowRaw(false);
    }
  }, [fullscreen]);

  // Notify parent when fullscreen opens/closes
  useEffect(() => {
    if (fullscreen) {
      onFileViewOpen?.();
    } else {
      onFileViewClose?.();
    }
  }, [fullscreen, onFileViewOpen, onFileViewClose]);

  // ESC key to close fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(null);
      }
    };
    if (fullscreen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [fullscreen]);
  */

  const filters: FileFilter[] = [
    {
      name: "Documents",
      extensions: ["md", "txt", "doc", "pdf", "rtf"],
      icon: <FileText size={14} />,
      active: false,
    },
    {
      name: "Code",
      extensions: [
        "js",
        "jsx",
        "ts",
        "tsx",
        "py",
        "java",
        "cpp",
        "c",
        "rs",
        "go",
        "html",
        "css",
        "scss",
      ],
      icon: <Code size={14} />,
      active: false,
    },
    {
      name: "Images",
      extensions: ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"],
      icon: <Image size={14} />,
      active: false,
    },
    {
      name: "Archives",
      extensions: ["zip", "tar", "gz", "rar", "7z"],
      icon: <Archive size={14} />,
      active: false,
    },
  ];

  const toggleFilter = (filterName: string) => {
    setActiveFilters((prev) => {
      if (prev.includes(filterName)) {
        return prev.filter((f) => f !== filterName);
      }
      return [...prev, filterName];
    });
  };

  // Create file filter function that works for both files and folders
  const fileFilter = (filePath: string, isDirectory?: boolean): boolean => {
    // If showing favorites only
    if (showFavoritesOnly) {
      // Check if this path is favorited
      if (favorites.has(filePath)) return true;

      // Check if this path is inside a favorited folder - if so, show everything inside
      for (const favPath of favorites) {
        if (filePath.startsWith(favPath + "/")) {
          return true; // This file/folder is inside a favorited folder, show it
        }
      }

      // For directories, also check if any child is favorited (allows navigation to favorited items)
      if (isDirectory) {
        // Check if any favorite starts with this directory path
        for (const favPath of favorites) {
          if (favPath.startsWith(filePath + "/")) {
            return true;
          }
        }
      }

      return false;
    }

    // If not showing favorites only and it's a directory, always show it
    if (isDirectory) return true;

    // If no filters active, show all files
    if (activeFilters.length === 0) return true;

    // Check if file matches any active filter
    const fileName = filePath.split("/").pop() || filePath;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    for (const filterName of activeFilters) {
      const filter = filters.find((f) => f.name === filterName);
      if (!filter) continue;
      // Directory-based filters: must match prefix and extension (if provided)
      if (filter.dirPrefixes && filter.dirPrefixes.length > 0) {
        const matchesDir = filter.dirPrefixes.some((prefix) =>
          filePath.includes(prefix),
        );
        const matchesExt =
          !filter.extensions || filter.extensions.includes(ext);
        if (matchesDir && matchesExt) return true;
      } else if (filter.extensions && filter.extensions.includes(ext)) {
        return true;
      }
    }

    return false;
  };

  const handleFileSelect = async (path: string, isDir: boolean) => {
    if (isDir) return;

    // Spawn cards on canvas for all files (left-click behavior)
    // This centers the viewport and sets zoom to 100%
    const ext = path.split(".").pop()?.toLowerCase();

    try {
      const isImageFile = [
        "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"
      ].includes(ext || "");

      if (isImageFile) {
        // Fetch image and send to canvas
        const response = await fetch(
          `/api/files/image?${new URLSearchParams({ path })}`,
        );
        if (response.ok) {
          const data = await response.json();
          onFileSelect(path, data.dataUri, true); // isImage = true
        }
      } else {
        // Fetch file content and send to canvas
        const response = await fetch(
          `/api/files/content?${new URLSearchParams({ path })}`,
        );
        if (response.ok) {
          const data = await response.json();
          onFileSelect(path, data.content, false); // Pass content to create card
        }
      }
    } catch (error) {
      console.error("Failed to fetch file:", error);
    }
  };

  // Handle terminal spawn from context menu
  const handleSpawn = async (
    command: string,
    workingDir: string,
    terminalType: string,
    defaultSize?: { width: number, height: number },
    defaultTheme?: string,
    defaultTransparency?: number
  ) => {
    console.log('[EnhancedFileViewer] handleSpawn called with defaultSize:', defaultSize, 'defaultTheme:', defaultTheme, 'defaultTransparency:', defaultTransparency);

    // Generate unique tmux session name with short random suffix
    // This ensures each spawn gets its own tmux session
    const baseName = `${terminalType}-${workingDir.split('/').pop() || 'root'}`;
    const randomSuffix = Math.random().toString(36).substring(2, 6); // Short 4-char ID
    const tmuxSession = `${baseName}-${randomSuffix}`;

    // Build spawn config based on terminal type
    const spawnConfig: any = {
      terminalType,
      name: tmuxSession,
      sessionName: tmuxSession,
      useTmux: true,
      workingDir,
      size: defaultSize, // Use size from spawn option if provided, UnifiedSpawnService will fall back to global settings
      theme: defaultTheme, // Use theme from spawn option if provided, UnifiedSpawnService will fall back to global settings
      transparency: defaultTransparency, // Use transparency from spawn option if provided
    };

    console.log('[EnhancedFileViewer] spawnConfig:', spawnConfig);

    // TUI tools require 'toolName' field instead of 'command'
    if (terminalType === 'tui-tool') {
      spawnConfig.toolName = command;
    } else {
      spawnConfig.commands = [command];
    }

    console.log('[EnhancedFileViewer] Final spawn config:', spawnConfig);

    // Track this spawn so we can pan to it when it appears
    setLastSpawnedSession(tmuxSession);

    // Use UnifiedSpawnService instead of direct WebSocket to ensure proper position calculation
    try {
      const terminalName = await UnifiedSpawnService.spawn({
        config: spawnConfig,
        workingDir,
        allowDuplicate: true, // Allow multiple terminals in same directory
      });

      if (terminalName) {
        console.log('[EnhancedFileViewer] Terminal spawned successfully:', terminalName);
      } else {
        console.warn('[EnhancedFileViewer] Terminal spawn returned null');
      }
    } catch (error) {
      console.error('[EnhancedFileViewer] Failed to spawn terminal:', error);
      alert('Error: Failed to spawn terminal. Please try again.');
    }
  };

  return (
    <>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Working Directory Section */}
        <div
          style={{
            padding: "10px 12px",
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)",
            borderBottom: "2px solid rgba(59, 130, 246, 0.3)",
          }}
        >
          <div style={{ marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#93c5fd" }}>
              📁 Working Directory
            </span>
            <span style={{ fontSize: "10px", color: "#94a3b8", marginLeft: "8px" }}>
              File tree scope
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                flex: 1,
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                background: "rgba(0, 0, 0, 0.2)",
                padding: "5px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              }}
              title={workingDirectory}
            >
              {workingDirectory?.replace(/^\/home\/matt/, '~') || '~/workspace'}
            </div>
            <button
              onClick={() => setShowDirSelector(true)}
              style={{
                padding: "5px 10px",
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                borderRadius: "4px",
                color: "#93c5fd",
                fontWeight: 500,
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.3)";
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
              }}
              title="Change working directory"
            >
              📂 Change
            </button>
          </div>
        </div>

        {/* Header with filters */}
        <div
          style={{
            padding: "12px",
            borderBottom: "1px solid rgba(255, 200, 87, 0.2)",
            background: "rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* New File button */}
          <div style={{ marginBottom: "12px" }}>
            <button
              onClick={() => setShowFileCreationModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                background: "linear-gradient(135deg, #4a9eff 0%, #3d7dd4 100%)",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title="Create new file"
            >
              <Plus size={14} />
              New File
            </button>
          </div>

          {/* Favorites toggle */}
          <div
            style={{
              marginBottom: "8px",
            }}
          >
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                background: showFavoritesOnly
                  ? "rgba(251, 191, 36, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${showFavoritesOnly ? "rgba(251, 191, 36, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
                borderRadius: "6px",
                color: showFavoritesOnly ? "#fbbf24" : "#ffffff",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <Star size={14} fill={showFavoritesOnly ? "#fbbf24" : "none"} />
              Favorites ({favorites.size})
            </button>
          </div>

          {/* Filter buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {filters.map((filter) => (
              <button
                key={filter.name}
                onClick={() => toggleFilter(filter.name)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  background: activeFilters.includes(filter.name)
                    ? "rgba(96, 165, 250, 0.2)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${
                    activeFilters.includes(filter.name)
                      ? "rgba(96, 165, 250, 0.5)"
                      : "rgba(255, 255, 255, 0.1)"
                  }`,
                  borderRadius: "4px",
                  color: activeFilters.includes(filter.name)
                    ? "#60a5fa"
                    : "#a0a0a0",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {filter.icon}
                {filter.name}
              </button>
            ))}
          </div>
        </div>

        {/* Favorites list */}
        {showFavoritesOnly && favorites.size > 0 && (
          <div
            style={{
              padding: "8px",
              borderBottom: "1px solid rgba(255, 200, 87, 0.1)",
              background: "rgba(251, 191, 36, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#fbbf24",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              ⭐ Favorites
            </div>
            {Array.from(favorites).map((path) => {
              const fileName = path.split("/").pop() || path;
              // Check if this is a directory (no file extension)
              const hasExtension = fileName.includes('.');
              const isDirectory = !hasExtension;

              return (
                <div
                  key={path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: "4px",
                    marginBottom: "4px",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.03)")
                  }
                  onClick={() => {
                    if (isDirectory) {
                      // Expand to folder in tree
                      fileTreeRef.current?.expandToPath(path);
                    } else {
                      // Open file viewer
                      handleFileSelect(path, false);
                    }
                  }}
                  title={isDirectory ? `📂 Click to navigate to ${fileName}` : `📄 Click to open ${fileName}`}
                >
                  {/* Icon based on type */}
                  <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {isDirectory ? (
                      <Folder size={14} style={{ color: "#60a5fa" }} />
                    ) : (
                      getFileIcon(fileName)
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#ffffff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                    title={path}
                  >
                    {fileName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(path);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fbbf24",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* File tree */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <FileTree
            ref={fileTreeRef}
            basePath={workingDirectory || "/home/matt/workspace"}
            onFileSelect={handleFileSelect}
            fileFilter={fileFilter}
            favorites={favorites}
            onToggleFavorite={(path) => toggleFavorite(path)}
            maxDepth={fileTreeMaxDepth}
            onContextMenu={async (path, isDirectory, event, basePath) => {
              event.preventDefault();

              // Remove any existing menus
              const existing = document.getElementById("op-file-context-menu");
              if (existing && existing.parentElement)
                existing.parentElement.removeChild(existing);
              const existingSubmenu = document.getElementById("op-spawn-submenu");
              if (existingSubmenu && existingSubmenu.parentElement)
                existingSubmenu.parentElement.removeChild(existingSubmenu);

              // Load spawn options for directories
              let spawnOptions: any[] = [];
              if (isDirectory) {
                try {
                  // Cache-bust to ensure latest spawn-options.json is loaded
                  const response = await fetch(`/spawn-options.json?t=${Date.now()}`);
                  if (response.ok) {
                    const data = await response.json();
                    spawnOptions = data.spawnOptions || [];
                  }
                } catch (err) {
                  console.error('[EnhancedFileViewer] Failed to load spawn options:', err);
                }
              }

              // Create custom context menu
              const menu = document.createElement("div");
              menu.id = "op-file-context-menu";
              menu.style.cssText = `
              position: fixed;
              left: ${event.clientX}px;
              top: ${event.clientY}px;
              background: rgba(30, 30, 40, 0.98);
              border: 1px solid rgba(255, 200, 87, 0.3);
              border-radius: 6px;
              padding: 4px 0;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
              z-index: 100001;
              min-width: 180px;
            `;

              const isFavorite = favorites.has(path);
              const makeItem = (labelHtml: string, onClick: () => void) => {
                const item = document.createElement("div");
                item.style.cssText = `
                padding: 8px 16px;
                color: #ffffff;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background 0.2s;
              `;
                item.innerHTML = labelHtml;
                item.onmouseover = () => {
                  item.style.background = "rgba(255, 200, 87, 0.2)";
                };
                item.onmouseout = () => {
                  item.style.background = "transparent";
                };
                item.onclick = () => {
                  onClick();
                  removeAll();
                };
                return item;
              };

              const copyPathItem = makeItem(
                '<span style="opacity: 0.8;">📋</span> Copy Path',
                () => {
                  try {
                    navigator.clipboard.writeText(path);
                  } catch {}
                },
              );

              // Relative path (when within the current base path)
              let relativeItem: HTMLDivElement | null = null;
              if (basePath && path.startsWith(basePath)) {
                const base = basePath.endsWith("/") ? basePath : basePath + "/";
                const rel = path.startsWith(base)
                  ? path.slice(base.length)
                  : path;
                relativeItem = makeItem(
                  '<span style="opacity: 0.8;">📁</span> Copy Relative Path',
                  () => {
                    try {
                      navigator.clipboard.writeText(rel);
                    } catch {}
                  },
                );
              }

              // @filename token (Claude/Codex style)
              let atFilenameItem: HTMLDivElement | null = null;
              if (!isDirectory) {
                const baseName = path.split("/").pop() || "";
                atFilenameItem = makeItem(
                  '<span style="opacity: 0.8;">@</span> Copy @filename',
                  () => {
                    try {
                      navigator.clipboard.writeText(`@${baseName}`);
                    } catch {}
                  },
                );
              }

              // View File functionality removed - using DraggableFileViewer instead
              const viewFullscreenItem = null;
              /* !isDirectory
                ? makeItem(
                    '<span style="color:#a7f3d0;">👁️</span> View File',
                    async () => {
                      // Determine type from extension
                      const ext = (path.split(".").pop() || "").toLowerCase();
                      const imageExts = [
                        "png",
                        "jpg",
                        "jpeg",
                        "gif",
                        "svg",
                        "webp",
                        "ico",
                        "bmp",
                      ];
                      const mdExts = ["md", "markdown"];
                      const codeExts = [
                        "js",
                        "jsx",
                        "ts",
                        "tsx",
                        "py",
                        "java",
                        "cpp",
                        "c",
                        "rs",
                        "go",
                        "html",
                        "css",
                        "scss",
                        "json",
                      ];
                      if (imageExts.includes(ext)) {
                        setFullscreen({ path, kind: "image", loading: true });
                        try {
                          const res = await fetch(
                            `/api/files/image?path=${encodeURIComponent(path)}`,
                          );
                          const data = await res.json();
                          setFullscreen({
                            path,
                            kind: "image",
                            dataUri: data.dataUri,
                            loading: false,
                          });
                        } catch (e: any) {
                          setFullscreen({
                            path,
                            kind: "image",
                            loading: false,
                            error: e?.message || "Failed to load image",
                          });
                        }
                      } else if (mdExts.includes(ext)) {
                        setFullscreen({
                          path,
                          kind: "markdown",
                          loading: true,
                        });
                        try {
                          const res = await fetch(
                            `/api/files/content?path=${encodeURIComponent(path)}`,
                          );
                          const data = await res.json();
                          setFullscreen({
                            path,
                            kind: "markdown",
                            content: data.content || "",
                            loading: false,
                          });
                        } catch (e: any) {
                          setFullscreen({
                            path,
                            kind: "markdown",
                            loading: false,
                            error: e?.message || "Failed to load file",
                          });
                        }
                      } else if (codeExts.includes(ext)) {
                        const isJson = ext === "json";
                        setFullscreen({
                          path,
                          kind: isJson ? "json" : "code",
                          language: isJson ? "json" : ext,
                          loading: true,
                        });
                        try {
                          const res = await fetch(
                            `/api/files/content?path=${encodeURIComponent(path)}`,
                          );
                          const data = await res.json();
                          setFullscreen({
                            path,
                            kind: isJson ? "json" : "code",
                            language: isJson ? "json" : ext,
                            content: data.content || "",
                            loading: false,
                          });
                        } catch (e: any) {
                          setFullscreen({
                            path,
                            kind: isJson ? "json" : "code",
                            language: isJson ? "json" : ext,
                            loading: false,
                            error: e?.message || "Failed to load file",
                          });
                        }
                      } else {
                        // treat as text
                        setFullscreen({ path, kind: "text", loading: true });
                        try {
                          const res = await fetch(
                            `/api/files/content?path=${encodeURIComponent(path)}`,
                          );
                          const data = await res.json();
                          setFullscreen({
                            path,
                            kind: "text",
                            content: data.content || "",
                            loading: false,
                          });
                        } catch (e: any) {
                          setFullscreen({
                            path,
                            kind: "text",
                            loading: false,
                            error: e?.message || "Failed to load file",
                          });
                        }
                      }
                    },
                  )
                : null; */

              const addToCanvasItem = !isDirectory
                ? makeItem(
                    '<span style="color:#60a5fa;">◰</span> Add to Canvas',
                    async () => {
                      // Fetch content and trigger onFileSelect to create a canvas card
                      try {
                        const ext = (path.split(".").pop() || "").toLowerCase();
                        const isImageFile = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext);

                        if (isImageFile) {
                          const res = await fetch(`/api/files/image?path=${encodeURIComponent(path)}`);
                          const data = await res.json();
                          onFileSelect(path, data.dataUri, true);
                        } else {
                          const res = await fetch(`/api/files/content?path=${encodeURIComponent(path)}`);
                          const data = await res.json();
                          onFileSelect(path, data.content, false);
                        }
                      } catch (error) {
                        console.error("Failed to add file to canvas:", error);
                      }
                    },
                  )
                : null;

              // AI/Tools spawn categories for directories
              let aiCategoryItem: HTMLDivElement | null = null;
              let toolsCategoryItem: HTMLDivElement | null = null;

              if (isDirectory && spawnOptions.length > 0) {
                const aiOptions = spawnOptions.filter((opt: any) =>
                  opt.label.toLowerCase().includes('claude') ||
                  opt.label.toLowerCase().includes('opencode') ||
                  opt.label.toLowerCase().includes('codex') ||
                  opt.label.toLowerCase().includes('gemini') ||
                  opt.label.toLowerCase().includes('aichat')
                );

                const toolOptions = spawnOptions.filter((opt: any) =>
                  !aiOptions.includes(opt)
                );

                // Helper to create submenu
                const createSubmenu = (options: any[], categoryName: string) => {
                  const submenu = document.createElement("div");
                  submenu.id = "op-spawn-submenu";
                  submenu.style.cssText = `
                    position: fixed;
                    left: ${event.clientX + 180}px;
                    top: ${event.clientY}px;
                    background: rgba(30, 30, 40, 0.98);
                    border: 1px solid rgba(255, 200, 87, 0.3);
                    border-radius: 6px;
                    padding: 4px 0;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
                    z-index: 100002;
                    min-width: 200px;
                  `;

                  // Add working directory header
                  const header = document.createElement("div");
                  header.style.cssText = `
                    padding: 6px 12px;
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    font-family: 'Courier New', monospace;
                    border-bottom: 1px solid rgba(255, 200, 87, 0.2);
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  `;
                  header.textContent = path.length > 35 ? '...' + path.slice(-32) : path;
                  submenu.appendChild(header);

                  // Add option items
                  options.forEach((option: any) => {
                    const item = document.createElement("div");
                    item.style.cssText = `
                      padding: 8px 16px;
                      color: #ffffff;
                      cursor: pointer;
                      font-size: 12px;
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      transition: background 0.2s;
                      pointer-events: auto;
                      user-select: none;
                    `;
                    item.innerHTML = `<span style="opacity: 0.8;">${option.icon}</span> ${option.label}`;

                    // Test if events are working
                    item.addEventListener('click', (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSpawn(option.command, path, option.terminalType, option.defaultSize, option.defaultTheme, option.defaultTransparency);
                      // Remove both menus
                      if (submenu.parentNode) submenu.remove();
                      const mainMenu = document.getElementById("op-file-context-menu");
                      if (mainMenu && mainMenu.parentNode) mainMenu.remove();
                    }, true);

                    item.addEventListener('mousedown', (e) => {
                      console.log('[EnhancedFileViewer] MOUSEDOWN EVENT:', option.label);
                    }, true);

                    item.onmouseover = () => {
                      console.log('[EnhancedFileViewer] Mouse over:', option.label);
                      item.style.background = "rgba(255, 200, 87, 0.2)";
                    };
                    item.onmouseout = () => {
                      item.style.background = "transparent";
                    };

                    submenu.appendChild(item);
                  });

                  // Add hover handlers to keep submenu alive
                  let submenuTimeout: NodeJS.Timeout | null = null;
                  submenu.onmouseleave = () => {
                    submenuTimeout = setTimeout(() => {
                      if (submenu.parentNode) {
                        submenu.remove();
                      }
                    }, 300);
                  };
                  submenu.onmouseenter = () => {
                    if (submenuTimeout) {
                      clearTimeout(submenuTimeout);
                      submenuTimeout = null;
                    }
                  };

                  return submenu;
                };

                // AI Category
                if (aiOptions.length > 0) {
                  aiCategoryItem = makeItem(
                    '<span style="opacity: 0.8;">🤖</span> AI <span style="margin-left: auto; opacity: 0.5;">▶</span>',
                    () => {}
                  );
                  aiCategoryItem.onmouseenter = () => {
                    const existingSubmenu = document.getElementById("op-spawn-submenu");
                    if (existingSubmenu) existingSubmenu.remove();
                    const submenu = createSubmenu(aiOptions, 'AI');
                    document.body.appendChild(submenu);
                  };
                  aiCategoryItem.onmouseleave = (e: MouseEvent) => {
                    const submenu = document.getElementById("op-spawn-submenu");
                    if (submenu && !submenu.contains(e.relatedTarget as Node)) {
                      setTimeout(() => {
                        const stillExists = document.getElementById("op-spawn-submenu");
                        if (stillExists && !stillExists.matches(':hover')) {
                          stillExists.remove();
                        }
                      }, 300);
                    }
                  };
                }

                // Tools Category
                if (toolOptions.length > 0) {
                  toolsCategoryItem = makeItem(
                    '<span style="opacity: 0.8;">🛠️</span> Tools <span style="margin-left: auto; opacity: 0.5;">▶</span>',
                    () => {}
                  );
                  toolsCategoryItem.onmouseenter = () => {
                    const existingSubmenu = document.getElementById("op-spawn-submenu");
                    if (existingSubmenu) existingSubmenu.remove();
                    const submenu = createSubmenu(toolOptions, 'Tools');
                    document.body.appendChild(submenu);
                  };
                  toolsCategoryItem.onmouseleave = (e: MouseEvent) => {
                    const submenu = document.getElementById("op-spawn-submenu");
                    if (submenu && !submenu.contains(e.relatedTarget as Node)) {
                      setTimeout(() => {
                        const stillExists = document.getElementById("op-spawn-submenu");
                        if (stillExists && !stillExists.matches(':hover')) {
                          stillExists.remove();
                        }
                      }, 300);
                    }
                  };
                }
              }

              const toggleItem = makeItem(
                isFavorite
                  ? '<span style="color: #fbbf24;">★</span> Remove from Favorites'
                  : '<span style="color: #60a5fa;">☆</span> Add to Favorites',
                () => toggleFavorite(path),
              );

              const closeItem = makeItem(
                '<span style="opacity: 0.7;">✖</span> Close',
                () => {},
              );

              // Assemble menu items
              menu.appendChild(copyPathItem);
              if (relativeItem) menu.appendChild(relativeItem);
              if (atFilenameItem) menu.appendChild(atFilenameItem);
              // Removed viewFullscreenItem - view file functionality removed from context menu
              if (addToCanvasItem) menu.appendChild(addToCanvasItem);
              // Add AI/Tools spawn categories for directories
              if (aiCategoryItem) menu.appendChild(aiCategoryItem);
              if (toolsCategoryItem) menu.appendChild(toolsCategoryItem);
              menu.appendChild(toggleItem);
              menu.appendChild(closeItem);
              document.body.appendChild(menu);

              // Close handlers
              const removeAll = () => {
                cleanup();
                const submenu = document.getElementById("op-spawn-submenu");
                if (submenu) submenu.remove();
                if (document.body.contains(menu))
                  document.body.removeChild(menu);
              };
              const handleOutsidePointer = (e: Event) => {
                if (!(e.target instanceof Node)) return removeAll();
                // Check if click is inside main menu OR submenu
                const submenu = document.getElementById("op-spawn-submenu");
                if (!menu.contains(e.target) && (!submenu || !submenu.contains(e.target))) {
                  removeAll();
                }
              };
              const handleEscape = (e: KeyboardEvent) => {
                if (e.key === "Escape") removeAll();
              };
              const cleanup = () => {
                document.removeEventListener(
                  "mousedown",
                  handleOutsidePointer,
                  true,
                );
                document.removeEventListener("contextmenu", removeAll, true);
                document.removeEventListener("wheel", removeAll, {
                  capture: true,
                } as any);
                window.removeEventListener("resize", removeAll);
                window.removeEventListener("scroll", removeAll, true);
                document.removeEventListener("keydown", handleEscape);
              };
              // Delay attaching to avoid immediate close from the same event loop tick
              setTimeout(() => {
                document.addEventListener(
                  "mousedown",
                  handleOutsidePointer,
                  true,
                );
                document.addEventListener("contextmenu", removeAll, true);
                document.addEventListener("wheel", removeAll, {
                  capture: true,
                } as any);
                window.addEventListener("resize", removeAll);
                window.addEventListener("scroll", removeAll, true);
                document.addEventListener("keydown", handleEscape);
              }, 0);
            }}
          />
        </div>

        {/* Quick tips */}
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(255, 200, 87, 0.1)",
            background: "rgba(0, 0, 0, 0.3)",
            fontSize: "10px",
            color: "#60a5fa",
          }}
        >
          💡 Tip: Click the ★ on items or right-click to manage favorites
        </div>
      </div>
      {/* Fullscreen viewer removed - using DraggableFileViewer instead */}

      {/* Directory Selector Modal */}
      {showDirSelector && (
        <DirectorySelector
          isOpen={showDirSelector}
          currentPath={workingDirectory || "/home/matt/workspace"}
          onSelect={(path) => {
            updateSettings({ workingDirectory: path });
            setShowDirSelector(false);
          }}
          onClose={() => setShowDirSelector(false)}
          title="Set Home Directory"
          selectButtonText="Set as Home"
        />
      )}

      {/* File Creation Modal */}
      <FileCreationModal
        isOpen={showFileCreationModal}
        onClose={() => setShowFileCreationModal(false)}
        onFileCreated={async (path) => {
          setShowFileCreationModal(false);

          // If it's a markdown file, open it as a card
          if (path.endsWith(".md") || path.endsWith(".markdown")) {
            try {
              const response = await fetch(
                `http://localhost:8127/api/files/read?path=${encodeURIComponent(path)}`,
              );
              if (response.ok) {
                const data = await response.json();
                onFileSelect(path, data.content, false);
              }
            } catch (err) {
              console.error("Failed to open newly created file:", err);
            }
          }

          // TODO: Refresh the file tree to show the new file
        }}
        initialPath="/home/matt/workspace/opustrator"
      />
    </>
  );
};

export const EnhancedFileViewer = React.memo(EnhancedFileViewerComponent);
export default EnhancedFileViewer;
