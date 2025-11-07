import React, { useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

const DrawingToolbar: React.FC = () => {
  const {
    drawingMode,
    currentDrawingTool,
    currentStroke,
    currentStrokeWidth,
    currentFill,
    drawingObjects,
    setDrawingMode,
    setCurrentDrawingTool,
    setDrawingStyle,
    clearAllDrawings,
  } = useCanvasStore();

  const [showFillColor, setShowFillColor] = useState(false);

  const tools = [
    { id: 'select', icon: '👆', label: 'Select/Move', description: 'Click to select, Shift+Click for multi-select, drag to move, Delete to remove' },
    { id: 'freehand', icon: '✏️', label: 'Freehand', description: 'Draw free-form lines' },
    { id: 'line', icon: '📏', label: 'Line', description: 'Draw straight lines' },
    { id: 'arrow', icon: '➡️', label: 'Arrow', description: 'Draw arrows' },
    { id: 'rectangle', icon: '⬜', label: 'Rectangle', description: 'Draw rectangles' },
    { id: 'circle', icon: '⭕', label: 'Circle', description: 'Draw circles' },
    { id: 'text', icon: '💬', label: 'Text Note', description: 'Add text annotations' },
  ] as const;

  // Colors for both dark and light backgrounds
  const neonColors = [
    { color: '#000000', name: 'Black' },     // Black for light themes
    { color: '#404040', name: 'Dark Gray' }, // Dark gray
    { color: '#808080', name: 'Gray' },      // Medium gray
    { color: '#ffffff', name: 'White' },     // White
    { color: '#00ffff', name: 'Cyan' },      // Bright cyan
    { color: '#ff00ff', name: 'Magenta' },   // Bright magenta
    { color: '#00ff00', name: 'Green' },     // Neon green
    { color: '#ffff00', name: 'Yellow' },    // Bright yellow
    { color: '#ff0080', name: 'Pink' },      // Hot pink
    { color: '#80ff00', name: 'Lime' },      // Lime green
    { color: '#ff8000', name: 'Orange' },    // Bright orange
    { color: '#00ff80', name: 'Mint' },      // Mint green
    { color: '#8000ff', name: 'Purple' },    // Bright purple
    { color: '#ff0040', name: 'Red' },       // Bright red
  ];

  const strokeWidths = [1, 2, 3, 5, 8, 12];

  if (!drawingMode) {
    return null; // No button needed, using header icon instead
  }

  return (
    <div
      className="fixed left-1/2 transform -translate-x-1/2 glass rounded-2xl shadow-2xl"
      style={{
        top: '80px',
        zIndex: 100001,
        background: 'linear-gradient(145deg, rgba(30, 30, 35, 0.95), rgba(20, 20, 25, 0.95))',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2)',
        maxWidth: '95vw',
        padding: '24px'
      }}
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6 pb-4" style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <h3 className="text-white font-semibold text-lg">Drawing Tools</h3>
          </div>
          <span className="text-gray-400 text-sm px-3 py-1 rounded-full" style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {drawingObjects.length} object{drawingObjects.length !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={() => setDrawingMode(false)}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.25))',
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.35), rgba(220, 38, 38, 0.35))';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.25))';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
          }}
        >
          ✖ Exit Drawing Mode
        </button>
      </div>

      {/* Tool Selection Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>Tools</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Helpful hint for select tool */}
        {currentDrawingTool === 'select' && (
          <div className="mb-3 px-4 py-3 rounded-lg" style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div className="text-sm" style={{ color: '#a0c4ff', lineHeight: '1.6' }}>
              💡 <strong>Select Mode:</strong>
              <br />
              • Click to select, drag to move
              <br />
              • <kbd style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>Shift</kbd> + Click for multi-select
              <br />
              • <kbd style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>Delete</kbd> or <kbd style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>Backspace</kbd> to remove
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setCurrentDrawingTool(tool.id)}
              className={`px-5 py-3 rounded-xl text-lg transition-all flex flex-col items-center gap-1.5 min-w-[90px] ${
                currentDrawingTool === tool.id
                  ? 'shadow-xl'
                  : ''
              }`}
              style={{
                background: currentDrawingTool === tool.id
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(147, 51, 234, 0.25))'
                  : 'rgba(255, 255, 255, 0.04)',
                border: `1.5px solid ${currentDrawingTool === tool.id
                  ? 'rgba(147, 51, 234, 0.6)'
                  : 'rgba(255, 255, 255, 0.1)'
                }`,
                boxShadow: currentDrawingTool === tool.id
                  ? '0 4px 20px rgba(147, 51, 234, 0.3)'
                  : 'none'
              }}
              title={tool.description}
            >
              <span style={{ fontSize: '24px' }}>{tool.icon}</span>
              <span className="text-xs font-medium" style={{ color: '#ffffff' }}>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Color Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>Stroke Color</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>
        <div className="flex gap-3 flex-wrap p-4 rounded-xl" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {neonColors.map(({ color, name }) => (
            <button
              key={color}
              onClick={() => setDrawingStyle(color, currentStrokeWidth, currentFill)}
              className={`rounded-xl transition-all ${
                currentStroke === color
                  ? 'scale-110'
                  : 'hover:scale-105'
              }`}
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: color,
                border: `3px solid ${currentStroke === color ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'}`,
                boxShadow: currentStroke === color
                  ? `0 0 25px ${color}, 0 4px 15px rgba(0, 0, 0, 0.3)`
                  : `0 0 10px ${color}40, 0 2px 8px rgba(0, 0, 0, 0.2)`,
              }}
              title={name}
            />
          ))}
        </div>
      </div>

      {/* Fill Color Section (for shapes) */}
      {(currentDrawingTool === 'rectangle' || currentDrawingTool === 'circle') && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>Fill Color</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <button
              onClick={() => {
                setDrawingStyle(currentStroke, currentStrokeWidth, undefined);
                setShowFillColor(false);
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                color: '#ffffff',
                transform: !currentFill ? 'scale(1.05)' : 'scale(1)',
                opacity: currentFill ? 0.7 : 1,
                background: !currentFill
                  ? 'linear-gradient(135deg, rgba(100, 100, 100, 0.3), rgba(60, 60, 60, 0.3))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: `1.5px solid ${!currentFill ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
              }}
            >
              None
            </button>
            <div className="flex gap-3 flex-wrap">
              {neonColors.slice(0, 10).map(({ color, name }) => (
                <button
                  key={`fill-${color}`}
                  onClick={() => setDrawingStyle(currentStroke, currentStrokeWidth, color)}
                  className={`rounded-xl transition-all ${
                    currentFill === color
                      ? 'scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: color,
                    opacity: 0.6,
                    border: `3px solid ${currentFill === color ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'}`,
                    boxShadow: currentFill === color
                      ? `0 0 20px ${color}80, 0 4px 15px rgba(0, 0, 0, 0.3)`
                      : '0 2px 8px rgba(0, 0, 0, 0.2)',
                  }}
                  title={`Fill: ${name}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stroke Width Section */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>Stroke Width</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        </div>
        <div className="flex gap-3 p-4 rounded-xl" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {strokeWidths.map((width) => (
            <button
              key={width}
              onClick={() => setDrawingStyle(currentStroke, width, currentFill)}
              className={`px-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                currentStrokeWidth === width
                  ? 'scale-110'
                  : 'hover:scale-105'
              }`}
              style={{
                width: '70px',
                height: '70px',
                background: currentStrokeWidth === width
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))'
                  : 'rgba(255, 255, 255, 0.05)',
                borderColor: currentStrokeWidth === width
                  ? 'rgba(147, 51, 234, 0.6)'
                  : 'rgba(255, 255, 255, 0.15)',
                boxShadow: currentStrokeWidth === width
                  ? '0 4px 20px rgba(147, 51, 234, 0.3)'
                  : 'none'
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: `${Math.min(width * 3, 24)}px`,
                  height: `${Math.min(width * 3, 24)}px`,
                  backgroundColor: currentStroke,
                  boxShadow: `0 0 ${width * 2}px ${currentStroke}60`,
                }}
              />
              <span className="text-xs font-medium" style={{ color: '#ffffff' }}>{width}px</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions Section */}
      {drawingObjects.length > 0 && (
        <div className="pt-4" style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            onClick={() => {
              if (window.confirm('Clear all drawings? This cannot be undone.')) {
                clearAllDrawings();
              }
            }}
            className="px-6 py-3 rounded-lg text-sm font-semibold transition-all hover:scale-105 w-full"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.3))';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
          >
            🗑️ Clear All Drawings ({drawingObjects.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default DrawingToolbar;