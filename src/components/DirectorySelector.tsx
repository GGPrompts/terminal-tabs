import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { FileTree } from "./FileTree";
import { useSettingsStore } from "../stores/useSettingsStore";
import { Home, X, Star } from "lucide-react";

interface DirectorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  currentPath?: string;
  title?: string;
  selectButtonText?: string;
  fileSelectionMode?: boolean;
  fileExtensions?: string[];
}

export const DirectorySelector: React.FC<DirectorySelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentPath = "/workspace",
  title = "Select Working Directory",
  selectButtonText = "Select Directory",
  fileSelectionMode = false,
  fileExtensions = [],
}) => {
  const [selectedPath, setSelectedPath] = useState<string>(currentPath);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Get FileTree settings from store
  const fileTreeMaxDepth = useSettingsStore((state) => state.fileTreeMaxDepth);

  // Load favorites from settings store
  useEffect(() => {
    const stored = useSettingsStore.getState().directoryFavorites;
    if (stored && stored.length > 0) {
      setFavorites(new Set(stored));
    }
  }, []);

  // Save favorites to settings store
  const toggleFavorite = (path: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(path)) {
        newFavorites.delete(path);
      } else {
        newFavorites.add(path);
      }
      useSettingsStore.getState().updateSettings({
        directoryFavorites: Array.from(newFavorites),
      });
      return newFavorites;
    });
  };

  if (!isOpen) return null;

  const handleSelect = () => {
    onSelect(selectedPath);
    onClose();
  };

  const modalContent = (
    <div
      className="directory-selector-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100000,
        animation: "fadeIn 0.2s ease-in-out",
      }}
    >
      <div
        className="directory-selector-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(135deg, rgba(20, 20, 30, 0.98), rgba(30, 30, 45, 0.98))",
          border: "1px solid rgba(255, 200, 87, 0.3)",
          borderRadius: "12px",
          width: "600px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          animation: "slideIn 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 200, 87, 0.2)",
            background:
              "linear-gradient(135deg, rgba(255, 200, 87, 0.1), rgba(255, 100, 100, 0.1))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Home size={20} color="#ffc857" />
            <h3
              style={{
                margin: 0,
                color: "#ffc857",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#ff6464",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255, 100, 100, 0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* Current selection and filters */}
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(96, 165, 250, 0.1)",
            borderBottom: "1px solid rgba(96, 165, 250, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <span
              style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600 }}
            >
              Selected:
            </span>
            <span
              style={{
                color: "#ffffff",
                fontSize: "12px",
                fontFamily: "Monaco, Menlo, monospace",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedPath}
            </span>
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              background: showFavoritesOnly
                ? "rgba(251, 191, 36, 0.2)"
                : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${showFavoritesOnly ? "rgba(251, 191, 36, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
              borderRadius: "6px",
              color: showFavoritesOnly ? "#fbbf24" : "#a0a0a0",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!showFavoritesOnly) {
                e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.3)";
                e.currentTarget.style.color = "#fbbf24";
              }
            }}
            onMouseLeave={(e) => {
              if (!showFavoritesOnly) {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.color = "#a0a0a0";
              }
            }}
          >
            <Star size={14} fill={showFavoritesOnly ? "#fbbf24" : "none"} />
            <span>
              {showFavoritesOnly ? "Showing Favorites" : "Show Favorites Only"}
            </span>
          </button>
        </div>

        {/* File Tree */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px",
          }}
        >
          <FileTree
            mode={fileSelectionMode ? "select-file" : "select-directory"}
            defaultPath={currentPath}
            onDirectorySelect={!fileSelectionMode ? setSelectedPath : undefined}
            onFileSelect={
              fileSelectionMode ? (path) => setSelectedPath(path) : undefined
            }
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            maxDepth={fileTreeMaxDepth}
            fileFilter={
              showFavoritesOnly
                ? (path, isDirectory) => {
                    // When not in file selection mode, only show directories
                    if (!fileSelectionMode && !isDirectory) return false;

                    // For directories, show if:
                    // 1. The directory itself is favorited
                    // 2. Any parent directory is favorited (show children of favorites)
                    // 3. Any child is favorited (show parents to reach favorites)
                    if (isDirectory) {
                      // Check if this directory is favorited
                      if (favorites.has(path)) return true;

                      // Check if any parent directory is favorited (we're a child of a favorite)
                      let currentPath = path;
                      while (currentPath && currentPath !== "/") {
                        if (favorites.has(currentPath)) return true;
                        const lastSlash = currentPath.lastIndexOf("/");
                        currentPath =
                          lastSlash > 0
                            ? currentPath.substring(0, lastSlash)
                            : "/";
                        if (favorites.has(currentPath)) return true;
                      }

                      // Check if any child is favorited (we need to show parents to reach favorites)
                      for (const favPath of favorites) {
                        if (favPath.startsWith(path + "/")) return true;
                      }

                      return false;
                    }
                    // For files in file selection mode only
                    return fileSelectionMode && favorites.has(path);
                  }
                : undefined
            }
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            padding: "16px 20px",
            borderTop: "1px solid rgba(255, 200, 87, 0.2)",
            background: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              borderRadius: "6px",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            style={{
              flex: 1,
              padding: "10px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.5)",
              borderRadius: "6px",
              color: "#10b981",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(16, 185, 129, 0.3)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {selectButtonText}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside component tree
  return ReactDOM.createPortal(modalContent, document.body);
};
