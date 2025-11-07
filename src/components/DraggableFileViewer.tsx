import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Editor from "@monaco-editor/react";
import { useCanvasStore, CardState } from "../stores/canvasStore";
import { useUIStore } from "../stores/useUIStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useLockableComponent } from "../hooks/useLockableComponent";
import { AnimatedBackground } from "../backgrounds";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { ensureVisiblePosition, calculateSafeSpawnPosition } from "../utils/positionUtils";
import { resolveAnimatedBackgroundType } from "../utils/backgroundUtils";
import {
  getFileTypeAndLanguage,
  getFileIcon,
  getFileTheme,
  applyOpacityToRgba,
  applyOpacityToGradient
} from "../utils/fileTypeUtils";
import { FileViewerCustomizer, useFileViewerTheme } from "./FileViewerCustomizer";
import "./DraggableFileViewer.css";

interface DraggableFileViewerProps {
  id: string;
  title: string;
  content: string;
  filePath: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  canvasZoom?: number;
  backgroundType?:
    | "balatro"
    | "particles"
    | "gradient"
    | "waves"
    | "rain"
    | "clouds"
    | "none";
  startInEditMode?: boolean;
  canvasOffset?: { x: number; y: number };
  onUpdate?: (id: string, updates: Partial<CardState>) => void;
}

export const DraggableFileViewer: React.FC<DraggableFileViewerProps> = React.memo(({
  id,
  title,
  content: initialContent,
  filePath,
  initialPosition,
  initialSize,
  onClose,
  zIndex,
  onFocus,
  canvasZoom = 1,
  backgroundType,
  startInEditMode = false,
  canvasOffset,
}) => {
  // Get viewport and defaults from store
  const viewport = useCanvasStore((state) => state.viewport);
  const defaultFileViewerSizeFromStore = useSettingsStore((state) => state.defaultFileViewerSize);

  // Use provided size or fall back to global default
  const effectiveInitialSize = initialSize || defaultFileViewerSizeFromStore || { width: 800, height: 650 };

  // Calculate safe spawn position (clamped to viewport and world bounds)
  const safeInitialPosition = useMemo(() => {
    if (initialPosition) {
      const PADDING = 100;
      const WORLD_MIN = 0;
      const WORLD_MAX = 10000;
      return {
        x: Math.max(WORLD_MIN + PADDING, Math.min(initialPosition.x, WORLD_MAX - PADDING - effectiveInitialSize.width)),
        y: Math.max(WORLD_MIN + PADDING, Math.min(initialPosition.y, WORLD_MAX - PADDING - effectiveInitialSize.height)),
      };
    }
    return calculateSafeSpawnPosition(
      effectiveInitialSize,
      canvasOffset ? { x: canvasOffset.x, y: canvasOffset.y } : { x: viewport.x, y: viewport.y },
      canvasZoom,
      []
    );
    // IMPORTANT: Only depend on initialPosition and size to prevent flickering
    // When zoom/offset changes, we don't want to recalculate file viewer positions!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, effectiveInitialSize]);

  const [position, setPosition] = useState(safeInitialPosition);
  const [size, setSize] = useState(effectiveInitialSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const isFullscreenMode = useUIStore((state) => state.isFullscreenMode);
  const toggleFullscreenMode = useUIStore((state) => state.toggleFullscreenMode);

  // Get global defaults from settings store
  const fileViewerDefaultFontSize = useSettingsStore((state) => state.fileViewerDefaultFontSize);
  const fileViewerDefaultTransparency = useSettingsStore((state) => state.fileViewerDefaultTransparency);
  const fileViewerDefaultTheme = useSettingsStore((state) => state.fileViewerDefaultTheme);
  const fileViewerDefaultFontFamily = useSettingsStore((state) => state.fileViewerDefaultFontFamily);
  const defaultFileViewerSize = useSettingsStore((state) => state.defaultFileViewerSize);
  const globalBackgroundTheme = useSettingsStore((state) => state.backgroundTheme);

  // Zustand store integration - MUST be before useState that uses currentCard
  const { updateCard, addCard, cards, selectItem, isSelected } = useCanvasStore();

  // Get current card to check for saved settings - MUST be before useState
  const currentCard = cards.get(id);

  const [showRaw, setShowRaw] = useState(false);
  const [fontSize, setFontSize] = useState(fileViewerDefaultFontSize);
  const [wrapLines, setWrapLines] = useState(true);
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [editContent, setEditContent] = useState(initialContent);
  const [dragKey, setDragKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(false);
  const [fileOpacity, setFileOpacity] = useState(fileViewerDefaultTransparency ?? 0.1); // Use global default
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isHovered, setIsHovered] = useState(false); // For expandable header
  const customizerButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedThemeId, setSelectedThemeId] = useState(() => currentCard?.themeId || fileViewerDefaultTheme || 'default');
  const selectedTheme = useFileViewerTheme(selectedThemeId);
  const [fontFamily, setFontFamily] = useState(() => currentCard?.fontFamily || fileViewerDefaultFontFamily || 'monospace');
  const [fontFamilyOverridden, setFontFamilyOverridden] = useState(() => !!currentCard?.fontFamily);
  const resizeStartMouse = useRef<{ x: number; y: number } | null>(null);
  const resizeStartSize = useRef<{ width: number; height: number } | null>(
    null,
  );

  const nodeRef = useRef<HTMLDivElement>(null);
  const savedState = useRef<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const editorRef = useRef<any>(null); // For Monaco editor reference

  const { type, language } = getFileTypeAndLanguage(filePath);

  // Use the lockable component hook
  const { isLocked, lockedZoom, viewportPosition, handleLockToggle, renderPlaceholder } = useLockableComponent({
    id,
    nodeRef,
    initialLocked: currentCard?.isLocked || false,
    initialLockedZoom: currentCard?.lockedZoom || 1,
    initialViewportPosition: currentCard?.viewportPosition || { x: 100, y: 100 },
    initialCanvasPosition: currentCard?.position || position,  // Use stored position for locked placeholder
    initialSize: currentCard?.size || size,
    currentPosition: position,  // Pass current position for accurate placeholder
    currentSize: size,          // Pass current size for accurate placeholder
    canvasZoom,
    onLockChange: (locked) => {
      // Update card in store when lock state changes
      updateCard(id, { isLocked: locked });
    },
    updateStore: updateCard,
    // Placeholder configuration
    placeholderVariant: 'file-viewer',
    placeholderName: filePath.split('/').pop() || 'File',
  });

  // Icon view removed - file viewers always show at all zoom levels

  // Use selected theme instead of file type theme
  const theme = selectedTheme;

  // Selection state
  const selected = isSelected(id);

  // Click-to-select handler
  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas deselect
    if (e.shiftKey) {
      selectItem(id, true); // Multi-select
    } else {
      selectItem(id, false); // Single select
    }
  }, [id, selectItem]);

  // Header should be slightly more opaque than body for better control visibility
  const headerOpacity = Math.min(fileOpacity + 0.1, 1.0);

  const headerStyle: React.CSSProperties = {
    background: selectedTheme.headerFrom && selectedTheme.headerTo
      ? `linear-gradient(135deg, ${applyOpacityToRgba(selectedTheme.headerFrom, headerOpacity * 0.8)}, ${applyOpacityToRgba(selectedTheme.headerTo, headerOpacity * 0.8)})`
      : selectedTheme.background.includes('gradient')
        ? selectedTheme.background
        : `rgba(30, 30, 40, ${headerOpacity * 0.8})`,
    borderBottom: `1px solid ${applyOpacityToRgba(selectedTheme.border, headerOpacity)}`,
    backdropFilter: fileOpacity < 0.7 ? "blur(10px)" : "none",
    color: selectedTheme.textColor,
  };

  const containerStyle: React.CSSProperties = {
    background: selectedTheme.background.includes('gradient')
      ? applyOpacityToGradient(selectedTheme.background, fileOpacity)
      : `rgba(20, 20, 30, ${fileOpacity})`,
    border: `1px solid ${applyOpacityToRgba(selectedTheme.border, fileOpacity)}`,
  };

  // Initialize card in store and sync state
  useEffect(() => {
    const existingCard = cards.get(id);
    if (!existingCard) {
      // Add the file viewer card to the store for persistence
      addCard({
        id,
        title,
        content: initialContent,
        backContent: filePath, // Store the file path in backContent
        variant: "default",
        position,
        size,
        editable: false,
        isMarkdown: false, // File viewers are handled differently from markdown cards
      });
    } else {
      // Sync transparency and pin state from store (lock state is handled by hook)
      // Note: transparency might not exist in CardState interface
      const cardData = existingCard as any;
      if (cardData.transparency !== undefined)
        setFileOpacity(cardData.transparency);
    }
    // Don't include position and size in deps as they're objects and could cause re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cards, addCard, title, initialContent, filePath]);

  // Auto-fetch content if empty and filePath looks like a real file path
  useEffect(() => {
    // Skip fetching if filePath doesn't look like a real file path
    // This prevents trying to fetch old backContent values like "Additional notes on the back"
    const isValidFilePath = filePath && (
      filePath.includes('/') ||
      filePath.includes('\\') ||
      filePath.includes('.') ||
      filePath.startsWith('~')
    );

    // Only fetch if we don't have content and have a valid file path
    if (!content && !initialContent && isValidFilePath) {
      setLoading(true);
      fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`)
        .then((response) => response.json())
        .then((data) => {
          setContent(data.content || "");
          setLoading(false);
        })
        .catch((error) => {
          console.error("Failed to fetch file content:", error);
          setContent("Failed to load file content");
          setLoading(false);
        });
    }
  }, [filePath, initialContent]); // Removed 'content' from dependencies to prevent infinite loop

  // Keep editable buffer in sync when content changes externally and not editing
  useEffect(() => {
    if (!isEditing) setEditContent(content);
  }, [content, isEditing]);

  // Keep local font family in sync with global default when not overridden
  useEffect(() => {
    if (!fontFamilyOverridden) {
      setFontFamily(fileViewerDefaultFontFamily || 'monospace');
    }
  }, [fileViewerDefaultFontFamily, fontFamilyOverridden]);

  // Handle markdown formatting insertion
  const handleInsertFormatting = useCallback((before: string, after?: string, defaultText?: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = editor.getSelection();
    const model = editor.getModel();

    if (!selection || !model) return;

    const selectedText = model.getValueInRange(selection);
    const textToInsert = selectedText || defaultText || '';
    const newText = after ? `${before}${textToInsert}${after}` : `${before}${textToInsert}`;

    editor.executeEdits('', [{
      range: selection,
      text: newText,
      forceMoveMarkers: true
    }]);

    // If no text was selected, position cursor after the prefix
    if (!selectedText && after) {
      const position = selection.getStartPosition();
      const newPosition = {
        lineNumber: position.lineNumber,
        column: position.column + before.length + (defaultText?.length || 0)
      };
      editor.setPosition(newPosition);
      editor.focus();
    }
  }, []);

  // Helper to detect if any descendant is block-like (e.g., code block rendered as div/pre)
  const hasBlockDescendant = (node: any): boolean => {
    if (node == null || typeof node === "boolean") return false;
    if (Array.isArray(node)) return node.some(hasBlockDescendant);
    if (typeof node === "string" || typeof node === "number") return false;
    if (React.isValidElement(node)) {
      const type = node.type as any;
      const props: any = node.props || {};
      const blockTags = [
        "div",
        "pre",
        "table",
        "blockquote",
        "ul",
        "ol",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ];
      if (typeof type === "string" && blockTags.includes(type)) return true;
      // Heuristic: a code element with language class or multiline content is block-like
      if (
        type === "code" &&
        (/(^|\s)language-/.test(props.className || "") ||
          /\n/.test(String(props.children || "")))
      ) {
        return true;
      }
      // ReactMarkdown passes `inline` to our custom code renderer. If inline === false
      // then this child will render as a block (e.g., SyntaxHighlighter or <pre>),
      // so prevent wrapping it in a paragraph.
      if (props && props.inline === false) {
        return true;
      }
      return hasBlockDescendant(props.children);
    }
    return false;
  };

  const handleResizeStart = (e: any) => {
    setIsResizing(true);
    resizeStartMouse.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { ...size };
  };

  const handleResize = (e: any) => {
    if (!resizeStartMouse.current || !resizeStartSize.current) return;
    const deltaX = (e.clientX - resizeStartMouse.current.x) / (canvasZoom || 1);
    const deltaY = (e.clientY - resizeStartMouse.current.y) / (canvasZoom || 1);

    // Clamp to reasonable world coordinate limits to prevent canvas-wide cards
    // Min: 400x300 (readable), Max: 2000x1500 (prevents corruption)
    const newWidth = Math.max(400, Math.min(2000, resizeStartSize.current.width + deltaX));
    const newHeight = Math.max(300, Math.min(1500, resizeStartSize.current.height + deltaY));
    setSize({ width: newWidth, height: newHeight });
  };

  const handleStop = (_e?: any, data?: { x: number; y: number }) => {
    // Don't save position if maximized (portal mode) - prevents fullscreen portal position from being saved as canvas position
    if (isMaximized) {
      setIsDragging(false);
      return;
    }

    if (data) {
      // Persist the final position after drag without re-rendering during drag
      const finalPos = { x: data.x, y: data.y };
      setPosition(finalPos);
      updateCard(id, { position: finalPos, size });
    } else {
      updateCard(id, { position, size });
    }
    setIsDragging(false);
  };

  const handleResizeStop = () => {
    setIsResizing(false);
    resizeStartMouse.current = null;
    resizeStartSize.current = null;
    updateCard(id, { position, size });
  };

  const toggleMaximize = () => {
    if (isMaximized && savedState.current) {
      setPosition(savedState.current.position);
      setSize(savedState.current.size);
      setIsMaximized(false);
      // Exit fullscreen mode if active
      if (isFullscreenMode) {
        toggleFullscreenMode();
      }
      // Force Draggable to remount with new defaultPosition
      setDragKey((k) => k + 1);
    } else {
      savedState.current = { position, size };
      setIsMaximized(true);
      // Enter fullscreen mode using the global toggle
      if (!isFullscreenMode) {
        toggleFullscreenMode();
      }
      onFocus(id);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/files/content?path=${encodeURIComponent(filePath)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setContent(data.content || "");
      }
    } catch (error) {
      console.error("Failed to refresh file:", error);
    } finally {
      setLoading(false);
    }
  };


  const renderContent = () => {
    if (loading) {
      return (
        <div
          className="file-viewer-loading"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "#a0a0a0",
          }}
        >
          Loading file content...
        </div>
      );
    }

    if (type === "image") {
      // For images, we'd need a different approach - perhaps base64 encoding from backend
      return (
        <div className="file-viewer-image">
          <p>Image viewing requires base64 encoding from backend</p>
          <p>File: {filePath}</p>
        </div>
      );
    }

    if (isEditing) {
      const monacoLanguage =
        type === "json"
          ? "json"
          : type === "markdown"
            ? "markdown"
            : language || "plaintext";
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "8px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {type === "markdown" && (
            <div style={{ padding: "8px 12px", background: "rgba(0, 0, 0, 0.3)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <MarkdownToolbar onInsert={handleInsertFormatting} />
            </div>
          )}
          <Editor
            height={type === "markdown" ? "calc(100% - 48px)" : "100%"}
            language={monacoLanguage}
            value={editContent}
            theme="vs-dark"
            onChange={(value) => setEditContent(value || "")}
            onMount={(editor, monaco) => {
              // Store editor reference
              editorRef.current = editor;
              // Focus the editor when it mounts
              editor.focus();
              // Update the value to ensure it's editable
              editor.setValue(editContent);
            }}
            options={{
              readOnly: false,
              fontSize,
              fontFamily,
              wordWrap: wrapLines ? "on" : "off",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              formatOnPaste: true,
              formatOnType: true,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "all",
              quickSuggestions: true,
              tabSize: 2,
              insertSpaces: true,
              folding: true,
              lineNumbers: "on",
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
              },
            }}
          />
        </div>
      );
    }

    if (showRaw || type === "text") {
      // Plain text view
      return (
        <pre
          className="file-viewer-text"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            whiteSpace: wrapLines ? "pre-wrap" : "pre",
            wordBreak: wrapLines ? "break-word" : "normal",
          }}
        >
          {content}
        </pre>
      );
    }

    if (type === "markdown") {
      // Markdown rendering with copy button support
      return (
        <div
          className="file-viewer-markdown"
          style={{
            fontSize: `${fontSize}px`,
            color: "#e0e0e0",
            lineHeight: "1.6",
            fontFamily: fontFamily,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre({ children, ...props }) {
                return <>{children}</>;
              },
              code({ className, children, node, inline, ...props }: any) {
                // For inline code, return simple element only
                if (inline) {
                  return (
                    <code
                      className={className}
                      {...props}
                      style={{
                        background: "rgba(100, 100, 255, 0.1)",
                        padding: "0.2em 0.4em",
                        borderRadius: "3px",
                        fontSize: "0.9em",
                      }}
                    >
                      {children}
                    </code>
                  );
                }

                // For code blocks
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");

                if (match) {
                  // Code block with language - add copy button
                  return (
                    <div
                      className="code-block-wrapper"
                      style={{ position: "relative", marginBottom: "1em" }}
                    >
                      <div
                        className="code-block-header"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "rgba(0, 0, 0, 0.3)",
                          padding: "0.5em 1em",
                          borderRadius: "6px 6px 0 0",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <span
                          className="code-language"
                          style={{
                            color: "rgba(255, 255, 255, 0.7)",
                            fontSize: "0.85em",
                            fontWeight: "500",
                          }}
                        >
                          {match[1]}
                        </span>
                        <button
                          className="code-copy-btn"
                          onClick={() =>
                            navigator.clipboard.writeText(codeString)
                          }
                          style={{
                            background: "rgba(100, 100, 255, 0.2)",
                            border: "1px solid rgba(100, 100, 255, 0.4)",
                            color: "#fff",
                            padding: "0.25em 0.75em",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.85em",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "rgba(100, 100, 255, 0.3)";
                            e.currentTarget.style.transform =
                              "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                              "rgba(100, 100, 255, 0.2)";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{ marginTop: 0 }}>
                        <SyntaxHighlighter
                          style={vscDarkPlus as any}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: "0 0 6px 6px",
                            fontSize: `${fontSize}px`,
                            fontFamily: fontFamily,
                          }}
                          codeTagProps={{
                            style: { fontSize: `${fontSize}px`, fontFamily: fontFamily },
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  );
                } else {
                  // Code block without language: render using SyntaxHighlighter without a <pre>
                  return (
                    <div
                      style={{ position: "relative", marginBottom: "1em" }}
                    >
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={undefined as any}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: "6px",
                          fontSize: `${fontSize}px`,
                          fontFamily: fontFamily,
                          background: "rgba(0,0,0,0.3)",
                          padding: "1em",
                        }}
                        codeTagProps={{
                          style: { fontSize: `${fontSize}px`, fontFamily: fontFamily },
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }
              },
              // Render paragraphs as divs to avoid invalid nesting when custom block content appears
              p: ({ children }) => (
                <div
                  style={{
                    color: "#e0e0e0",
                    lineHeight: "1.6",
                    marginBottom: "1em",
                  }}
                >
                  {children}
                </div>
              ),
              // Style other markdown elements with proper colors
              h1: ({ children }) => (
                <h1
                  style={{
                    color: "#ffc857",
                    fontSize: "2em",
                    fontWeight: 600,
                    borderBottom: "2px solid rgba(255, 200, 87, 0.3)",
                    paddingBottom: "0.5em",
                    marginTop: "1.5em",
                    marginBottom: "1em",
                  }}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  style={{
                    color: "#ffc857",
                    fontSize: "1.5em",
                    fontWeight: 600,
                    borderBottom: "1px solid rgba(255, 200, 87, 0.2)",
                    paddingBottom: "0.3em",
                    marginTop: "1.2em",
                    marginBottom: "0.8em",
                  }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  style={{
                    color: "#ffc857",
                    fontSize: "1.25em",
                    fontWeight: 600,
                    marginTop: "1em",
                    marginBottom: "0.6em",
                  }}
                >
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4
                  style={{
                    color: "#ffc857",
                    fontSize: "1.1em",
                    fontWeight: 600,
                    marginTop: "0.8em",
                    marginBottom: "0.5em",
                  }}
                >
                  {children}
                </h4>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#64b5f6",
                    textDecoration: "none",
                    borderBottom: "1px solid transparent",
                    transition: "border-color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderBottomColor = "#64b5f6")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderBottomColor = "transparent")
                  }
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote
                  style={{
                    borderLeft: "4px solid #ffc857",
                    paddingLeft: "1em",
                    marginLeft: 0,
                    marginBottom: "1em",
                    color: "rgba(255, 255, 255, 0.8)",
                    fontStyle: "italic",
                  }}
                >
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul
                  style={{
                    paddingLeft: "2em",
                    marginBottom: "1em",
                    color: "#e0e0e0",
                  }}
                >
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol
                  style={{
                    paddingLeft: "2em",
                    marginBottom: "1em",
                    color: "#e0e0e0",
                  }}
                >
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li
                  style={{
                    marginBottom: "0.5em",
                    lineHeight: "1.6",
                  }}
                >
                  {children}
                </li>
              ),
              hr: () => (
                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid rgba(255, 200, 87, 0.2)",
                    margin: "2em 0",
                  }}
                />
              ),
              strong: ({ children }) => (
                <strong
                  style={{
                    color: "#ffc857",
                    fontWeight: 600,
                  }}
                >
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em
                  style={{
                    color: "#ffeb3b",
                    fontStyle: "italic",
                  }}
                >
                  {children}
                </em>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    if (type === "code" || type === "json") {
      // Syntax highlighted code
      return (
        <div className="file-viewer-code" style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily }}>
          <SyntaxHighlighter
            language={language || "text"}
            style={vscDarkPlus}
            showLineNumbers
            wrapLines={wrapLines}
            lineProps={{
              style: { wordBreak: "break-all", whiteSpace: "pre-wrap" },
            }}
            customStyle={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily,
              background: "transparent",
            }}
            codeTagProps={{ style: { fontSize: `${fontSize}px`, fontFamily: fontFamily } }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      );
    }

    return null;
  };

  const memoContent = React.useMemo(
    () => renderContent(),
    [
      type,
      showRaw,
      content,
      fontSize,
      wrapLines,
      language,
      isEditing,
      editContent,
    ],
  );

  const saveFile = async () => {
    try {
      const res = await fetch("/api/files/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: editContent }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to save ${filePath}`);
      }
      setContent(editContent);
      setIsEditing(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      try {
        alert(`Save failed: ${err.message || err}`);
      } catch {}
    }
  };

  // Render maximized viewer with animated background ONLY in fullscreen mode
  if (isMaximized && isFullscreenMode) {
    const headerHeight = 60;
    const margin = 20;

    return createPortal(
      <div
        className="file-viewer-maximized-overlay"
        style={{
          position: "fixed",
          top: headerHeight, // Start below header
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999, // Below header (10000) but above canvas
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Animated background - use global theme if backgroundType not provided */}
        <AnimatedBackground
          type={resolveAnimatedBackgroundType(
            backgroundType,
            globalBackgroundTheme,
          )}
        />

        <div
          className="file-viewer-container fullscreen"
          style={{
            ...containerStyle,
            position: "relative",
            maxWidth: "1400px",
            width: "90%",
            maxHeight: `calc(100vh - ${headerHeight + margin * 2}px)`,
            height: "80vh",
            zIndex: 1,
          }}
        >
          <div className="file-viewer-header" style={headerStyle}>
            <div className="file-viewer-info">
              <span className="file-icon">
                {type === "markdown" ? "📝" : type === "code" ? "💻" : "📄"}
              </span>
              <span className="file-name">{title}</span>
              <span className="file-path">{filePath}</span>
            </div>
            <div className="file-viewer-controls">
              <button
                className="viewer-control-btn lock-btn"
                onClick={handleLockToggle}
                title={isLocked ? "Unlock from viewport" : "Lock to viewport"}
              >
                {isLocked ? "🔒" : "🔓"}
              </button>
              <button
                ref={customizerButtonRef}
                className="viewer-control-btn"
                onClick={() => setShowCustomizer(!showCustomizer)}
                title="Customize appearance"
              >
                🎨
              </button>
              {showCustomizer && (
                <FileViewerCustomizer
                  isOpen={showCustomizer}
                  onClose={() => setShowCustomizer(false)}
                  currentOpacity={fileOpacity}
                  onOpacityChange={(opacity) => {
                    setFileOpacity(opacity);
                    updateCard(id, { transparency: opacity } as any);
                  }}
                  currentTheme={selectedThemeId}
                  onThemeChange={(theme) => {
                    setSelectedThemeId(theme.id);
                    updateCard(id, { themeId: theme.id });
                  }}
                  currentFontFamily={fontFamily}
                  onFontFamilyChange={(newFont) => {
                    setFontFamilyOverridden(true);
                    setFontFamily(newFont);
                    updateCard(id, { fontFamily: newFont });
                  }}
                  buttonRef={customizerButtonRef}
                />
              )}
              {(type === "markdown" || type === "code") && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setShowRaw(!showRaw)}
                  title={showRaw ? "Show formatted" : "Show raw"}
                >
                  {showRaw ? "📝" : "📄"}
                </button>
              )}
              {type !== "image" && !isEditing && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setIsEditing(true)}
                  title="Edit file"
                >
                  ✏️
                </button>
              )}
              {type !== "image" && isEditing && (
                <>
                  <button
                    className="viewer-control-btn"
                    onClick={saveFile}
                    title="Save file"
                  >
                    ✓
                  </button>
                  <button
                    className="viewer-control-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(content);
                    }}
                    title="Cancel edit"
                  >
                    ✕
                  </button>
                </>
              )}
              <button
                className="viewer-control-btn"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                title="Decrease font size"
              >
                A-
              </button>
              <span className="font-size-display">{fontSize}px</span>
              <button
                className="viewer-control-btn"
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                title="Increase font size"
              >
                A+
              </button>
              {type === "code" && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setWrapLines(!wrapLines)}
                  title={wrapLines ? "Disable line wrap" : "Enable line wrap"}
                >
                  ↩️
                </button>
              )}
              <button
                className="viewer-control-btn"
                onClick={handleCopyContent}
                title="Copy content"
              >
                📋
              </button>
              <button
                className="viewer-control-btn"
                onClick={handleRefresh}
                title="Refresh from disk"
              >
                🔄
              </button>
              <button
                className="viewer-control-btn"
                onClick={toggleMaximize}
                title="Exit fullscreen"
              >
                ◱
              </button>
              <button
                className="viewer-control-btn close-btn"
                onClick={() => {
                  toggleMaximize();
                  onClose(id);
                }}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="file-viewer-content"
            style={{
              pointerEvents: isDragging ? 'none' : 'auto', // Prevent content from interfering with drag
              cursor: "auto",
              userSelect: "text",
            }}
            onWheel={(e) => {
              // Check if this file viewer is selected
              const viewerIsSelected = isSelected(id);

              // If not selected, let canvas handle ALL wheel events (for zooming)
              if (!viewerIsSelected) {
                return;
              }

              // Only handle scrolling if selected
              const target = e.currentTarget as HTMLElement;
              const hasVerticalScroll = target.scrollHeight > target.clientHeight;
              const isAtTop = target.scrollTop === 0;
              const isAtBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
              const isScrollingUp = e.deltaY < 0;

              // Allow zoom if content isn't scrollable or at boundaries
              if (!hasVerticalScroll || (isAtTop && isScrollingUp) || (isAtBottom && !isScrollingUp)) {
                return; // Let canvas zoom
              }

              // Only stop propagation when actually scrolling content
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              // Check if this file viewer is selected
              const viewerIsSelected = isSelected(id);

              // If not selected, let canvas handle mouse events (for panning/zooming)
              if (!viewerIsSelected) {
                return;
              }

              // Only stop propagation if selected and not clicking on scrollbar
              const target = e.target as HTMLElement;
              const isScrollbar =
                e.clientX >
                target.clientWidth + target.getBoundingClientRect().left;
              if (!isScrollbar) {
                e.stopPropagation();
              }
            }}
          >
            {memoContent}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Render placeholder on canvas when locked
  const placeholder = renderPlaceholder();

  // Render locked viewer with portal
  if (isLocked) {
    return (
      <>
        {placeholder}
        {createPortal(
      <div
        ref={nodeRef}
        className={`file-viewer-wrapper locked ${isDragging ? "dragging" : ""}`}
        style={{
          position: "fixed",
          left: `${viewportPosition.x}px`,
          top: `${viewportPosition.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 9998, // Below sidebar (99999) and other UI elements
          transform: `scale(${lockedZoom})`,
          transformOrigin: 'top left',
        }}
        onMouseDown={() => onFocus(id)}
      >
        <div
          className="file-viewer-container"
          style={{ width: "100%", height: "100%", ...containerStyle }}
        >
          <div className="file-viewer-header" style={headerStyle}>
            <div className="file-viewer-info">
              <span className="file-icon">
                {type === "markdown" ? "📝" : type === "code" ? "💻" : "📄"}
              </span>
              <span className="file-name">{title}</span>
            </div>
            <div className="file-viewer-controls">
              <button
                className="viewer-control-btn lock-btn"
                onClick={handleLockToggle}
                title={isLocked ? "Unlock from viewport" : "Lock to viewport"}
              >
                {isLocked ? "🔒" : "🔓"}
              </button>
              <button
                ref={customizerButtonRef}
                className="viewer-control-btn"
                onClick={() => setShowCustomizer(!showCustomizer)}
                title="Customize appearance"
              >
                🎨
              </button>
              {showCustomizer && (
                <FileViewerCustomizer
                  isOpen={showCustomizer}
                  onClose={() => setShowCustomizer(false)}
                  currentOpacity={fileOpacity}
                  onOpacityChange={(opacity) => {
                    setFileOpacity(opacity);
                    updateCard(id, { transparency: opacity } as any);
                  }}
                  currentTheme={selectedThemeId}
                  onThemeChange={(theme) => {
                    setSelectedThemeId(theme.id);
                    updateCard(id, { themeId: theme.id });
                  }}
                  currentFontFamily={fontFamily}
                  onFontFamilyChange={(newFont) => {
                    setFontFamilyOverridden(true);
                    setFontFamily(newFont);
                    updateCard(id, { fontFamily: newFont });
                  }}
                  buttonRef={customizerButtonRef}
                />
              )}
              {(type === "markdown" || type === "code") && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setShowRaw(!showRaw)}
                  title={showRaw ? "Show formatted" : "Show raw"}
                >
                  {showRaw ? "📝" : "📄"}
                </button>
              )}
              {type !== "image" && !isEditing && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setIsEditing(true)}
                  title="Edit file"
                >
                  ✏️
                </button>
              )}
              {type !== "image" && isEditing && (
                <>
                  <button
                    className="viewer-control-btn"
                    onClick={saveFile}
                    title="Save file"
                  >
                    ✓
                  </button>
                  <button
                    className="viewer-control-btn"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(content);
                    }}
                    title="Cancel edit"
                  >
                    ✕
                  </button>
                </>
              )}
              <button
                className="viewer-control-btn"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                title="Decrease font size"
              >
                -
              </button>
              <span className="font-size-display">{fontSize}</span>
              <button
                className="viewer-control-btn"
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                title="Increase font size"
              >
                +
              </button>
              {type === "code" && (
                <button
                  className="viewer-control-btn"
                  onClick={() => setWrapLines(!wrapLines)}
                  title={wrapLines ? "No wrap" : "Wrap"}
                >
                  ↩️
                </button>
              )}
              <button
                className="viewer-control-btn"
                onClick={handleCopyContent}
                title="Copy"
              >
                📋
              </button>
              <button
                className="viewer-control-btn"
                onClick={toggleMaximize}
                title="Maximize"
              >
                ◰
              </button>
              <button
                className="viewer-control-btn close-btn"
                onClick={() => onClose(id)}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="file-viewer-content"
            style={{
              pointerEvents: isDragging ? 'none' : 'auto', // Prevent content from interfering with drag
              fontSize: `${fontSize}px`,
              cursor: "auto",
              userSelect: "text",
            }}
            onWheel={(e) => {
              // Check if this file viewer is selected
              const viewerIsSelected = isSelected(id);

              // If not selected, let canvas handle ALL wheel events (for zooming)
              if (!viewerIsSelected) {
                return;
              }

              // Only handle scrolling if selected
              const target = e.currentTarget as HTMLElement;
              const hasVerticalScroll = target.scrollHeight > target.clientHeight;
              const isAtTop = target.scrollTop === 0;
              const isAtBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
              const isScrollingUp = e.deltaY < 0;

              // Allow zoom if content isn't scrollable or at boundaries
              if (!hasVerticalScroll || (isAtTop && isScrollingUp) || (isAtBottom && !isScrollingUp)) {
                return; // Let canvas zoom
              }

              // Only stop propagation when actually scrolling content
              e.stopPropagation();
            }}
          >
            {memoContent}
          </div>
        </div>
      </div>,
      document.body
        )}
      </>
    );
  }

  // Regular draggable viewer
  return (
    <Draggable
      key={dragKey}
      nodeRef={nodeRef}
      defaultPosition={position}
      onStart={() => setIsDragging(true)}
      onStop={(e, data) => handleStop(e as any, data as any)}
      handle=".draggable-header"
      bounds={{left: 0, top: 0, right: 10000, bottom: 10000}} // World bounds match MINIMAP_WORLD
      disabled={isResizing || isMaximized}
      scale={canvasZoom}
    >
      <div
        ref={nodeRef}
        className={`file-viewer-wrapper ${isDragging ? "dragging" : ""}`}
        data-card-id={id}
        style={{
          position: "absolute",
          zIndex,
          outline: selected ? '2px solid #3b82f6' : 'none',
          outlineOffset: '2px',
        }}
        onClick={(e) => {
          handleSelectClick(e);
          onFocus(id);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ResizableBox
          width={size.width}
          height={size.height}
          onResizeStart={(e) => handleResizeStart(e as any)}
          onResize={(e) => handleResize(e as any)}
          onResizeStop={handleResizeStop}
          minConstraints={[300, 200]}
          maxConstraints={[window.innerWidth - 50, window.innerHeight - 50]}
          resizeHandles={["se"]}
          className="resizable-file-viewer"
        >
          <div className="file-viewer-container" style={{...containerStyle, position: 'relative'}}>
            {/* Mini header - always visible for dragging */}
            {!isHovered && (
              <div className="file-viewer-mini-header draggable-header" style={headerStyle}>
                <span className="file-icon">
                  {type === "markdown" ? "📝" : type === "code" ? "💻" : "📄"}
                </span>
                <span className="file-name">
                  {filePath ? (
                    // Show only last 2 directory levels + filename
                    filePath.split('/').slice(-3).join('/').replace(/^\//, '')
                  ) : title}
                </span>
              </div>
            )}

            {/* Full header - visible on hover */}
            {isHovered && (
              <div className="file-viewer-header draggable-header" style={{
                ...headerStyle,
                animation: 'slideDown 0.2s ease-out',
              }}>
                <div className="file-viewer-info">
                <span className="file-name">{title}</span>
              </div>
              <div className="file-viewer-controls">
                <button
                  className="viewer-control-btn"
                  onClick={handleLockToggle}
                  title={isLocked ? "Unlock from viewport" : "Lock to viewport"}
                >
                  {isLocked ? "🔒" : "🔓"}
                </button>
                <button
                  ref={customizerButtonRef}
                  className="viewer-control-btn"
                  onClick={() => setShowCustomizer(!showCustomizer)}
                  title="Customize appearance"
                >
                  🎨
                </button>
                {showCustomizer && (
                  <FileViewerCustomizer
                    isOpen={showCustomizer}
                    onClose={() => setShowCustomizer(false)}
                    currentOpacity={fileOpacity}
                    onOpacityChange={(opacity) => {
                      setFileOpacity(opacity);
                      updateCard(id, { transparency: opacity });
                    }}
                    currentTheme={selectedThemeId}
                    onThemeChange={(theme) => {
                      setSelectedThemeId(theme.id);
                      updateCard(id, { themeId: theme.id });
                    }}
                    currentFontFamily={fontFamily}
                    onFontFamilyChange={(newFont) => {
                      setFontFamilyOverridden(true);
                      setFontFamily(newFont);
                      updateCard(id, { fontFamily: newFont });
                    }}
                    buttonRef={customizerButtonRef}
                  />
                )}
                {(type === "markdown" || type === "code") && (
                  <button
                    className="viewer-control-btn"
                    onClick={() => setShowRaw(!showRaw)}
                    title={showRaw ? "Show formatted" : "Show raw"}
                  >
                    {showRaw ? "📝" : "📄"}
                  </button>
                )}
                {type !== "image" && !isEditing && (
                  <button
                    className="viewer-control-btn"
                    onClick={() => setIsEditing(true)}
                    title="Edit file"
                  >
                    ✏️
                  </button>
                )}
                {type !== "image" && isEditing && (
                  <>
                    <button
                      className="viewer-control-btn"
                      onClick={saveFile}
                      title="Save file"
                    >
                      ✓
                    </button>
                    <button
                      className="viewer-control-btn"
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(content);
                      }}
                      title="Cancel edit"
                    >
                      ✕
                    </button>
                  </>
                )}
                <button
                  className="viewer-control-btn"
                  onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                  title="Decrease font size"
                >
                  -
                </button>
                <span className="font-size-display">{fontSize}</span>
                <button
                  className="viewer-control-btn"
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  title="Increase font size"
                >
                  +
                </button>
                {type === "code" && (
                  <button
                    className="viewer-control-btn"
                    onClick={() => setWrapLines(!wrapLines)}
                    title={wrapLines ? "No wrap" : "Wrap"}
                  >
                    ↩️
                  </button>
                )}
                <button
                  className="viewer-control-btn"
                  onClick={handleCopyContent}
                  title="Copy"
                >
                  📋
                </button>
                <button
                  className="viewer-control-btn"
                  onClick={toggleMaximize}
                  title="Maximize"
                >
                  ◰
                </button>
                <button
                  className="viewer-control-btn close-btn"
                  onClick={() => onClose(id)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            )}
            <div
              className="file-viewer-content"
              onWheel={(e) => {
                // Check if this file viewer is selected
                const viewerIsSelected = isSelected(id);

                // If not selected, let canvas handle ALL wheel events (for zooming)
                if (!viewerIsSelected) {
                  return;
                }

                // Only handle scrolling if selected
                const target = e.currentTarget as HTMLElement;
                const hasVerticalScroll = target.scrollHeight > target.clientHeight;
                const isAtTop = target.scrollTop === 0;
                const isAtBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
                const isScrollingUp = e.deltaY < 0;

                // Allow zoom if content isn't scrollable or at boundaries
                if (!hasVerticalScroll || (isAtTop && isScrollingUp) || (isAtBottom && !isScrollingUp)) {
                  return; // Let canvas zoom
                }

                // Only stop propagation when actually scrolling content
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Check if this file viewer is selected
                const viewerIsSelected = isSelected(id);

                // If not selected, let canvas handle mouse events (for panning/zooming)
                if (!viewerIsSelected) {
                  return;
                }

                // Only stop propagation if selected and not clicking on scrollbar
                const target = e.target as HTMLElement;
                const isScrollbar =
                  e.clientX >
                  target.clientWidth + target.getBoundingClientRect().left;
                if (!isScrollbar) {
                  e.stopPropagation();
                }
              }}
              style={{
                cursor: "auto",
                userSelect: "text",
              }}
            >
              {memoContent}
            </div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
});
