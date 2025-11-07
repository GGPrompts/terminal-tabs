import React, { useRef, useEffect, useState } from "react";
import { useCanvasStore, CardState } from "../stores/canvasStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { Agent } from "../App";
import "./Minimap.css";

interface MinimapProps {
  agents: Agent[];
  cards: CardState[];
  canvasSize: { width: number; height: number };
  viewportSize: { width: number; height: number };
  canvasOffset: { x: number; y: number };
  canvasZoom: number;
  onNavigate: (x: number, y: number) => void;
  forceCollapse?: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({
  agents,
  cards,
  canvasSize,
  viewportSize,
  canvasOffset,
  canvasZoom,
  onNavigate,
  forceCollapse = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const minimapOpacity = useSettingsStore((state) => state.minimapOpacity);
  const [collapsed, setCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('minimap-collapsed');
    return saved === 'true';
  });
  const prevCollapsedRef = useRef<boolean | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Get minimap size from store (saved with workspace every 60s)
  const minimapSize = useCanvasStore((state) => state.minimapSize);
  const setMinimapSize = useCanvasStore((state) => state.setMinimapSize);

  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const rafScheduled = useRef(false);

  // Save collapsed state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('minimap-collapsed', collapsed.toString());
  }, [collapsed]);

  useEffect(() => {
    if (forceCollapse) {
      if (prevCollapsedRef.current === null) {
        prevCollapsedRef.current = collapsed;
      }
      if (!collapsed) {
        setCollapsed(true);
      }
    } else if (prevCollapsedRef.current !== null) {
      setCollapsed(prevCollapsedRef.current);
      prevCollapsedRef.current = null;
    }
  }, [forceCollapse, collapsed]);

  // Minimap dimensions
  const MINIMAP_WIDTH = minimapSize.width;
  const MINIMAP_HEIGHT = minimapSize.height;

  // Add padding to show area outside canvas bounds (30% extra on each side)
  const PADDING_FACTOR = 0.3;
  const paddedCanvasWidth = canvasSize.width * (1 + PADDING_FACTOR * 2);
  const paddedCanvasHeight = canvasSize.height * (1 + PADDING_FACTOR * 2);

  // Calculate scale to fit the padded area in the minimap
  const scaleX = MINIMAP_WIDTH / paddedCanvasWidth;
  const scaleY = MINIMAP_HEIGHT / paddedCanvasHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate UI scaling factor based on minimap size (compared to default 240x160)
  const uiScale = Math.min(MINIMAP_WIDTH / 240, MINIMAP_HEIGHT / 160);

  // Calculate the actual minimap dimensions maintaining aspect ratio
  const actualMinimapWidth = paddedCanvasWidth * scale;
  const actualMinimapHeight = paddedCanvasHeight * scale;

  // Center the entire view in the minimap
  const offsetX = (MINIMAP_WIDTH - actualMinimapWidth) / 2;
  const offsetY = (MINIMAP_HEIGHT - actualMinimapHeight) / 2;

  // Calculate where the actual canvas bounds are within the padded area
  const canvasOffsetX = offsetX + (canvasSize.width * PADDING_FACTOR * scale);
  const canvasOffsetY = offsetY + (canvasSize.height * PADDING_FACTOR * scale);
  const canvasMinimapWidth = canvasSize.width * scale;
  const canvasMinimapHeight = canvasSize.height * scale;

  // Draw the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use requestAnimationFrame to throttle updates during rapid zoom/pan
    let rafId: number;
    const draw = () => {
      rafScheduled.current = false; // Mark as no longer scheduled

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Fill full minimap background with subtle gradient
    const bgGradient = ctx.createLinearGradient(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
    bgGradient.addColorStop(0, "rgba(10, 10, 20, 0.4)");
    bgGradient.addColorStop(1, "rgba(20, 20, 30, 0.3)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw the full viewport area (including padding) with very subtle background
    ctx.fillStyle = "rgba(5, 5, 15, 0.3)";
    ctx.fillRect(offsetX, offsetY, actualMinimapWidth, actualMinimapHeight);

    // Draw the actual canvas bounds with gradient
    const worldGradient = ctx.createLinearGradient(
      canvasOffsetX, canvasOffsetY,
      canvasOffsetX + canvasMinimapWidth,
      canvasOffsetY + canvasMinimapHeight
    );
    worldGradient.addColorStop(0, "rgba(15, 15, 35, 0.5)");
    worldGradient.addColorStop(1, "rgba(10, 10, 25, 0.6)");
    ctx.fillStyle = worldGradient;
    ctx.fillRect(canvasOffsetX, canvasOffsetY, canvasMinimapWidth, canvasMinimapHeight);

    // Border for canvas bounds with glow effect
    ctx.shadowColor = "rgba(255, 107, 53, 0.5)";
    ctx.shadowBlur = 5;
    ctx.strokeStyle = "rgba(255, 107, 53, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(canvasOffsetX, canvasOffsetY, canvasMinimapWidth, canvasMinimapHeight);
    ctx.shadowBlur = 0;

    // Draw subtle border for the full viewport area
    ctx.strokeStyle = "rgba(100, 100, 150, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(offsetX, offsetY, actualMinimapWidth, actualMinimapHeight);

    // Draw grid with better visibility (only within canvas bounds)
    ctx.strokeStyle = "rgba(100, 150, 255, 0.15)";
    ctx.lineWidth = 0.5;
    const gridSize = 500 * scale; // 500px grid cells

    for (let x = 0; x <= canvasMinimapWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(canvasOffsetX + x, canvasOffsetY);
      ctx.lineTo(canvasOffsetX + x, canvasOffsetY + canvasMinimapHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= canvasMinimapHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(canvasOffsetX, canvasOffsetY + y);
      ctx.lineTo(canvasOffsetX + canvasMinimapWidth, canvasOffsetY + y);
      ctx.stroke();
    }

    // Helper function to get terminal type emoji
    const getTerminalTypeEmoji = (agent: Agent): string => {
      if (agent.isOn === false) return "⚫"; // Off state
      if (agent.embedded) return "📡"; // Embedded

      switch (agent.terminalType) {
        case "claude-code": return "🤖";
        case "opencode": return "🟢";
        case "codex": return "📚";
        case "gemini": return "✨";
        case "bash": return "💻";
        case "tui-tool": return "🎮";
        default: return "🔷";
      }
    };

    // Helper function to get card type emoji
    const getCardTypeEmoji = (card: CardState): string | null => {
      // Skip regular note cards (no backContent = quick note)
      if (!card.backContent) return null;

      // Check for image cards
      const ext = card.title.split('.').pop()?.toLowerCase();
      const isImageFile = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '');

      if (isImageFile || card.content?.startsWith('data:image')) {
        return "🖼️";
      }

      // File viewer (has backContent = file path)
      return "📄";
    };

    // Draw corner markers in padding area (outside canvas bounds)
    ctx.fillStyle = "rgba(150, 200, 255, 0.8)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 2;
    const cornerFontSize = Math.max(8, Math.round(10 * uiScale));
    ctx.font = `bold ${cornerFontSize}px monospace`;

    // Top-left (0,0) - ABOVE canvas
    ctx.fillText("(0,0)", canvasOffsetX + 2, canvasOffsetY - 5);

    // Top-right - ABOVE and RIGHT
    ctx.fillText(
      `(${canvasSize.width},0)`,
      canvasOffsetX + canvasMinimapWidth - 40,
      canvasOffsetY - 5
    );

    // Bottom-left - BELOW and LEFT
    ctx.fillText(
      `(0,${canvasSize.height})`,
      canvasOffsetX + 2,
      canvasOffsetY + canvasMinimapHeight + 12
    );

    // Bottom-right - BELOW and RIGHT
    ctx.fillText(
      `(${canvasSize.width},${canvasSize.height})`,
      canvasOffsetX + canvasMinimapWidth - 50,
      canvasOffsetY + canvasMinimapHeight + 12
    );

    // Draw terminals with emojis
    agents.forEach((agent) => {
      if (!agent.position) return;

      const terminalX = offsetX + (agent.position.x + canvasSize.width * PADDING_FACTOR) * scale;
      const terminalY = offsetY + (agent.position.y + canvasSize.height * PADDING_FACTOR) * scale;

      const emoji = getTerminalTypeEmoji(agent);
      const baseEmojiSize = Math.max(10, Math.round(12 * uiScale));

      ctx.font = `${baseEmojiSize}px "Segoe UI Emoji", "Apple Color Emoji"`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(emoji, terminalX - baseEmojiSize/2, terminalY + baseEmojiSize/4);
      ctx.shadowBlur = 0;
    });

    // Draw cards (only file viewers and images)
    cards.forEach((card) => {
      if (card.isLocked) return;

      const emoji = getCardTypeEmoji(card);
      if (!emoji) return; // Skip note cards

      const cardX = offsetX + (card.position.x + canvasSize.width * PADDING_FACTOR) * scale;
      const cardY = offsetY + (card.position.y + canvasSize.height * PADDING_FACTOR) * scale;

      const baseEmojiSize = Math.max(10, Math.round(12 * uiScale));

      ctx.font = `${baseEmojiSize}px "Segoe UI Emoji", "Apple Color Emoji"`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(emoji, cardX - baseEmojiSize/2, cardY + baseEmojiSize/4);
      ctx.shadowBlur = 0;
    });

    // Calculate viewport rectangle
    // The viewport in canvas coordinates
    const viewportLeft = -canvasOffset.x / canvasZoom;
    const viewportTop = -canvasOffset.y / canvasZoom;
    const viewportWidth = viewportSize.width / canvasZoom;
    const viewportHeight = viewportSize.height / canvasZoom;

    // Convert to minimap coordinates (accounting for padding)
    const minimapViewportX = offsetX + (viewportLeft + canvasSize.width * PADDING_FACTOR) * scale;
    const minimapViewportY = offsetY + (viewportTop + canvasSize.height * PADDING_FACTOR) * scale;
    const minimapViewportWidth = viewportWidth * scale;
    const minimapViewportHeight = viewportHeight * scale;

    // Draw viewport rectangle
    ctx.strokeStyle =
      isHovered || isDragging
        ? "rgba(255, 200, 50, 0.9)"
        : "rgba(255, 200, 50, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      minimapViewportX,
      minimapViewportY,
      minimapViewportWidth,
      minimapViewportHeight,
    );

    // Draw viewport fill
    ctx.fillStyle = "rgba(255, 200, 50, 0.1)";
    ctx.fillRect(
      minimapViewportX,
      minimapViewportY,
      minimapViewportWidth,
      minimapViewportHeight,
    );
    };

    // Schedule the draw using requestAnimationFrame to throttle updates
    // Only schedule if not already scheduled (prevents RAF call stacking during rapid zoom)
    if (!rafScheduled.current) {
      rafScheduled.current = true;
      rafId = requestAnimationFrame(draw);
    }

    // Cleanup: cancel pending animation frame
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafScheduled.current = false;
      }
    };
  }, [
    agents,
    cards,
    canvasOffset,
    canvasZoom,
    viewportSize,
    scale,
    uiScale,
    isHovered,
    isDragging,
    MINIMAP_WIDTH,
    MINIMAP_HEIGHT,
    offsetX,
    offsetY,
    actualMinimapWidth,
    actualMinimapHeight,
    canvasSize,
    canvasOffsetX,
    canvasOffsetY,
    canvasMinimapWidth,
    canvasMinimapHeight,
    PADDING_FACTOR,
  ]);

  // Handle click/drag on minimap
  const handleMinimapInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Recalculate offsets based on current minimap size
    const currentOffsetX = (MINIMAP_WIDTH - actualMinimapWidth) / 2;
    const currentOffsetY = (MINIMAP_HEIGHT - actualMinimapHeight) / 2;

    // Convert minimap coordinates to canvas coordinates (accounting for padding)
    const canvasX = (x - currentOffsetX) / scale - canvasSize.width * PADDING_FACTOR;
    const canvasY = (y - currentOffsetY) / scale - canvasSize.height * PADDING_FACTOR;

    // Navigate to this position (centering the viewport on the clicked point)
    const targetX = -canvasX * canvasZoom + viewportSize.width / 2;
    const targetY = -canvasY * canvasZoom + viewportSize.height / 2;

    onNavigate(targetX, targetY);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleMinimapInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      handleMinimapInteraction(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: minimapSize.width,
      height: minimapSize.height,
    };
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;

        // Since we're resizing from bottom-left, increase width when dragging left (negative deltaX)
        const newWidth = Math.max(
          180,
          Math.min(500, resizeStart.current.width - deltaX),
        );
        const newHeight = Math.max(
          120,
          Math.min(500, resizeStart.current.height + deltaY),
        );

        setMinimapSize({ width: newWidth, height: newHeight });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isResizing]);

  return (
    <div
      className={`minimap-container ${collapsed ? "collapsed" : ""}`}
      style={{
        width: minimapSize.width,
        height: collapsed ? "auto" : "auto", // Let content determine height
        opacity: minimapOpacity,
      }}
    >
      {/* Resize handle - bottom-left corner */}
      {!collapsed && (
        <div
          className="minimap-resize-handle"
          onMouseDown={handleResizeMouseDown}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "20px",
            height: "20px",
            cursor: "nesw-resize",
            background:
              "linear-gradient(135deg, transparent 50%, rgba(255, 215, 0, 0.3) 50%)",
            borderLeft: "2px solid rgba(255, 215, 0, 0.4)",
            borderBottom: "2px solid rgba(255, 215, 0, 0.4)",
            zIndex: 10,
          }}
        />
      )}
      <div className="minimap-header">
        <span className="minimap-title">Navigator</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="minimap-zoom">{Math.round(canvasZoom * 100)}%</span>
          <button
            className="minimap-toggle"
            title={collapsed ? "Maximize" : "Minimize"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "▣" : "—"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div
          style={{
            width: minimapSize.width,
            height: minimapSize.height,
            position: "relative",
          }}
        >
          <canvas
            ref={canvasRef}
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            className="minimap-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
              setIsHovered(false);
              setIsDragging(false);
            }}
          />
        </div>
      )}
      {!collapsed && (
        <div className="minimap-info">
          <div className="minimap-legend">
            <div className="legend-row">
              <span className="legend-item">🤖 Claude</span>
              <span className="legend-item">🟢 OpenCode</span>
              <span className="legend-item">💻 Bash</span>
              <span className="legend-item">📄 File</span>
              <span className="legend-item">🖼️ Image</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
