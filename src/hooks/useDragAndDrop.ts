import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface UseDragAndDropOptions {
  initialPosition?: Position;
  initialSize?: Size;
  minWidth?: number;
  minHeight?: number;
  canvasZoom?: number;
  onPositionChange?: (position: Position) => void;
  onSizeChange?: (size: Size) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  isLocked?: boolean;
  isMaximized?: boolean;
}

interface DragAndDropResult {
  position: Position;
  size: Size;
  isDragging: boolean;
  isResizing: boolean;

  // Drag handlers
  handleDragStart: (e: React.MouseEvent) => void;
  handleDragMove: (e: MouseEvent) => void;
  handleDragEnd: () => void;

  // Resize handlers
  handleResizeStart: (e: React.MouseEvent) => void;
  handleResizeMove: (e: MouseEvent) => void;
  handleResizeEnd: () => void;

  // State setters
  setPosition: (position: Position) => void;
  setSize: (size: Size) => void;
}

export function useDragAndDrop({
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 800, height: 600 },
  minWidth = 400,
  minHeight = 300,
  canvasZoom = 1,
  onPositionChange,
  onSizeChange,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeEnd,
  isLocked = false,
  isMaximized = false,
}: UseDragAndDropOptions = {}): DragAndDropResult {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Refs for tracking drag/resize state
  const dragStartPos = useRef<Position | null>(null);
  const dragStartElementPos = useRef<Position | null>(null);
  const resizeStartPos = useRef<Position | null>(null);
  const resizeStartSize = useRef<Size | null>(null);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked || isMaximized) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      dragStartElementPos.current = { ...position };

      onDragStart?.();
    },
    [position, isLocked, isMaximized, onDragStart],
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartPos.current || !dragStartElementPos.current)
        return;

      // Calculate delta accounting for canvas zoom
      const deltaX = (e.clientX - dragStartPos.current.x) / canvasZoom;
      const deltaY = (e.clientY - dragStartPos.current.y) / canvasZoom;

      const newPosition = {
        x: dragStartElementPos.current.x + deltaX,
        y: dragStartElementPos.current.y + deltaY,
      };

      setPosition(newPosition);
      onPositionChange?.(newPosition);
    },
    [isDragging, canvasZoom, onPositionChange],
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    dragStartPos.current = null;
    dragStartElementPos.current = null;

    onDragEnd?.();
  }, [isDragging, onDragEnd]);

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked || isMaximized) return;

      e.preventDefault();
      e.stopPropagation();

      setIsResizing(true);
      resizeStartPos.current = { x: e.clientX, y: e.clientY };
      resizeStartSize.current = { ...size };

      onResizeStart?.();
    },
    [size, isLocked, isMaximized, onResizeStart],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeStartPos.current || !resizeStartSize.current)
        return;

      // Calculate delta accounting for canvas zoom
      const deltaX = (e.clientX - resizeStartPos.current.x) / canvasZoom;
      const deltaY = (e.clientY - resizeStartPos.current.y) / canvasZoom;

      const newSize = {
        width: Math.max(minWidth, resizeStartSize.current.width + deltaX),
        height: Math.max(minHeight, resizeStartSize.current.height + deltaY),
      };

      setSize(newSize);
      onSizeChange?.(newSize);
    },
    [isResizing, canvasZoom, minWidth, minHeight, onSizeChange],
  );

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;

    setIsResizing(false);
    resizeStartPos.current = null;
    resizeStartSize.current = null;

    onResizeEnd?.();
  }, [isResizing, onResizeEnd]);

  // Global mouse event handlers
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
      const handleMouseUp = () => handleDragEnd();

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return {
    position,
    size,
    isDragging,
    isResizing,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    setPosition,
    setSize,
  };
}
