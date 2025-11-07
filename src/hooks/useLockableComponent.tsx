import { useState, useCallback, useEffect, RefObject, ReactNode } from 'react';
import { LockedPlaceholder } from '../components/LockedPlaceholder';

export interface LockableComponentState {
  isLocked: boolean;
  viewportPosition: { x: number; y: number };
}

export interface UseLockableComponentOptions {
  id: string;
  nodeRef: RefObject<HTMLDivElement>;
  initialLocked?: boolean;
  initialLockedZoom?: number;
  initialViewportPosition?: { x: number; y: number };
  initialCanvasPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  // Current position/size (for tracking changes)
  currentPosition?: { x: number; y: number };
  currentSize?: { width: number; height: number };
  canvasZoom?: number;
  canvasOffset?: { x: number; y: number };
  onLockChange?: (locked: boolean) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  updateStore?: (id: string, updates: any) => void;
  // Placeholder configuration
  placeholderVariant?: 'terminal' | 'card' | 'file-viewer' | 'session-manager';
  placeholderName?: string;
  placeholderTerminalType?: string;
  placeholderIcon?: string;
}

/**
 * Hook for managing lockable component behavior
 * Allows components to be locked to viewport position or placed on canvas
 */
export const useLockableComponent = ({
  id,
  nodeRef,
  initialLocked = false,
  initialLockedZoom = 1,
  initialViewportPosition = { x: 0, y: 0 },
  initialCanvasPosition = { x: 0, y: 0 },
  initialSize = { width: 800, height: 600 },
  currentPosition,
  currentSize,
  canvasZoom = 1,
  canvasOffset = { x: 0, y: 0 },
  onLockChange,
  onSizeChange,
  updateStore,
  placeholderVariant = 'card',
  placeholderName = 'Component',
  placeholderTerminalType,
  placeholderIcon
}: UseLockableComponentOptions) => {
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [lockedZoom, setLockedZoom] = useState(initialLockedZoom);
  const [viewportPosition, setViewportPosition] = useState(initialViewportPosition);
  const [position, setPosition] = useState(initialCanvasPosition);
  const [size, setSize] = useState(initialSize);
  const [savedCanvasPosition, setSavedCanvasPosition] = useState(initialCanvasPosition);
  const [savedCanvasSize, setSavedCanvasSize] = useState(initialSize);

  // Use current position/size from component if provided, otherwise use internal state
  const activePosition = currentPosition || position;
  const activeSize = currentSize || size;

  const handleLockToggle = useCallback(() => {
    if (isLocked) {
      // UNLOCK: Restore to saved canvas position immediately (no placement mode)
      setIsLocked(false);
      // Restore the saved canvas position and size
      setPosition(savedCanvasPosition);
      setSize(savedCanvasSize);
      if (onSizeChange) {
        onSizeChange(savedCanvasSize);
      }
      if (updateStore) {
        updateStore(id, {
          isLocked: false,
          size: savedCanvasSize,
          position: savedCanvasPosition,
        });
      }
      if (onLockChange) {
        onLockChange(false);
      }
    } else {
      // LOCK: Save current viewport position
      const rect = nodeRef.current?.getBoundingClientRect();
      if (rect) {
        const viewportPos = { x: rect.left, y: rect.top };
        setViewportPosition(viewportPos);
        // Save current canvas position and size before locking (use active values from component)
        setSavedCanvasPosition(activePosition);
        setSavedCanvasSize(activeSize);
        // Keep the original canvas-space size (don't use visualSize)
        // We'll apply scale(lockedZoom) to this size to get the correct visual size
        setLockedZoom(canvasZoom); // Save current zoom level
        if (updateStore) {
          updateStore(id, {
            isLocked: true,
            viewportPosition: viewportPos,
            position: activePosition, // Save current canvas position
            size: activeSize, // Keep current canvas-space size (not visual size)
            lockedZoom: canvasZoom, // We'll scale this size by lockedZoom in the portal
          });
        }
      }
      setIsLocked(true);
      if (onLockChange) {
        onLockChange(true);
      }
    }
  }, [id, isLocked, nodeRef, onLockChange, updateStore, activePosition, activeSize, savedCanvasPosition, savedCanvasSize, canvasZoom]);

  // Render placeholder on canvas when locked
  const renderPlaceholder = useCallback((): ReactNode => {
    if (!isLocked) return null;

    return (
      <LockedPlaceholder
        id={`${id}-placeholder`}
        variant={placeholderVariant}
        position={savedCanvasPosition}
        size={savedCanvasSize}
        canvasZoom={canvasZoom}
        name={placeholderName}
        terminalType={placeholderTerminalType}
        icon={placeholderIcon}
        onUnlock={handleLockToggle}  // Pass unlock handler to placeholder
      />
    );
  }, [isLocked, id, placeholderVariant, savedCanvasPosition, savedCanvasSize, canvasZoom, placeholderName, placeholderTerminalType, placeholderIcon, handleLockToggle]);

  return {
    isLocked,
    lockedZoom,
    viewportPosition,
    position,
    size,
    handleLockToggle,
    setPosition,
    setSize,
    setViewportPosition,
    setIsLocked,
    setLockedZoom,
    renderPlaceholder,
  };
};