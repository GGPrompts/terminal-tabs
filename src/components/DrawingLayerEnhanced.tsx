import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

interface DrawingLayerProps {
  canvasZoom: number;
  canvasOffset: { x: number; y: number };
}

const DrawingLayerEnhanced: React.FC<DrawingLayerProps> = ({ canvasZoom, canvasOffset }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTypingText, setIsTypingText] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDraggingSelected, setIsDraggingSelected] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialPositions, setInitialPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const {
    drawingObjects,
    drawingMode,
    currentDrawingTool,
    isDrawing,
    currentPath,
    currentStroke,
    currentStrokeWidth,
    currentFill,
    startDrawing,
    addDrawingPoint,
    finishDrawing,
    deleteDrawingObject,
    updateDrawingObject,
  } = useCanvasStore();

  // Convert screen coordinates to SVG coordinates
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const rect = svgRef.current.getBoundingClientRect();
    // Convert screen position to SVG coordinates (0-10000 range)
    const x = ((clientX - rect.left) / rect.width) * 10000;
    const y = ((clientY - rect.top) / rect.height) * 10000;

    return { x, y };
  }, []);

  // Check if a point is near a drawing object (for eraser and selection)
  const findNearbyDrawing = useCallback((point: { x: number; y: number }) => {
    const threshold = 50; // Distance threshold for eraser/selection

    for (const obj of drawingObjects) {
      if (obj.type === 'text' && obj.points[0]) {
        // For text, check if click is near the text position
        const dist = Math.sqrt(
          Math.pow(obj.points[0].x - point.x, 2) +
          Math.pow(obj.points[0].y - point.y, 2)
        );
        if (dist < threshold * 2) return obj.id; // Larger hit area for text
      } else if (obj.type === 'rectangle' && obj.points.length >= 2) {
        // For rectangles, check if point is inside or near the bounds
        const start = obj.points[0];
        const end = obj.points[obj.points.length - 1];
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        // Check if point is inside or near the rectangle (with threshold)
        if (point.x >= minX - threshold && point.x <= maxX + threshold &&
            point.y >= minY - threshold && point.y <= maxY + threshold) {
          return obj.id;
        }
      } else if (obj.type === 'circle' && obj.points.length >= 2) {
        // For circles, check if point is inside or near the circle
        const center = obj.points[0];
        const edge = obj.points[obj.points.length - 1];
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
        );
        const dist = Math.sqrt(
          Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
        );

        // Check if point is inside or near the circle (with threshold)
        if (dist <= radius + threshold) {
          return obj.id;
        }
      } else if ((obj.type === 'line' || obj.type === 'arrow') && obj.points.length >= 2) {
        // For lines and arrows, check distance to the line segment
        const start = obj.points[0];
        const end = obj.points[obj.points.length - 1];

        // Calculate distance from point to line segment
        const lineLength = Math.sqrt(
          Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );

        if (lineLength === 0) {
          // Line is actually a point
          const dist = Math.sqrt(
            Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2)
          );
          if (dist < threshold) return obj.id;
        } else {
          // Calculate perpendicular distance to line
          const t = Math.max(0, Math.min(1,
            ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / (lineLength * lineLength)
          ));

          const projX = start.x + t * (end.x - start.x);
          const projY = start.y + t * (end.y - start.y);

          const dist = Math.sqrt(
            Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2)
          );

          if (dist < threshold) return obj.id;
        }
      } else {
        // For freehand and other shapes, check distance to all points
        for (const p of obj.points) {
          const dist = Math.sqrt(
            Math.pow(p.x - point.x, 2) +
            Math.pow(p.y - point.y, 2)
          );
          if (dist < threshold) return obj.id;
        }
      }
    }
    return null;
  }, [drawingObjects]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingMode) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = screenToWorld(e.clientX, e.clientY);

    if (currentDrawingTool === 'select') {
      // For select tool, find and select drawing(s)
      const targetId = findNearbyDrawing({ x, y });

      if (targetId) {
        // Shift+click for multi-select
        if (e.shiftKey) {
          setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(targetId)) {
              // Deselect if already selected
              newSet.delete(targetId);
            } else {
              // Add to selection
              newSet.add(targetId);
            }
            return newSet;
          });
        } else {
          // Regular click - select only this one
          if (!selectedIds.has(targetId)) {
            setSelectedIds(new Set([targetId]));
          }
        }

        // Start dragging - store initial positions of all selected items
        if (!e.shiftKey || selectedIds.has(targetId)) {
          setDragStartPos({ x, y });
          const positions = new Map<string, { x: number; y: number }>();
          const idsToMove = e.shiftKey && selectedIds.has(targetId) ? selectedIds : new Set([targetId]);

          idsToMove.forEach(id => {
            const obj = drawingObjects.find(o => o.id === id);
            if (obj && obj.points[0]) {
              positions.set(id, { x: obj.points[0].x, y: obj.points[0].y });
            }
          });
          setInitialPositions(positions);
          setIsDraggingSelected(true);
        }
      } else {
        // Click on empty space deselects all (unless Shift is held)
        if (!e.shiftKey) {
          setSelectedIds(new Set());
        }
      }
    } else if (currentDrawingTool === 'text') {
      // If already typing, cancel that and start new text at new position
      if (isTypingText) {
        setTextInput('');
        setTextPosition(null);
        setIsTypingText(false);
      }
      // For text tool, set position and show input
      setTextPosition({ x, y });
      setIsTypingText(true);
      setTextInput('');
    } else {
      startDrawing(x, y);
    }
  }, [drawingMode, screenToWorld, currentDrawingTool, startDrawing, findNearbyDrawing, deleteDrawingObject, drawingObjects, isTypingText]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingMode) return;

    const { x, y } = screenToWorld(e.clientX, e.clientY);

    if (currentDrawingTool === 'select' && isDraggingSelected && selectedIds.size > 0) {
      // Move all selected objects together
      const deltaX = x - dragStartPos.x;
      const deltaY = y - dragStartPos.y;

      selectedIds.forEach(id => {
        const obj = drawingObjects.find(o => o.id === id);
        const initialPos = initialPositions.get(id);

        if (obj && initialPos) {
          // Calculate new position based on initial position + delta
          const newFirstX = initialPos.x + deltaX;
          const newFirstY = initialPos.y + deltaY;

          // Calculate offset for all points
          const offsetX = newFirstX - obj.points[0].x;
          const offsetY = newFirstY - obj.points[0].y;

          // Update all points with the offset
          const newPoints = obj.points.map(p => ({
            x: p.x + offsetX,
            y: p.y + offsetY
          }));

          updateDrawingObject(id, { points: newPoints });
        }
      });
    } else if (isDrawing) {
      addDrawingPoint(x, y);
    }
  }, [drawingMode, isDrawing, screenToWorld, currentDrawingTool, addDrawingPoint, isDraggingSelected, selectedIds, dragStartPos, initialPositions, drawingObjects, updateDrawingObject]);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingMode) return;

    e.preventDefault();

    if (currentDrawingTool === 'select') {
      setIsDraggingSelected(false);
    } else if (isDrawing) {
      finishDrawing();
    }
  }, [drawingMode, isDrawing, finishDrawing, currentDrawingTool]);

  const handleMouseLeave = useCallback(() => {
    if (!drawingMode || !isDrawing) return;
    finishDrawing();
  }, [drawingMode, isDrawing, finishDrawing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingMode) return;

    e.preventDefault();
    e.stopPropagation();

    const { x, y } = screenToWorld(e.clientX, e.clientY);

    // Find if we double-clicked on a text object
    const targetId = findNearbyDrawing({ x, y });
    const obj = drawingObjects.find(o => o.id === targetId);

    if (obj && obj.type === 'text' && obj.text && targetId) {
      // Enter edit mode for this text
      setTextPosition(obj.points[0]);
      setTextInput(obj.text);
      setIsTypingText(true);
      setSelectedIds(new Set([targetId]));
      // Note: We'll delete the old text when user saves the edit
    }
  }, [drawingMode, screenToWorld, findNearbyDrawing, drawingObjects]);

  // Handle keyboard events for deleting selected drawings
  useEffect(() => {
    if (!drawingMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in the text input
      if (isTypingText) return;

      // Delete or Backspace to remove all selected drawings
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault();
        selectedIds.forEach(id => {
          deleteDrawingObject(id);
        });
        setSelectedIds(new Set());
      }

      // Escape to deselect all
      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingMode, selectedIds, isTypingText, deleteDrawingObject]);

  // Handle text input submission
  const handleTextSubmit = useCallback(() => {
    // If editing existing text, delete the old one first
    if (selectedIds.size === 1) {
      const [singleId] = Array.from(selectedIds);
      if (drawingObjects.find(o => o.id === singleId && o.type === 'text')) {
        deleteDrawingObject(singleId);
      }
    }

    // If there's text, create the object
    if (textPosition && textInput.trim()) {
      const textObject = {
        id: `drawing-text-${Date.now()}`,
        type: 'text' as const,
        points: [textPosition],
        style: {
          stroke: currentStroke,
          strokeWidth: 1,
          fill: 'rgba(0,0,0,0.8)',
          opacity: 1,
          fontSize: 18,
          fontFamily: 'sans-serif'
        },
        text: textInput.trim(),
        timestamp: Date.now()
      };

      // Add the text object to the store
      useCanvasStore.setState(state => ({
        drawingObjects: [...state.drawingObjects, textObject]
      }));
    }

    // Always reset text input state (even if no text was entered)
    setTextInput('');
    setTextPosition(null);
    setIsTypingText(false);
    setSelectedIds(new Set());
  }, [textPosition, textInput, currentStroke, selectedIds, drawingObjects, deleteDrawingObject]);


  // Render drawing objects as SVG paths
  const renderDrawingObject = (obj: typeof drawingObjects[0]) => {
    const { id, type, points, style } = obj;

    if (points.length === 0) return null;

    const isSelected = selectedIds.has(id);

    switch (type) {
      case 'freehand': {
        const pathData = points.reduce((path, point, index) => {
          return index === 0 ? `M${point.x},${point.y}` : `${path} L${point.x},${point.y}`;
        }, '');

        return (
          <g key={id}>
            {isSelected && (
              <path
                d={pathData}
                stroke="#00ffff"
                strokeWidth={style.strokeWidth + 4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.5}
              />
            )}
            <path
              d={pathData}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={style.opacity}
            />
          </g>
        );
      }

      case 'line': {
        if (points.length < 2) return null;
        const start = points[0];
        const end = points[points.length - 1];

        return (
          <g key={id}>
            {isSelected && (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#00ffff"
                strokeWidth={style.strokeWidth + 4}
                strokeLinecap="round"
                opacity={0.5}
              />
            )}
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              opacity={style.opacity}
            />
          </g>
        );
      }

      case 'rectangle': {
        if (points.length < 2) return null;
        const rectStart = points[0];
        const rectEnd = points[points.length - 1];
        const rectWidth = Math.abs(rectEnd.x - rectStart.x);
        const rectHeight = Math.abs(rectEnd.y - rectStart.y);
        const rectX = Math.min(rectStart.x, rectEnd.x);
        const rectY = Math.min(rectStart.y, rectEnd.y);

        return (
          <g key={id}>
            {isSelected && (
              <rect
                x={rectX - 5}
                y={rectY - 5}
                width={rectWidth + 10}
                height={rectHeight + 10}
                stroke="#00ffff"
                strokeWidth={2}
                strokeDasharray="5,5"
                fill="none"
                opacity={0.7}
              />
            )}
            <rect
              x={rectX}
              y={rectY}
              width={rectWidth}
              height={rectHeight}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              fill={style.fill || 'none'}
              opacity={style.opacity}
            />
          </g>
        );
      }

      case 'circle': {
        if (points.length < 2) return null;
        const center = points[0];
        const edge = points[points.length - 1];
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
        );

        return (
          <g key={id}>
            {isSelected && (
              <circle
                cx={center.x}
                cy={center.y}
                r={radius + 5}
                stroke="#00ffff"
                strokeWidth={2}
                strokeDasharray="5,5"
                fill="none"
                opacity={0.7}
              />
            )}
            <circle
              cx={center.x}
              cy={center.y}
              r={radius}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              fill={style.fill || 'none'}
              opacity={style.opacity}
            />
          </g>
        );
      }

      case 'arrow': {
        if (points.length < 2) return null;
        const arrowStart = points[0];
        const arrowEnd = points[points.length - 1];

        // Calculate arrowhead
        const angle = Math.atan2(arrowEnd.y - arrowStart.y, arrowEnd.x - arrowStart.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;

        const arrowHead1 = {
          x: arrowEnd.x - arrowLength * Math.cos(angle - arrowAngle),
          y: arrowEnd.y - arrowLength * Math.sin(angle - arrowAngle)
        };
        const arrowHead2 = {
          x: arrowEnd.x - arrowLength * Math.cos(angle + arrowAngle),
          y: arrowEnd.y - arrowLength * Math.sin(angle + arrowAngle)
        };

        return (
          <g key={id}>
            {isSelected && (
              <>
                <line
                  x1={arrowStart.x}
                  y1={arrowStart.y}
                  x2={arrowEnd.x}
                  y2={arrowEnd.y}
                  stroke="#00ffff"
                  strokeWidth={style.strokeWidth + 4}
                  strokeLinecap="round"
                  opacity={0.5}
                />
                <path
                  d={`M${arrowEnd.x},${arrowEnd.y} L${arrowHead1.x},${arrowHead1.y} M${arrowEnd.x},${arrowEnd.y} L${arrowHead2.x},${arrowHead2.y}`}
                  stroke="#00ffff"
                  strokeWidth={style.strokeWidth + 4}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.5}
                />
              </>
            )}
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={arrowEnd.x}
              y2={arrowEnd.y}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              opacity={style.opacity}
            />
            <path
              d={`M${arrowEnd.x},${arrowEnd.y} L${arrowHead1.x},${arrowHead1.y} M${arrowEnd.x},${arrowEnd.y} L${arrowHead2.x},${arrowHead2.y}`}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinecap="round"
              fill="none"
              opacity={style.opacity}
            />
          </g>
        );
      }

      case 'text': {
        if (!obj.text) return null;
        const position = points[0];

        // Create a background rectangle for better readability
        const padding = 12;
        const estimatedWidth = obj.text.length * 10 + padding * 2;
        const height = 30 + padding;

        return (
          <g key={id}>
            {/* Selection highlight */}
            {isSelected && (
              <rect
                x={position.x - padding - 4}
                y={position.y - padding - 4}
                width={estimatedWidth + 8}
                height={height + 8}
                fill="none"
                stroke="#00ffff"
                strokeWidth={2}
                strokeDasharray="5,5"
                rx={8}
                ry={8}
                className="selection-box"
              />
            )}
            {/* Background rectangle with rounded corners */}
            <rect
              x={position.x - padding}
              y={position.y - padding}
              width={estimatedWidth}
              height={height}
              fill={style.fill || 'rgba(0,0,0,0.85)'}
              stroke={isSelected ? '#00ffff' : style.stroke}
              strokeWidth={isSelected ? 2 : 1}
              rx={6}
              ry={6}
              opacity={0.95}
            />
            {/* Text */}
            <text
              x={position.x}
              y={position.y + 18}
              fill={style.stroke}
              fontSize={style.fontSize || 18}
              fontFamily={style.fontFamily || 'sans-serif'}
              style={{
                userSelect: 'none',
                filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
              }}
            >
              {obj.text}
            </text>
          </g>
        );
      }

      default:
        return null;
    }
  };

  // Render current drawing in progress
  const renderCurrentPath = () => {
    if (!isDrawing || currentPath.length === 0) return null;

    if (currentDrawingTool === 'freehand') {
      const pathData = currentPath.reduce((path, point, index) => {
        return index === 0 ? `M${point.x},${point.y}` : `${path} L${point.x},${point.y}`;
      }, '');

      return (
        <path
          d={pathData}
          stroke={currentStroke}
          strokeWidth={currentStrokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      );
    }

    // For other tools, render preview shape
    if (currentPath.length < 2) return null;

    const start = currentPath[0];
    const end = currentPath[currentPath.length - 1];

    switch (currentDrawingTool) {
      case 'line':
        return (
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={currentStroke}
            strokeWidth={currentStrokeWidth}
            strokeLinecap="round"
            opacity={0.7}
          />
        );

      case 'arrow': {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;

        const arrowHead1 = {
          x: end.x - arrowLength * Math.cos(angle - arrowAngle),
          y: end.y - arrowLength * Math.sin(angle - arrowAngle)
        };
        const arrowHead2 = {
          x: end.x - arrowLength * Math.cos(angle + arrowAngle),
          y: end.y - arrowLength * Math.sin(angle + arrowAngle)
        };

        return (
          <g>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={currentStroke}
              strokeWidth={currentStrokeWidth}
              strokeLinecap="round"
              opacity={0.7}
            />
            <path
              d={`M${end.x},${end.y} L${arrowHead1.x},${arrowHead1.y} M${end.x},${end.y} L${arrowHead2.x},${arrowHead2.y}`}
              stroke={currentStroke}
              strokeWidth={currentStrokeWidth}
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
          </g>
        );
      }

      case 'rectangle': {
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        return (
          <rect
            x={Math.min(start.x, end.x)}
            y={Math.min(start.y, end.y)}
            width={width}
            height={height}
            stroke={currentStroke}
            strokeWidth={currentStrokeWidth}
            fill={currentFill || 'none'}
            opacity={0.7}
          />
        );
      }

      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );

        return (
          <circle
            cx={start.x}
            cy={start.y}
            r={radius}
            stroke={currentStroke}
            strokeWidth={currentStrokeWidth}
            fill={currentFill || 'none'}
            opacity={0.7}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 10000 10000"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '10000px',
          height: '10000px',
          pointerEvents: drawingMode ? 'auto' : 'none',
          cursor: drawingMode ?
            (currentDrawingTool === 'select' ? (isDraggingSelected ? 'grabbing' : 'pointer') :
             currentDrawingTool === 'text' ? 'text' :
             'crosshair') : 'default',
          zIndex: drawingMode ? 5000 : 10,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* Render all completed drawings */}
        {drawingObjects.map(renderDrawingObject)}

        {/* Render current path being drawn */}
        {renderCurrentPath()}

        {/* Inline text input - type directly on the canvas at click position */}
        {isTypingText && textPosition && (
          <foreignObject
            x={textPosition.x}
            y={textPosition.y}
            width={300}
            height={80}
            style={{ overflow: 'visible' }}
          >
            <div
              style={{
                width: '300px',
                background: 'rgba(0, 0, 0, 0.95)',
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${currentStroke}`,
                boxShadow: `0 0 20px ${currentStroke}40`,
                boxSizing: 'border-box',
              }}
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTextSubmit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsTypingText(false);
                    setTextInput('');
                    setTextPosition(null);
                  }
                }}
                style={{
                  width: '276px',
                  padding: '8px',
                  fontSize: '16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: currentStroke,
                  outline: 'none',
                  fontFamily: 'sans-serif',
                  boxSizing: 'border-box',
                }}
                placeholder="Type your note..."
                autoFocus
              />
              <div style={{ marginTop: '8px', color: '#888', fontSize: '11px', textAlign: 'center' }}>
                Enter to save • Escape to cancel
              </div>
            </div>
          </foreignObject>
        )}
      </svg>
    </>
  );
};

export default DrawingLayerEnhanced;