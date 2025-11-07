import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCanvasStore } from "../stores/canvasStore";
import { ensureVisiblePosition, calculateSafeSpawnPosition } from "../utils/positionUtils";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { useLockableComponent } from "../hooks/useLockableComponent";
import "./DraggableCard.css";

interface DraggableCardProps {
  id: string;
  title: string;
  content: string;
  backContent?: string;
  variant?:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "purple"
    | "glow"
    | "prompt";
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onClose?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<CardData>) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  editable?: boolean;
  isMarkdown?: boolean;
  canvasZoom?: number;
  canvasOffset?: { x: number; y: number };
}

export interface CardData {
  id: string;
  title: string;
  content: string;
  backContent?: string;
  variant:
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "purple"
    | "glow"
    | "prompt";
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  editable?: boolean;
  isMarkdown?: boolean; // Flag to indicate if this should be rendered as markdown
  category?: string; // Category for note cards
}

// Get file icon based on file extension
const getFileIcon = (filePath: string): { icon: string; color: string } => {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  const iconMap: { [key: string]: { icon: string; color: string } } = {
    // Code files
    js: { icon: "📜", color: "#f7df1e" },
    jsx: { icon: "⚛️", color: "#61dafb" },
    ts: { icon: "📘", color: "#3178c6" },
    tsx: { icon: "⚛️", color: "#3178c6" },
    py: { icon: "🐍", color: "#3776ab" },
    java: { icon: "☕", color: "#007396" },
    cpp: { icon: "🔧", color: "#00599c" },
    c: { icon: "🔨", color: "#a8b9cc" },
    rs: { icon: "🦀", color: "#dea584" },
    go: { icon: "🐹", color: "#00add8" },
    html: { icon: "🌐", color: "#e34c26" },
    css: { icon: "🎨", color: "#1572b6" },
    scss: { icon: "🎨", color: "#cc6699" },

    // Documents
    md: { icon: "📝", color: "#083fa1" },
    txt: { icon: "📄", color: "#666666" },
    pdf: { icon: "📕", color: "#ff0000" },
    doc: { icon: "📘", color: "#2b579a" },
    docx: { icon: "📘", color: "#2b579a" },

    // Config files
    json: { icon: "⚙️", color: "#292929" },
    yaml: { icon: "📋", color: "#cb171e" },
    yml: { icon: "📋", color: "#cb171e" },
    toml: { icon: "🔧", color: "#9c4121" },
    xml: { icon: "📑", color: "#0060ac" },
    ini: { icon: "🧩", color: "#10b981" },
    conf: { icon: "🧩", color: "#0ea5e9" },

    // Images
    png: { icon: "🖼️", color: "#00add8" },
    jpg: { icon: "📷", color: "#ff9900" },
    jpeg: { icon: "📷", color: "#ff9900" },
    gif: { icon: "🎬", color: "#00ff00" },
    svg: { icon: "🎨", color: "#ffb13b" },

    // Archives
    zip: { icon: "📦", color: "#ffd700" },
    tar: { icon: "📦", color: "#666666" },
    gz: { icon: "🗜️", color: "#4682b4" },

    // Shell
    sh: { icon: "🐚", color: "#4eaa25" },
    bash: { icon: "🐚", color: "#4eaa25" },

    // Others
    gitignore: { icon: "🚫", color: "#f14e32" },
    dockerfile: { icon: "🐋", color: "#2496ed" },
    env: { icon: "🔐", color: "#ecd53f" },
  };

  return iconMap[ext] || { icon: "📄", color: "#e5e7eb" };
};

const DraggableCard: React.FC<DraggableCardProps> = ({
  id,
  title,
  content,
  backContent,
  variant = "default",
  initialPosition,
  initialSize = { width: 350, height: 450 },
  onClose,
  onUpdate,
  zIndex,
  onFocus,
  editable = false,
  isMarkdown = false,
  canvasZoom = 1,
  canvasOffset,
}) => {
  // Zustand store integration - get viewport first
  const { updateCard, addCard, cards, viewport, cardCategories, selectItem, isSelected } = useCanvasStore();

  // Ensure position is visible in viewport
  const safeInitialPosition = useMemo(() => {
    let result;
    if (initialPosition) {
      // Respect stored position but clamp to world bounds
      const PADDING = 100;
      const WORLD_MIN = 0;
      const WORLD_MAX = 10000;
      result = {
        x: Math.max(WORLD_MIN + PADDING, Math.min(initialPosition.x, WORLD_MAX - PADDING - initialSize.width)),
        y: Math.max(WORLD_MIN + PADDING, Math.min(initialPosition.y, WORLD_MAX - PADDING - initialSize.height)),
      };
    } else {
      // Prefer a spawn position centered in the current viewport, clamped to world bounds
      result = calculateSafeSpawnPosition(
        initialSize,
        canvasOffset ? { x: canvasOffset.x, y: canvasOffset.y } : { x: viewport.x, y: viewport.y },
        canvasZoom,
        []
      );
    }
    // Debug logs removed
    return result;
    // IMPORTANT: Only depend on initialPosition and size to prevent flickering
    // When zoom/offset changes, we don't want to recalculate card positions!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, initialSize]);

  const [position, setPosition] = useState(safeInitialPosition);
  const [size, setSize] = useState(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(editable);
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content);
  const [editBackContent, setEditBackContent] = useState(backContent || "");
  const [editVariant, setEditVariant] = useState(variant);
  const selected = isSelected(id);

  // Icon view removed - cards always show at all zoom levels
  const showIconView = false;
  const isFileCard = backContent?.startsWith("/") || title.includes("."); // Check if it's a file path
  const fileIcon = isFileCard ? getFileIcon(backContent || title) : null;

  // Get the current category color
  const currentVariant = isEditing ? editVariant : variant;
  const currentCategory = cardCategories.find(cat => cat.variant === currentVariant);
  const categoryColor = currentCategory?.color || '#6b7280';

  const cardRef = useRef<HTMLDivElement>(null);

  // Get current card from store for lock state initialization
  const currentCard = cards.get(id);

  // Use the lockable component hook
  const { isLocked, lockedZoom, viewportPosition, handleLockToggle, renderPlaceholder } = useLockableComponent({
    id,
    nodeRef: cardRef,
    initialLocked: currentCard?.isLocked || false,
    initialLockedZoom: currentCard?.lockedZoom || 1,
    initialViewportPosition: currentCard?.viewportPosition || { x: safeInitialPosition.x, y: safeInitialPosition.y },
    initialCanvasPosition: currentCard?.position || position,  // Use stored position for locked placeholder
    initialSize: currentCard?.size || size,
    currentPosition: position,  // Pass current position for accurate placeholder
    currentSize: size,          // Pass current size for accurate placeholder
    canvasZoom: canvasZoom || 1,
    canvasOffset,
    onLockChange: (locked) => {
      // Update card in store when lock state changes
      updateCard(id, { isLocked: locked });
    },
    updateStore: updateCard,
    // Placeholder configuration
    placeholderVariant: 'card',
    placeholderName: title,
  });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartCardPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to insert markdown formatting
  const handleInsertFormatting = useCallback((before: string, after?: string, defaultText?: string) => {
    const textarea = isFlipped ? backTextareaRef.current : textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = isFlipped ? editBackContent : editContent;
    const selectedText = currentValue.substring(start, end) || defaultText || '';

    const newValue =
      currentValue.substring(0, start) +
      before +
      selectedText +
      (after || '') +
      currentValue.substring(end);

    if (isFlipped) {
      setEditBackContent(newValue);
    } else {
      setEditContent(newValue);
    }

    // Set cursor position after insertion
    setTimeout(() => {
      if (textarea) {
        const newPosition = start + before.length + selectedText.length;
        textarea.focus();
        textarea.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  }, [isFlipped, editBackContent, editContent]);

  // Initialize card in store on mount and sync lock state
  useEffect(() => {
    const existingCard = cards.get(id);
    if (!existingCard) {
      addCard({
        id,
        title,
        content,
        backContent, // Include backContent for proper persistence
        variant,
        position,
        size,
        editable,
      });
    } else {
      // Sync state from store
      if (existingCard.variant) {
        setEditVariant(existingCard.variant);
      }
      // Lock state is now managed by useLockableComponent hook
    }
  }, []);

  const handleMouseDownDrag = useCallback(
    (e: React.MouseEvent) => {
      // Don't start dragging when interacting with header controls
      const target = e.target as HTMLElement;
      if (
        target.closest(".card-controls") ||
        target.tagName === "BUTTON" ||
        target.tagName === "SELECT" ||
        target.tagName === "OPTION" ||
        target.closest(".card-header-dropdown")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onFocus(id);
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartCardPos.current = { ...position };
    },
    [position, onFocus, id],
  );

  // Click-to-select handler
  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas deselect
    if (e.shiftKey) {
      selectItem(id, true); // Multi-select
    } else {
      selectItem(id, false); // Single select
    }
  }, [id, selectItem]);

  // Lock toggle is now provided by useLockableComponent hook

  const handleMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      // Don't resize when locked
      if (isLocked) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onFocus(id);
      setIsResizing(true);
      resizeStartPos.current = { x: e.clientX, y: e.clientY };
      resizeStartSize.current = { ...size };
    },
    [size, onFocus, id, isLocked],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Apply zoom scaling to mouse deltas for correct dragging at all zoom levels
        const deltaX = (e.clientX - dragStartPos.current.x) / canvasZoom;
        const deltaY = (e.clientY - dragStartPos.current.y) / canvasZoom;
        // Clamp position to canvas bounds (0, 0) to (10000 - size, 10000 - size)
        const WORLD_MAX = 10000;
        const newX = Math.max(0, Math.min(WORLD_MAX - size.width, dragStartCardPos.current.x + deltaX));
        const newY = Math.max(0, Math.min(WORLD_MAX - size.height, dragStartCardPos.current.y + deltaY));
        setPosition({ x: newX, y: newY });
      } else if (isResizing) {
        // Apply zoom scaling to resize deltas as well
        const deltaX = (e.clientX - resizeStartPos.current.x) / canvasZoom;
        const deltaY = (e.clientY - resizeStartPos.current.y) / canvasZoom;
        const newWidth = Math.max(250, resizeStartSize.current.width + deltaX);
        const newHeight = Math.max(
          300,
          resizeStartSize.current.height + deltaY,
        );
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Update Zustand store and call onUpdate only after drag ends
        updateCard(id, { position, size });
        if (onUpdate) {
          onUpdate(id, { position, size });
        }
      } else if (isResizing) {
        setIsResizing(false);
        // Update Zustand store and call onUpdate only after resize ends
        updateCard(id, { position, size });
        if (onUpdate) {
          onUpdate(id, { position, size });
        }
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDragging,
    isResizing,
    position,
    size,
    id,
    onUpdate,
    canvasZoom,
  ]);


  const handleFlip = () => {
    if (backContent || editBackContent) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleEdit = () => {
    if (editable) {
      if (!isEditing) {
        // Entering edit mode - no changes needed
        setIsEditing(true);
      } else {
        // Saving - update the data
        if (onUpdate) {
          onUpdate(id, {
            title: editTitle,
            content: editContent,
            backContent: editBackContent,
            variant: editVariant,
          });
        }
        // Update Zustand store
        updateCard(id, {
          title: editTitle,
          content: editContent,
          variant: editVariant,
        });
        setIsEditing(false);
      }
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setEditTitle(title);
    setEditContent(content);
    setEditBackContent(backContent || "");
    setEditVariant(variant);
    setIsEditing(false);
  };

  const handleAction = (action: string) => {
    switch (action) {
      case "copy":
        navigator.clipboard.writeText(
          isFlipped ? editBackContent || backContent || "" : editContent,
        );
        break;
      case "edit":
        handleEdit();
        break;
      default:
    }
  };

  // Render placeholder on canvas when locked
  const placeholder = renderPlaceholder();

  // Render locked card in a portal with fixed positioning
  if (isLocked) {
    return (
      <>
        {placeholder}
        {createPortal(
      <div
        ref={cardRef}
        className={`draggable-card-container locked`}
        data-variant={variant}
        data-card-id={id}
        onClick={handleSelectClick}
        style={{
          position: "fixed",
          left: viewportPosition.x,
          top: viewportPosition.y,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 100000,
          outline: selected ? '2px solid #3b82f6' : 'none',
          outlineOffset: '2px',
          transform: `scale(${lockedZoom})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="card-header">
          <div className="card-header-content">
            <span
              className="card-variant-indicator"
              data-variant={variant}
              style={{
                background: categoryColor.includes('gradient') ? categoryColor : undefined,
                backgroundColor: !categoryColor.includes('gradient') ? categoryColor : undefined,
              }}
            ></span>
            <span className="card-title-text">{editTitle}</span>
          </div>
          <div className="card-controls">
            <button
              className="card-control-btn lock-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleLockToggle();
              }}
              title="Unlock and return to canvas"
              style={{
                opacity: 1,
                border: "1px solid white",
                borderRadius: "4px",
              }}
            >
              🔒
            </button>
            {editable && !isEditing && (
              <button
                className="card-control-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                title="Edit"
              >
                ✏️
              </button>
            )}
            {editable && isEditing && (
              <>
                <button
                  className="card-control-btn save-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit();
                  }}
                  title="Save"
                >
                  ✓
                </button>
                <button
                  className="card-control-btn cancel-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                  title="Cancel"
                >
                  ✕
                </button>
              </>
            )}
            {(backContent || editBackContent) && (
              <button
                className="card-control-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFlip();
                }}
                title="Flip Card"
              >
                🔄
              </button>
            )}
            {!isEditing && onClose && (
              <button
                className="card-control-btn close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(id);
                }}
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className={`card-wrapper ${isEditing ? editVariant : variant}`}>
          <div className={`card ${isFlipped ? "flipped" : ""}`}>
            <div className="card-front">
              <div
                className="card-content"
                onWheel={(e) => {
                  // Only stop propagation if card is selected
                  const cardIsSelected = isSelected(id);
                  if (!cardIsSelected) return;
                  e.stopPropagation();
                }}
              >
                {isEditing ? (
                  <div className="card-edit-container">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="card-title-edit"
                      placeholder="Card title..."
                    />
                    {isMarkdown && (
                      <MarkdownToolbar
                        onInsert={handleInsertFormatting}
                        textareaRef={textareaRef}
                      />
                    )}
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="card-content-textarea"
                      placeholder="Enter card content..."
                    />
                  </div>
                ) : (
                  <div className="card-display-container">
                    <h3 className="card-content-title">{editTitle}</h3>
                    <div className="card-content-display">{editContent}</div>
                  </div>
                )}
              </div>
              <div className="card-actions">
                <button
                  className="action-button"
                  onClick={() => handleAction("like")}
                  title="Like"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
                <button
                  className="action-button"
                  onClick={() => handleAction("copy")}
                  title="Copy"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <button
                  className="action-button"
                  onClick={() => handleAction("share")}
                  title="Share"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </button>
              </div>
            </div>
            {(backContent || editBackContent) && (
              <div className="card-back">
                <div
                  className="card-content"
                  onWheel={(e) => {
                  // Only stop propagation if card is selected
                  const cardIsSelected = isSelected(id);
                  if (!cardIsSelected) return;
                  e.stopPropagation();
                }}
                >
                  {isEditing ? (
                    <div className="card-edit-container">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="card-title-edit"
                        placeholder="Card title..."
                        disabled
                      />
                      {isMarkdown && (
                        <MarkdownToolbar
                          onInsert={handleInsertFormatting}
                          textareaRef={backTextareaRef}
                        />
                      )}
                      <textarea
                        ref={backTextareaRef}
                        value={editBackContent}
                        onChange={(e) => setEditBackContent(e.target.value)}
                        className="card-content-textarea"
                        placeholder="Enter back content..."
                      />
                    </div>
                  ) : (
                    <div className="card-display-container">
                      <h3 className="card-content-title">{editTitle}</h3>
                      <div className="card-content-display">
                        {editBackContent || backContent}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
        )}
      </>
    );
  }

// Regular draggable card
  return (
    <div
      ref={cardRef}
      className={`draggable-card-container ${isDragging ? "dragging" : ""}`}
      data-variant={variant}
      data-card-id={id}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
        outline: selected ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
      onClick={(e) => {
        handleSelectClick(e);
        onFocus(id);
      }}
    >
      <div
        className="card-header"
        onMouseDown={handleMouseDownDrag}
        style={isDragging ? { backdropFilter: "none" } : undefined}
      >
        <div className="card-header-content">
          <span
            className="card-variant-indicator"
            data-variant={isEditing ? editVariant : variant}
            style={{
              background: categoryColor.includes('gradient') ? categoryColor : undefined,
              backgroundColor: !categoryColor.includes('gradient') ? categoryColor : undefined,
            }}
          ></span>
          {isEditing ? (
            <select
              value={editVariant}
              onChange={(e) => setEditVariant(e.target.value as any)}
              className="card-header-dropdown"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '13px',
                cursor: 'pointer',
                minWidth: '100px',
              }}
            >
              {cardCategories.map((cat) => (
                <option key={cat.id} value={cat.variant}>
                  {cat.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="card-title-text">
              {cardCategories.find(cat => cat.variant === variant)?.name || 'Note'}
            </span>
          )}
        </div>
        <div className="card-controls">
          <button
            className="card-control-btn lock-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleLockToggle();
            }}
            title={isLocked ? "Unlock position" : "Lock to viewport"}
            style={{
              opacity: isLocked ? 1 : 0.7,
              border: isLocked ? "1px solid white" : "none",
              borderRadius: "4px",
            }}
          >
            {isLocked ? "🔒" : "🔓"}
          </button>
          {editable && !isEditing && (
            <button
              className="card-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              title="Edit"
            >
              ✏️
            </button>
          )}
          {editable && isEditing && (
            <>
              <button
                className="card-control-btn save-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
                title="Save"
              >
                ✓
              </button>
              <button
                className="card-control-btn cancel-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                title="Cancel"
              >
                ✕
              </button>
            </>
          )}
          {(backContent || editBackContent) && (
            <button
              className="card-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleFlip();
              }}
              title="Flip Card"
            >
              🔄
            </button>
          )}
          {!isEditing && (
            <button
              className="card-control-btn close-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose && onClose(id);
              }}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={`card-wrapper ${isEditing ? editVariant : variant}`}>
        <div className={`card ${isFlipped ? "flipped" : ""}`}>
          <div className="card-front">
            <div className="card-content" onWheel={(e) => e.stopPropagation()}>
              {showIconView && isFileCard && fileIcon ? (
                (() => {
                  // Scale relative to card size, with zoom compensation capped to avoid overflow
                  const base = Math.min(size.width, size.height);
                  const zoomComp = Math.min(1 / (canvasZoom || 1), 4);
                  const iconSize = Math.min(
                    base * 0.65 * zoomComp,
                    base * 0.95,
                    220,
                  );
                  const titleSize = Math.max(
                    14,
                    Math.min(26, base * 0.12 * zoomComp),
                  );
                  const pillSize = Math.max(
                    11,
                    Math.min(18, base * 0.055 * zoomComp),
                  );
                  const pillPadV = Math.max(
                    4,
                    Math.min(12, base * 0.03 * zoomComp),
                  );
                  const pillPadH = Math.max(
                    10,
                    Math.min(18, base * 0.04 * zoomComp),
                  );
                  return (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        textAlign: "center",
                        height: "100%",
                      }}
                    >
                      <div
                        style={{
                          fontSize: iconSize + "px",
                          marginBottom: "16px",
                          filter: `drop-shadow(0 0 15px ${fileIcon.color}40)`,
                          animation: "pulse 2s infinite",
                        }}
                      >
                        {fileIcon.icon}
                      </div>
                      <div
                        style={{
                          fontSize: titleSize + "px",
                          fontWeight: "bold",
                          marginBottom: "4px",
                          color: fileIcon.color,
                          maxWidth: "90%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {title.split("/").pop()}
                      </div>
                      <div
                        style={{
                          fontSize: pillSize + "px",
                          opacity: 0.6,
                          marginTop: "8px",
                          padding: `${pillPadV}px ${pillPadH}px`,
                          background: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                        }}
                      >
                        Zoom in to view
                      </div>
                    </div>
                  );
                })()
              ) : isEditing ? (
                <div className="card-edit-container">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="card-title-edit"
                    placeholder="Card title..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                    }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="card-content-textarea"
                    placeholder="Enter card content..."
                  />
                </div>
              ) : (
                <div className="card-display-container">
                  <h3 className="card-content-title">{editTitle}</h3>
                  <div className="card-content-display">
                    {editContent && editContent.startsWith('data:image/') ? (
                      <img
                        src={editContent}
                        alt={editTitle}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      editContent
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="card-actions">
              <button
                className="action-button"
                onClick={() => handleAction("like")}
                title="Like"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
              <button
                className="action-button"
                onClick={() => handleAction("copy")}
                title="Copy"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button
                className="action-button"
                onClick={() => handleAction("share")}
                title="Share"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
              </button>
            </div>
          </div>
          {(backContent || editBackContent) && (
            <div className="card-back">
              <div
                className="card-content"
                onWheel={(e) => {
                  // Only stop propagation if card is selected
                  const cardIsSelected = isSelected(id);
                  if (!cardIsSelected) return;
                  e.stopPropagation();
                }}
              >
                {isEditing ? (
                  <div className="card-edit-container">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="card-title-edit"
                      placeholder="Card title..."
                      disabled
                    />
                    {isMarkdown && (
                      <MarkdownToolbar
                        onInsert={handleInsertFormatting}
                        textareaRef={backTextareaRef}
                      />
                    )}
                    <textarea
                      ref={backTextareaRef}
                      value={editBackContent}
                      onChange={(e) => setEditBackContent(e.target.value)}
                      className="card-content-textarea"
                      placeholder="Enter back content..."
                    />
                  </div>
                ) : (
                  <div className="card-display-container">
                    <h3 className="card-content-title">{editTitle}</h3>
                    <div className="card-content-display">
                      {editBackContent || backContent}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isLocked && (
        <div className="resize-handle" onMouseDown={handleMouseDownResize} />
      )}
    </div>
  );
};

export default React.memo(DraggableCard);
