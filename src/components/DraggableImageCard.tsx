import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useCanvasStore, CardState } from "../stores/canvasStore";
import "./DraggableImageCard.css";

interface DraggableImageCardProps {
  id: string;
  title: string;
  imagePath: string;
  imageData?: string; // Base64 encoded image data
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onClose: (id: string) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  canvasZoom?: number;
  onUpdate?: (id: string, updates: Partial<CardState>) => void;
}

export const DraggableImageCard: React.FC<DraggableImageCardProps> = React.memo(({
  id,
  title,
  imagePath,
  imageData,
  initialPosition = {
    x: window.innerWidth / 2 - 300,
    y: window.innerHeight / 2 - 200,
  },
  initialSize = { width: 600, height: 400 },
  onClose,
  zIndex,
  onFocus,
  canvasZoom = 1,
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(!imageData);
  const [hideHeader, setHideHeader] = useState(true); // Start with header hidden
  const [isHovered, setIsHovered] = useState(false);
  const [transparency, setTransparency] = useState(0); // 0 = fully transparent background
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("🖼️");
  const [borderColor, setBorderColor] = useState("#ffffff");
  const [showBorder, setShowBorder] = useState(true);

  const nodeRef = useRef<HTMLDivElement>(null);
  const savedState = useRef<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);

  const { updateCard } = useCanvasStore();

  const emojis = ["🖼️", "🎨", "📸", "🌟", "✨", "🎯", "💎", "🔥", "⚡", "🌈", "🎪", "🎭", "🎬", "📷", "🖌️", "🎆"];
  const borderColors = [
    { color: "#ffffff", name: "White" },
    { color: "#00ffff", name: "Cyan" },
    { color: "#ff00ff", name: "Magenta" },
    { color: "#00ff00", name: "Lime" },
    { color: "#ffff00", name: "Yellow" },
    { color: "#ff6600", name: "Orange" },
    { color: "#aa00ff", name: "Purple" },
    { color: "#ff0066", name: "Pink" },
    { color: "none", name: "No Border" }
  ];

  // Icon view removed - image cards always show at all zoom levels

  // Theming for image cards
  const theme = React.useMemo(() => {
    return {
      headerFrom: "rgba(236, 72, 153, 0.22)",
      headerTo: "rgba(249, 115, 22, 0.22)",
      border: "rgba(236, 72, 153, 0.45)",
    };
  }, []);
  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
    borderBottom: `1px solid ${theme.border}`,
  };
  const containerStyle: React.CSSProperties = {
    border: showBorder ? `2px solid ${borderColor}${Math.floor(Math.max(0.1, transparency / 100) * 255).toString(16).padStart(2, '0')}` : 'none',
    backgroundColor: transparency > 10 ? `rgba(26, 26, 26, ${(transparency - 10) / 90})` : 'transparent',
    transition: "background-color 0.2s ease, border-color 0.2s ease",
  };

  const handleDrag = (_e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  };

  const handleResize = (_e: any, { size }: any) => {
    setSize({ width: size.width, height: size.height });
  };

  const handleStop = () => {
    // Don't save position if maximized (portal mode) - prevents fullscreen portal position from being saved as canvas position
    if (isMaximized) {
      return;
    }
    updateCard(id, { position, size });
  };

  const toggleMaximize = () => {
    if (isMaximized && savedState.current) {
      setPosition(savedState.current.position);
      setSize(savedState.current.size);
      setIsMaximized(false);
    } else {
      savedState.current = { position, size };
      setIsMaximized(true);
      onFocus(id);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 500));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 25));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  const handleDownload = () => {
    if (imageData) {
      const link = document.createElement("a");
      link.href = imageData;
      link.download = title.split("/").pop() || "image.png";
      link.click();
    }
  };

  const handleCopyImage = async () => {
    if (imageData) {
      try {
        const response = await fetch(imageData);
        const blob = await response.blob();
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
      } catch (err) {
        console.error("Failed to copy image:", err);
      }
    }
  };

  React.useEffect(() => {
    // If no imageData provided, try to load from backend
    if (!imageData && imagePath) {
      const loadImage = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            `/api/files/image?${new URLSearchParams({ path: imagePath })}`,
          );
          if (response.ok) {
            const data = await response.json();
            // We'll need to update this to set the imageData
            setIsLoading(false);
          } else {
            setImageError(true);
            setIsLoading(false);
          }
        } catch (err) {
          console.error("Failed to load image:", err);
          setImageError(true);
          setIsLoading(false);
        }
      };
      loadImage();
    }
  }, [imagePath, imageData]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="image-loading">
          <div className="spinner"></div>
          <p>Loading image...</p>
        </div>
      );
    }

    if (imageError) {
      return (
        <div className="image-error">
          <p>Failed to load image</p>
          <p className="image-path">{imagePath}</p>
        </div>
      );
    }

    return (
      <div
        className="image-container"
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <img
          src={
            imageData ||
            `/api/files/image?path=${encodeURIComponent(imagePath)}`
          }
          alt={title}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center",
            transition: "transform 0.2s",
            imageRendering: zoom > 200 ? "pixelated" : "auto",
          }}
          onError={() => setImageError(true)}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  };

  // Render maximized viewer in a portal
  if (isMaximized) {
    return createPortal(
      <div
        className="image-viewer-fullscreen-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999999,
          background: "rgba(0, 0, 0, 0.95)",
          display: "flex",
          flexDirection: "column",
          padding: "20px",
        }}
      >
        <div className="image-card-container fullscreen" style={containerStyle}>
          <div className="image-card-header" style={headerStyle}>
            <div className="image-card-info">
              <span className="file-icon">🖼️</span>
              <span className="file-name">{title.split("/").pop()}</span>
              <span className="file-path">{imagePath}</span>
            </div>
            <div className="image-card-controls">
              <span className="zoom-display">{zoom}%</span>
              <button
                className="viewer-control-btn"
                onClick={handleZoomOut}
                title="Zoom out"
              >
                🔍-
              </button>
              <button
                className="viewer-control-btn"
                onClick={handleZoomReset}
                title="Reset zoom"
              >
                100%
              </button>
              <button
                className="viewer-control-btn"
                onClick={handleZoomIn}
                title="Zoom in"
              >
                🔍+
              </button>
              <button
                className="viewer-control-btn"
                onClick={handleCopyImage}
                title="Copy image"
              >
                📋
              </button>
              <button
                className="viewer-control-btn"
                onClick={handleDownload}
                title="Download"
              >
                💾
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
          <div className="image-card-content">{renderContent()}</div>
        </div>
      </div>,
      document.body,
    );
  }

  // Regular draggable viewer
  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onDrag={handleDrag}
      onStop={handleStop}
      handle=".image-card-header"
      bounds={{left: 0, top: 0, right: 10000, bottom: 10000}} // World bounds match MINIMAP_WORLD
      scale={canvasZoom}
      disabled={isMaximized}
    >
      <div
        ref={nodeRef}
        className="image-card-wrapper"
        style={{
          position: "absolute",
          zIndex,
        }}
        onMouseDown={() => onFocus(id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ResizableBox
          width={size.width}
          height={size.height}
          onResize={handleResize}
          onResizeStop={handleStop}
          minConstraints={[300, 200]}
          maxConstraints={[window.innerWidth - 50, window.innerHeight - 50]}
          resizeHandles={["se"]}
          className="resizable-image-card"
        >
          <div className="image-card-container" style={{...containerStyle, position: 'relative'}}>
            {isHovered && (
              <div className="image-card-header" style={{
                ...headerStyle,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                animation: 'slideDown 0.2s ease-out',
              }}>
              <div className="image-card-info">
                <span
                  className="file-icon"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title="Click to customize emoji"
                >
                  {customEmoji}
                </span>
                <span className="file-name">{title.split("/").pop()}</span>
              </div>
              <div className="image-card-controls">
                <span className="zoom-display">{zoom}%</span>
                <button
                  className="viewer-control-btn"
                  onClick={handleZoomOut}
                  title="Zoom out"
                >
                  -
                </button>
                <button
                  className="viewer-control-btn"
                  onClick={handleZoomReset}
                  title="Reset"
                >
                  ⟲
                </button>
                <button
                  className="viewer-control-btn"
                  onClick={handleZoomIn}
                  title="Zoom in"
                >
                  +
                </button>
                <div className="transparency-control" style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>🔍</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={transparency}
                    onChange={(e) => setTransparency(Number(e.target.value))}
                    style={{
                      width: '80px',
                      height: '20px',
                      cursor: 'pointer',
                    }}
                    title={`Transparency: ${transparency}%`}
                  />
                  <span style={{ fontSize: '11px', minWidth: '35px', opacity: 0.8 }}>{transparency}%</span>
                </div>
                <button
                  className="viewer-control-btn"
                  onClick={handleDownload}
                  title="Download"
                >
                  💾
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

            {/* Emoji Picker */}
            {showEmojiPicker && isHovered && (
              <div style={{
                position: 'absolute',
                top: '50px',
                left: '10px',
                background: 'rgba(20, 20, 25, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '10px',
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '5px',
                zIndex: 1000,
                backdropFilter: 'blur(10px)'
              }}>
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setCustomEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid transparent',
                      padding: '5px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <div style={{ gridColumn: 'span 8', marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '8px' }}>Border Color:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                    {borderColors.map(({ color, name }) => (
                      <button
                        key={color}
                        onClick={() => {
                          if (color === 'none') {
                            setShowBorder(false);
                          } else {
                            setShowBorder(true);
                            setBorderColor(color);
                          }
                        }}
                        title={name}
                        style={{
                          width: '30px',
                          height: '30px',
                          background: color === 'none' ? 'transparent' : color,
                          border: color === 'none' ? '2px dashed rgba(255, 255, 255, 0.3)' : `2px solid ${color}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {color === 'none' && <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>✕</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="image-card-content" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%'
            }}>{renderContent()}</div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
});
