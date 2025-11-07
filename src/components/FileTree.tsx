import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
  FileText,
  Code,
  Image,
  Archive,
  Terminal,
  Home,
  FileJson,
  FileCode,
  Star,
  Minimize2,
} from "lucide-react";
import "./FileTree.css";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  children?: FileNode[];
}

interface FileTreeProps {
  onFileSelect?: (path: string, isDirectory: boolean) => void;
  onDirectorySelect?: (path: string) => void;
  defaultPath?: string;
  basePath?: string; // Alternative to defaultPath for clearer naming
  mode?: "select-file" | "select-directory" | "browse";
  fileFilter?: (path: string, isDirectory?: boolean) => boolean;
  onContextMenu?: (
    path: string,
    isDirectory: boolean,
    event: React.MouseEvent,
    basePath?: string,
  ) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (path: string) => void;
  showHidden?: boolean; // Accept as prop
  maxDepth?: number; // Accept as prop
}

export interface FileTreeHandle {
  expandToPath: (path: string) => void;
}

export const FileTree = forwardRef<FileTreeHandle, FileTreeProps>((props, ref) => {
  const {
    onFileSelect,
    onDirectorySelect,
    defaultPath = "/home/matt/workspace",
    basePath,
    mode = "browse",
    fileFilter,
    onContextMenu,
    favorites,
    onToggleFavorite,
    showHidden: showHiddenProp = false,
    maxDepth = 5,
  } = props;
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null); // For keyboard navigation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPath, setCurrentPath] = useState(basePath || defaultPath); // Use basePath if provided
  const [showHidden, setShowHidden] = useState(showHiddenProp);
  const [initialExpanded, setInitialExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    expandToPath: (targetPath: string) => {
      // Expand all parent folders of the target path
      const pathParts = targetPath.split('/').filter(Boolean);
      const foldersToExpand = new Set<string>(expandedFolders);

      // Build path progressively and add each folder
      let currentPathBuild = '';
      for (const part of pathParts) {
        currentPathBuild += (currentPathBuild ? '/' : '') + part;
        foldersToExpand.add(currentPathBuild);
      }

      setExpandedFolders(foldersToExpand);
      setSelectedPath(targetPath);

      // Scroll to the path after a brief delay to let DOM update
      setTimeout(() => {
        const element = document.querySelector(`[data-path="${targetPath}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Brief highlight effect
          element.classList.add('highlight-flash');
          setTimeout(() => element.classList.remove('highlight-flash'), 1000);
        }
      }, 100);
    },
  }));

  // Update currentPath when basePath changes
  useEffect(() => {
    if (basePath) {
      setCurrentPath(basePath);
    }
  }, [basePath]);

  // Fetch file tree
  const fetchFileTree = useCallback(
    async (path?: string) => {
      setLoading(true);
      setError(null);

      const targetPath = path || currentPath;

      try {
        const response = await fetch(
          `/api/files/tree?${new URLSearchParams({
            path: targetPath,
            depth: maxDepth.toString(),
            showHidden: showHidden.toString(),
          })}`,
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load file tree");
        }

        const data = await response.json();

        // Debug: Log tree structure
        console.log(`[FileTree] Fetched tree for: ${targetPath}`);
        console.log(`[FileTree] Root has ${data.children?.length || 0} children`);
        if (data.children && data.children.length > 0) {
          console.log(`[FileTree] First few items:`, data.children.slice(0, 3).map((c: FileNode) => ({
            name: c.name,
            type: c.type,
            childCount: c.children?.length || 0
          })));
        }

        setFileTree(data);

        // Only expand the root folder - user manually expands subdirs as needed
        if (data) {
          const foldersToExpand = new Set<string>();
          foldersToExpand.add(data.path); // Just the root

          setExpandedFolders(foldersToExpand);

          console.log(`[FileTree] Expanded root folder only: ${targetPath}`);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load files");
      } finally {
        setLoading(false);
      }
    },
    [currentPath, showHidden, maxDepth],
  );

  // Initial load and reload when showHidden changes
  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  // Get file icon based on extension
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
      "css",
      "scss",
      "html",
      "vue",
      "rs",
      "go",
    ];
    const docExts = ["md", "txt", "doc", "docx", "pdf", "rtf"];
    const imageExts = ["png", "jpg", "jpeg", "gif", "svg", "ico", "webp"];
    const archiveExts = ["zip", "tar", "gz", "rar", "7z"];
    const jsonExts = ["json", "jsonc", "json5"];

    if (codeExts.includes(ext || ""))
      return <FileCode className="file-icon code" />;
    if (docExts.includes(ext || ""))
      return <FileText className="file-icon doc" />;
    if (imageExts.includes(ext || ""))
      return <Image className="file-icon image" />;
    if (archiveExts.includes(ext || ""))
      return <Archive className="file-icon archive" />;
    if (jsonExts.includes(ext || ""))
      return <FileJson className="file-icon json" />;
    return <File className="file-icon" />;
  };

  // Filter nodes based on search and fileFilter (moved up before visibleNodes)
  const filterNodes = useCallback(
    (node: FileNode): FileNode | null => {
      // Filter out files when in select-directory mode
      if (mode === "select-directory" && node.type === "file") {
        return null;
      }

      // Apply file filter if provided (now works for both files and directories)
      if (fileFilter && !fileFilter(node.path, node.type === "directory")) {
        return null;
      }

      // Apply search filter
      if (searchQuery) {
        const matches = node.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

        if (node.type === "file") {
          return matches ? node : null;
        }

        // For directories, include if name matches or has matching children
        const filteredChildren = node.children
          ?.map((child) => filterNodes(child))
          .filter(Boolean) as FileNode[] | undefined;

        if (matches || (filteredChildren && filteredChildren.length > 0)) {
          return { ...node, children: filteredChildren };
        }

        return null;
      }

      // No search query, just apply file filter to children
      if (node.type === "directory" && node.children) {
        const filteredChildren = node.children
          .map((child) => filterNodes(child))
          .filter(Boolean) as FileNode[];

        return { ...node, children: filteredChildren };
      }

      return node;
    },
    [searchQuery, fileFilter, mode],
  );

  // Memoize the filtered tree (moved up before visibleNodes)
  const filteredTree = useMemo(() => {
    if (!fileTree) return null;
    return filterNodes(fileTree);
  }, [fileTree, filterNodes]);

  // Build flat list of visible nodes for keyboard navigation
  const buildVisibleNodesList = useCallback((node: FileNode | null): FileNode[] => {
    if (!node) return [];
    const result: FileNode[] = [node];

    if (node.type === 'directory' && expandedFolders.has(node.path) && node.children) {
      for (const child of node.children) {
        result.push(...buildVisibleNodesList(child));
      }
    }

    return result;
  }, [expandedFolders]);

  // Memoize visible nodes list
  const visibleNodes = useMemo(() => {
    if (!filteredTree) return [];
    const nodes = buildVisibleNodesList(filteredTree);

    // Add parent directory (..) as first item if not at root
    if (currentPath !== '/') {
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
      const parentNode: FileNode = {
        name: '..',
        path: '__parent__', // Special marker
        type: 'directory',
      };
      return [parentNode, ...nodes];
    }

    return nodes;
  }, [filteredTree, buildVisibleNodesList, currentPath]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: FileNode, event: React.MouseEvent) => {
      event.stopPropagation();

      if (node.type === "directory") {
        toggleFolder(node.path);
        setSelectedPath(node.path);

        if (mode === "select-directory" && onDirectorySelect) {
          onDirectorySelect(node.path);
        }
      } else {
        setSelectedPath(node.path);

        if ((mode === "select-file" || mode === "browse") && onFileSelect) {
          onFileSelect(node.path, false);
        }
      }
    },
    [mode, onFileSelect, onDirectorySelect, toggleFolder],
  );

  // Navigate to parent directory
  const navigateUp = useCallback(() => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    setCurrentPath(parentPath);
    fetchFileTree(parentPath);
  }, [currentPath, fetchFileTree]);

  // Navigate to home (use basePath as home directory)
  const navigateHome = useCallback(() => {
    const homePath = basePath || defaultPath;
    setCurrentPath(homePath);
    fetchFileTree(homePath);
  }, [basePath, defaultPath, fetchFileTree]);

  // Collapse all folders (keep only root expanded)
  const collapseAll = useCallback(() => {
    if (fileTree) {
      const rootOnly = new Set<string>();
      rootOnly.add(fileTree.path);
      setExpandedFolders(rootOnly);
    }
  }, [fileTree]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!visibleNodes.length) return;

      // Initialize focus from selected item if focus not set yet
      if (!focusedPath && selectedPath) {
        const selectedIndex = visibleNodes.findIndex((n) => n.path === selectedPath);
        if (selectedIndex >= 0) {
          setFocusedPath(visibleNodes[selectedIndex].path);
          return; // Let next keystroke handle navigation
        }
      }

      // Get current focused index
      const currentIndex = focusedPath
        ? visibleNodes.findIndex((n) => n.path === focusedPath)
        : 0;

      let newIndex = currentIndex;
      let handled = false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(currentIndex + 1, visibleNodes.length - 1);
          handled = true;
          break;

        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(currentIndex - 1, 0);
          handled = true;
          break;

        case 'ArrowRight': {
          e.preventDefault();
          const currentNode = visibleNodes[currentIndex];
          if (currentNode?.type === 'directory') {
            if (!expandedFolders.has(currentNode.path)) {
              toggleFolder(currentNode.path);
            } else if (currentNode.children && currentNode.children.length > 0) {
              // Already expanded, move to first child
              newIndex = currentIndex + 1;
            }
          }
          handled = true;
          break;
        }

        case 'ArrowLeft': {
          e.preventDefault();
          const currentNode = visibleNodes[currentIndex];
          if (currentNode?.type === 'directory' && expandedFolders.has(currentNode.path)) {
            // Collapse current folder
            toggleFolder(currentNode.path);
          } else {
            // Move to parent folder
            const parentPath = currentNode?.path.split('/').slice(0, -1).join('/');
            if (parentPath) {
              const parentIndex = visibleNodes.findIndex((n) => n.path === parentPath);
              if (parentIndex >= 0) newIndex = parentIndex;
            }
          }
          handled = true;
          break;
        }

        case 'Enter': {
          e.preventDefault();
          const currentNode = visibleNodes[currentIndex];
          if (currentNode) {
            // Handle parent directory (..) navigation
            if (currentNode.path === '__parent__') {
              navigateUp();
              handled = true;
              break;
            }

            if (currentNode.type === 'directory') {
              toggleFolder(currentNode.path);
            }
            setSelectedPath(currentNode.path);

            // Trigger appropriate callback
            if (currentNode.type === 'directory' && mode === 'select-directory' && onDirectorySelect) {
              onDirectorySelect(currentNode.path);
            } else if (currentNode.type === 'file' && onFileSelect) {
              onFileSelect(currentNode.path, false);
            }
          }
          handled = true;
          break;
        }

        case 'Home':
          e.preventDefault();
          newIndex = 0;
          handled = true;
          break;

        case 'End':
          e.preventDefault();
          newIndex = visibleNodes.length - 1;
          handled = true;
          break;
      }

      if (handled && newIndex !== currentIndex && visibleNodes[newIndex]) {
        setFocusedPath(visibleNodes[newIndex].path);

        // Scroll focused item into view
        setTimeout(() => {
          const element = document.querySelector(`[data-path="${visibleNodes[newIndex].path}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 0);
      }
    },
    [visibleNodes, focusedPath, selectedPath, expandedFolders, toggleFolder, mode, onDirectorySelect, onFileSelect, navigateUp]
  );

  // Render file tree recursively
  const renderFileTree = useCallback(
    (node: FileNode, depth = 0): React.ReactNode => {
      // Handle parent directory (..) specially
      if (node.path === '__parent__') {
        const isFocused = focusedPath === '__parent__';
        return (
          <div key="__parent__" className="file-tree-node">
            <div
              className={`file-tree-item parent-directory ${isFocused ? "focused" : ""}`}
              style={{ paddingLeft: '8px' }}
              onClick={(e) => {
                e.stopPropagation();
                navigateUp();
              }}
              title="Go up one level"
              data-path="__parent__"
            >
              <span className="file-tree-chevron">
                ↑
              </span>
              <span className="file-icon-wrapper">
                <Folder size={16} />
              </span>
              <span className="file-name">..</span>
            </div>
          </div>
        );
      }

      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedPath === node.path;
      const isFocused = focusedPath === node.path;
      const isDirectory = node.type === "directory";
      const isFavorite = favorites?.has(node.path) || false;

      return (
        <div key={node.path} className="file-tree-node">
          <div
            className={`file-tree-item ${isSelected ? "selected" : ""} ${isFocused ? "focused" : ""} ${isDirectory ? "directory" : "file"}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={(e) => handleNodeClick(node, e)}
            onContextMenu={(e) => {
              if (onContextMenu) {
                e.preventDefault();
                onContextMenu(node.path, isDirectory, e, currentPath);
              }
            }}
            title={node.path}
            data-path={node.path}
          >
            <span className="file-tree-chevron">
              {isDirectory &&
                (isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                ))}
            </span>
            <span className="file-icon-wrapper">
              {isDirectory ? (
                isExpanded ? (
                  <FolderOpen size={16} />
                ) : (
                  <Folder size={16} />
                )
              ) : (
                getFileIcon(node.name)
              )}
            </span>
            <span className="file-name">{node.name}</span>
            <button
              className="favorite-toggle"
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite && onToggleFavorite(node.path);
              }}
              style={{
                marginLeft: "6px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Star
                size={12}
                fill={isFavorite ? "#fbbf24" : "none"}
                color={isFavorite ? "#fbbf24" : "#8a8a8a"}
              />
            </button>
          </div>
          {isDirectory && isExpanded && node.children && (
            <div className="file-tree-children">
              {node.children.map((child) => renderFileTree(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [
      expandedFolders,
      selectedPath,
      focusedPath,
      handleNodeClick,
      favorites,
      onContextMenu,
      currentPath,
      navigateUp,
    ],
  );

  return (
    <div className="file-tree-container">
      {/* Header */}
      <div className="file-tree-header">
        <h3 className="file-tree-title">Files</h3>
        <div className="file-tree-actions">
          <button
            className="file-tree-btn"
            onClick={navigateHome}
            title="Go to home directory"
          >
            <Home size={16} />
          </button>
          <button className="file-tree-btn" onClick={navigateUp} title="Go up">
            ↑
          </button>
          <button
            className="file-tree-btn"
            onClick={() => fetchFileTree()}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className={`file-tree-btn ${showHidden ? "active" : ""}`}
            onClick={() => setShowHidden(!showHidden)}
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
            style={{ fontSize: "14px" }}
          >
            {showHidden ? "👁️" : "🙈"}
          </button>
          <button
            className="file-tree-btn"
            onClick={collapseAll}
            title="Collapse all folders"
          >
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {/* Current path */}
      <div className="file-tree-path">
        <span className="path-label">Path:</span>
        <span className="path-value" title={currentPath}>
          {currentPath.length > 40
            ? "..." + currentPath.slice(-37)
            : currentPath}
        </span>
      </div>

      {/* Search bar */}
      <div className="file-tree-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery("")}>
            ×
          </button>
        )}
      </div>

      {/* File tree content */}
      <div
        ref={containerRef}
        className="file-tree-content"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => {
          // Set focus to first visible node when clicking in tree
          if (!focusedPath && visibleNodes.length > 0) {
            setFocusedPath(visibleNodes[0].path);
          }
        }}
      >
        {loading && <div className="file-tree-loading">Loading files...</div>}
        {error && <div className="file-tree-error">Error: {error}</div>}

        {!loading && !error && filteredTree && (
          <div className="file-tree">
            {/* Render parent directory (..) if not at root */}
            {currentPath !== '/' && (
              renderFileTree({
                name: '..',
                path: '__parent__',
                type: 'directory',
              })
            )}
            {renderFileTree(filteredTree)}
          </div>
        )}
        {!loading && !error && fileTree && !filteredTree && (
          <div className="file-tree-empty">No files found</div>
        )}
      </div>

      {/* Selected path display */}
      {selectedPath && mode !== "browse" && (
        <div className="file-tree-selection">
          <span className="selection-label">Selected:</span>
          <span className="selection-value" title={selectedPath}>
            {selectedPath.split("/").pop()}
          </span>
        </div>
      )}
    </div>
  );
});
