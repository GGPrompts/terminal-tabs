import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import Draggable, { DraggableEvent } from "react-draggable";
import { ResizableBox } from "react-resizable";
import { useAtom } from "jotai";
import {
  terminalPositionAtomFamily,
  terminalSizeAtomFamily,
  terminalZIndexAtomFamily,
  cleanupTerminalAtoms
} from "../atoms/terminals";
import { Terminal } from "./Terminal";
import { ThemeDropdown } from "./ThemeDropdown";
import { DirectorySelector } from "./DirectorySelector";
import { Agent } from "../App";
import {
  terminalThemes,
  getThemeForTerminalType,
} from "../styles/terminal-themes";
import { useCanvasStore, CardState, TerminalState } from "../stores/canvasStore";
import { useUIStore } from "../stores/useUIStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useLockableComponent } from "../hooks/useLockableComponent";
import { AnimatedBackground, StaticBackground } from "../backgrounds";
import { ensureVisiblePosition, calculateSafeSpawnPosition } from "../utils/positionUtils";
import { getTerminalIcon, generateTerminalId, calculateTerminalDimensions, calculateFullscreenDimensions, calculateMaximizedLayout } from "../utils/terminalUtils";
import { AnimatedBackgroundType } from "../utils/backgroundUtils";
import "react-resizable/css/styles.css";
import "./DraggableTerminal.css";

interface DraggableTerminalProps {
  agent: Agent;
  onClose: () => void;
  onCommand: (command: string) => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onPositionChange?: (id: string, position: { x: number; y: number }) => void;
  onSizeChange?: (id: string, size: { width: number; height: number }) => void;
  zIndex: number;
  onFocus: (id: string) => void;
  sidebarOpen?: boolean;
  canvasZoom?: number;
  isDocked?: boolean;
  onUndock?: () => void;
  backgroundType?: AnimatedBackgroundType;
  backgroundTheme?: string;
  staticGradient?: string;
  onCreateCard?: (card: Partial<CardState>) => string | undefined;
  onUpdateAgentEmbedded?: (agentId: string, embedded: boolean) => void;
  initialTheme?: string;
  initialTransparency?: number;
  canvasOffset?: { x: number; y: number };
}

const DraggableTerminalComponent: React.FC<DraggableTerminalProps> = ({
  agent,
  onClose,
  onCommand,
  wsRef,
  initialPosition,
  initialSize,
  onPositionChange,
  onSizeChange,
  zIndex,
  onFocus,
  sidebarOpen = false,
  canvasZoom = 1,
  isDocked = false,
  onUndock,
  backgroundType = "balatro",
  backgroundTheme = "balatro",
  staticGradient = "purple-blue",
  onCreateCard,
  initialTheme,
  initialTransparency,
  canvasOffset,
}) => {
  // Zustand store integration - get viewport first
  const { removeTerminal, addTerminal, updateTerminal, viewport, setViewport, selectItem, isSelected } = useCanvasStore();
  // Only subscribe to our own terminal to reduce re-renders
  // Match by sessionName first (stable across refreshes), then fallback to agentId
  const ownStoredTerminal = useCanvasStore((state) =>
    Array.from(state.terminals.values()).find(t =>
      t.agentId === agent.id ||
      (agent.sessionName && (t.sessionId === agent.sessionName || t.sessionName === agent.sessionName))
    )
  );
  const terminalsMap = useCanvasStore((state) => state.terminals);
  const defaultTerminalSizeFromStore = useSettingsStore((state) => state.defaultTerminalSize);

  // Use provided size or fall back to global default
  const effectiveInitialSize = initialSize || defaultTerminalSizeFromStore || { width: 600, height: 720 };

  // Ensure position is visible in viewport
  const safeInitialPosition = useMemo(() => {
    let basePosition: { x: number; y: number };

    if (initialPosition) {
      // For existing terminals (loaded from storage or turned on), preserve exact position
      // Only clamp to world bounds, do NOT adjust for viewport visibility
      // This allows terminals to stay at their saved positions even if outside current viewport
      const WORLD_MIN = 0;
      const WORLD_MAX = 10000;
      basePosition = {
        x: Math.max(WORLD_MIN, Math.min(initialPosition.x, WORLD_MAX - effectiveInitialSize.width)),
        y: Math.max(WORLD_MIN, Math.min(initialPosition.y, WORLD_MAX - effectiveInitialSize.height)),
      };
      // Return immediately - don't call ensureVisiblePosition for stored terminals
      return basePosition;
    } else {
      // For new terminals, use spawn calculation with proper spacing
      // Note: This branch is rarely hit since initialPosition is always provided by App.tsx
      basePosition = calculateSafeSpawnPosition(
        effectiveInitialSize,
        canvasOffset ? { x: canvasOffset.x, y: canvasOffset.y } : { x: viewport.x, y: viewport.y },
        canvasZoom,
        []
      );

      // Only for NEW terminals (no initialPosition), ensure they spawn in visible viewport
      const visiblePosition = ensureVisiblePosition(
        basePosition,
        effectiveInitialSize,
        canvasOffset || { x: viewport.x, y: viewport.y },
        canvasZoom
      );
      return visiblePosition;
    }
    // IMPORTANT: Only depend on initialPosition and size to prevent flickering
    // When zoom/offset changes, we don't want to recalculate terminal positions!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosition, effectiveInitialSize]);

  // Use Jotai atoms for position and size - each terminal gets its own atom
  // This prevents re-renders of ALL terminals when one terminal moves/resizes
  const [position, setPosition] = useAtom(terminalPositionAtomFamily(agent.id));
  const [size, setSize] = useAtom(terminalSizeAtomFamily(agent.id));

  // Initialize atoms with safe position if not already set
  useEffect(() => {
    if (position.x === 100 && position.y === 100) {
      // For locked terminals on refresh, use stored position to preserve placeholder location
      const storedPos = storedTerminalForInit?.position;
      if (storedPos && storedTerminalForInit?.isLocked) {
        setPosition(storedPos);
      } else {
        // Default position, set to safe initial position
        setPosition(safeInitialPosition);
      }
    }
    if (size.width === 800 && size.height === 600) {
      // For locked terminals, use stored size
      const storedSize = storedTerminalForInit?.size;
      if (storedSize && storedTerminalForInit?.isLocked) {
        setSize(storedSize);
      } else {
        // Default size, set to effective initial size
        setSize(effectiveInitialSize);
      }
    }
  }, []);
  const [isMaximized, setIsMaximized] = useState(false);
  const isFullscreenMode = useUIStore((state) => state.isFullscreenMode);
  const toggleFullscreenMode = useUIStore((state) => state.toggleFullscreenMode);
  const [savedState, setSavedState] = useState<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const [dragKey, setDragKey] = useState(0);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Get global defaults from settings store
  const terminalDefaultFontSize = useSettingsStore((state) => state.terminalDefaultFontSize);
  const terminalDefaultTransparency = useSettingsStore((state) => state.terminalDefaultTransparency);
  const terminalDefaultTheme = useSettingsStore((state) => state.terminalDefaultTheme);
  const terminalDefaultFontFamily = useSettingsStore((state) => state.terminalDefaultFontFamily);
  const defaultTerminalSize = useSettingsStore((state) => state.defaultTerminalSize);

  // Calculate minimum constraints based on default terminal size (50% of default)
  const minConstraints = useMemo<[number, number]>(() => {
    const minWidth = Math.floor(defaultTerminalSize.width * 0.5);
    const minHeight = Math.floor(defaultTerminalSize.height * 0.5);
    return [minWidth, minHeight];
  }, [defaultTerminalSize]);

  // Always check store first for saved theme/font
  const storedTerminal = Array.from(terminalsMap.values()).find(t => t.agentId === agent.id);
  const storedTerminalTheme = storedTerminal?.theme;
  const storedFontFamily = storedTerminal?.fontFamily;

  const [currentTheme, setCurrentTheme] = useState<string>(
    storedTerminalTheme || initialTheme || terminalDefaultTheme || agent.terminalType,
  );
  const [themeOverridden, setThemeOverridden] = useState(!!storedTerminalTheme);

  const [terminalOpacity, setTerminalOpacity] = useState(
    initialTransparency ?? terminalDefaultTransparency ?? 0.1,
  );
  const [transparencyOverridden, setTransparencyOverridden] = useState(initialTransparency !== undefined);

  const [terminalFontSize, setTerminalFontSize] = useState(terminalDefaultFontSize);
  const [fontOverridden, setFontOverridden] = useState(false);

  const [terminalFontFamily, setTerminalFontFamily] = useState<string>(
    storedFontFamily || terminalDefaultFontFamily || 'monospace'
  );
  const [fontFamilyOverridden, setFontFamilyOverridden] = useState(!!storedFontFamily);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const selected = isSelected(agent.id);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const resizeStartMouse = useRef<{ x: number; y: number } | null>(null);
  const resizeStartSize = useRef<{ width: number; height: number } | null>(
    null,
  );
  const resizeRaf = useRef<number | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const hasInitializedFromStore = useRef(false);
  const [xtermTitle, setXtermTitle] = useState<string | null>(null);
  const [useXtermTitle, setUseXtermTitle] = useState(true);
  const [showHeader, setShowHeader] = useState(true);

  // Display title is either xterm title (if available and enabled) or agent name
  const displayTitle = useXtermTitle && xtermTitle ? xtermTitle : agent.name;

  // Use the optimized subscription for initial values
  const storedTerminalForInit = ownStoredTerminal;

  // Track if terminal was previously docked to detect transitions
  const wasDockedRef = useRef(isDocked);
  const terminalInstanceRef = useRef<any>(null);

  // Use the lockable component hook
  const { isLocked, lockedZoom, viewportPosition, handleLockToggle: hookHandleLockToggle, renderPlaceholder } = useLockableComponent({
    id: agent.id,
    nodeRef,
    initialLocked: storedTerminalForInit?.isLocked || false,
    initialLockedZoom: storedTerminalForInit?.lockedZoom || 1,
    initialViewportPosition: storedTerminalForInit?.viewportPosition || { x: 100, y: 100 },
    initialCanvasPosition: storedTerminalForInit?.position || position,  // Use stored position for locked placeholder
    initialSize: storedTerminalForInit?.size || size,
    currentPosition: position,  // Pass current position for accurate placeholder
    currentSize: size,          // Pass current size for accurate placeholder
    canvasZoom,
    canvasOffset,
    onLockChange: (locked) => {
      // Update terminal in store when lock state changes
      const storedTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (storedTerminal) {
        updateTerminal(storedTerminal.id, { isLocked: locked });
      }
    },
    onSizeChange: (newSize) => {
      // Update Jotai atom when size changes from unlock
      setSize(newSize);
      onSizeChange?.(agent.id, newSize);
    },
    updateStore: (id, updates) => {
      const storedTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (storedTerminal) {
        updateTerminal(storedTerminal.id, updates);
      }
    },
    // Placeholder configuration
    placeholderVariant: 'terminal',
    placeholderName: agent.name,
    placeholderTerminalType: agent.terminalType,
  });


  // Icon view removed - terminals always show at all zoom levels
  const showIconView = false;

  // Helper function to update terminal settings in store
  const updateTerminalSettings = (updates: {
    theme?: string;
    transparency?: number;
    fontSize?: number;
    fontFamily?: string;
  }) => {
    const storedTerminal = Array.from(terminalsMap.values()).find(
      (t) => t.agentId === agent.id,
    );
    if (storedTerminal) {
      updateTerminal(storedTerminal.id, updates);
    }
  };

  // Sync position, size, and lock state from store on initial load or when docking state changes
  useEffect(() => {
    // Skip if we've already initialized from store UNLESS docking state changed
    // We want to reload theme when switching between embedded/canvas
    if (hasInitializedFromStore.current && !isDocked) return;

    // First try to match by agentId, then fallback to name+type for page refresh scenarios
    let storedTerminal = Array.from(terminalsMap.values()).find(
      (t) => t.agentId === agent.id,
    );
    if (!storedTerminal) {
      // On page refresh, agentIds are new, so match by name and type
      storedTerminal = Array.from(terminalsMap.values()).find(
        (t) =>
          t.name === agent.name &&
          t.terminalType === agent.terminalType &&
          t.isOn,
      );
      // If we found a match AND it doesn't already have the correct agentId, update it
      if (storedTerminal && storedTerminal.agentId !== agent.id) {
        updateTerminal(storedTerminal.id, { agentId: agent.id });
      }
    }

    if (storedTerminal) {
      // Only mark as initialized if not docked (so we reload when switching)
      if (!isDocked) {
        hasInitializedFromStore.current = true;
      }

      // CRITICAL: Always load theme/transparency/font regardless of docked state
      // These settings should persist across embedded/canvas transitions
      if (storedTerminal.theme) {
        setCurrentTheme(storedTerminal.theme);
        setThemeOverridden(true);
      }
      if (storedTerminal.transparency !== undefined) {
        setTerminalOpacity(storedTerminal.transparency);
        setTransparencyOverridden(true);
      }
      if (storedTerminal.fontSize !== undefined) {
        setTerminalFontSize(storedTerminal.fontSize);
        setFontOverridden(true);
      }

      // Only load position/size for non-docked terminals
      // Lock state is managed by useLockableComponent hook
      if (!isDocked) {
        if (storedTerminal.position) {
          setPosition(storedTerminal.position);
        }
        if (storedTerminal.size) setSize(storedTerminal.size);
      }
    }
  }, [
    terminalsMap,
    agent.id,
    agent.name,
    agent.terminalType,
    onCreateCard,
    canvasZoom,
    updateTerminal,
    isDocked, // Re-run when docking state changes to load theme
  ]);

  // Keep local font size in sync with global default when not overridden
  useEffect(() => {
    if (!fontOverridden) {
      setTerminalFontSize(terminalDefaultFontSize);
    }
  }, [terminalDefaultFontSize, fontOverridden]);

  // Listen for global font size changes and reflect in slider when not overridden
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (!fontOverridden && e?.detail?.fontSize) {
        setTerminalFontSize(e.detail.fontSize);
      }
    };
    window.addEventListener("terminalFontSizeChange", handler as any);
    return () => window.removeEventListener("terminalFontSizeChange", handler as any);
  }, [fontOverridden]);

  // Keep local theme in sync with global default when not overridden
  useEffect(() => {
    if (!themeOverridden) {
      setCurrentTheme(terminalDefaultTheme || agent.terminalType);
      if (terminalRef.current) {
        terminalRef.current.updateTheme(terminalDefaultTheme || agent.terminalType);
      }
    }
  }, [terminalDefaultTheme, themeOverridden, agent.terminalType]);

  // Keep local transparency in sync with global default when not overridden
  useEffect(() => {
    if (!transparencyOverridden) {
      setTerminalOpacity(terminalDefaultTransparency ?? 0.1);
      if (terminalRef.current) {
        terminalRef.current.updateOpacity(terminalDefaultTransparency ?? 0.1);
      }
    }
  }, [terminalDefaultTransparency, transparencyOverridden]);

  const handleDragStop = useCallback(
    (_e: DraggableEvent, data: { x: number; y: number }) => {
      const finalPos = { x: data.x, y: data.y };
      setPosition(finalPos);
      onPositionChange?.(agent.id, finalPos);
      // Update store if terminal exists there (for offline terminals)
      const storedTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (storedTerminal) {
        updateTerminal(storedTerminal.id, { position: finalPos });
      }
    },
    [agent.id, onPositionChange, terminalsMap, updateTerminal],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartMouse.current = { x: e.clientX, y: e.clientY };
      resizeStartSize.current = { ...size };
    },
    [size],
  );

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!resizeStartMouse.current || !resizeStartSize.current) return;
      // Adjust deltas by canvasZoom so the handle tracks the cursor when zoomed
      const deltaX =
        (e.clientX - resizeStartMouse.current.x) / (canvasZoom || 1);
      const deltaY =
        (e.clientY - resizeStartMouse.current.y) / (canvasZoom || 1);
      // Let ResizableBox handle minimum constraints for consistency
      const newWidth = resizeStartSize.current.width + deltaX;
      const newHeight = resizeStartSize.current.height + deltaY;

      // Throttle BOTH atom update and event dispatch via RAF to reduce re-renders
      if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = requestAnimationFrame(() => {
        // Update Jotai atom (throttled to ~60fps instead of every mousemove)
        setSize({ width: newWidth, height: newHeight });

        // Notify terminal to refit; Terminal.tsx will compute exact cols/rows after fit
        console.log(`[DraggableTerminal] Dispatching resize event for ${agent.id}, size: ${newWidth}x${newHeight}`);
        window.dispatchEvent(
          new CustomEvent("terminal-container-resized", {
            detail: { id: agent.id },
          }),
        );
      });
    },
    [agent.id, canvasZoom, setSize],
  );

  const handleResizeStop = useCallback(() => {
    setIsResizing(false);
    resizeStartMouse.current = null;
    resizeStartSize.current = null;
    if (resizeRaf.current) {
      cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = null;
    }

    // Don't update Zustand while locked - locked size is temporary UI state
    // The canvas size (savedCanvasSize) will be restored on unlock
    if (!isLocked) {
      onSizeChange?.(agent.id, { width: size.width, height: size.height });
      // Update store if terminal exists there (for offline terminals)
      const storedTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (storedTerminal) {
        updateTerminal(storedTerminal.id, {
          size: { width: size.width, height: size.height },
        });
      }
    }
    // Let the embedded Terminal fit itself and send exact cols/rows
    // Dispatch now and again on next frame to ensure layout has settled
    window.dispatchEvent(
      new CustomEvent("terminal-container-resized", {
        detail: { id: agent.id },
      }),
    );
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent("terminal-container-resized", {
          detail: { id: agent.id },
        }),
      );
    });
  }, [
    agent.id,
    onSizeChange,
    size.width,
    size.height,
    terminalsMap,
    updateTerminal,
    isLocked,
  ]);

  const toggleMaximize = useCallback(() => {
    if (isMaximized && savedState) {
      // Restore
      setPosition(savedState.position);
      setSize(savedState.size);
      setIsMaximized(false);
      // Exit fullscreen mode if active
      if (isFullscreenMode) {
        toggleFullscreenMode();
      }
      // Force re-render to apply restored position
      setDragKey((k) => k + 1);

      // Notify terminal of size change after restore - Terminal.tsx will handle the actual resize
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("terminal-container-resized", {
            detail: { id: agent.id },
          }),
        );
      }, 100);
    } else {
      // Don't allow maximize when locked - user should unlock first
      if (isLocked) {
        console.warn('Cannot maximize a locked terminal. Please unlock first.');
        return;
      }

      // Maximize - save current state and expand on canvas
      setSavedState({ position, size });
      setIsMaximized(true);

      // Calculate maximized size (accounting for header and sidebar)
      const headerHeight = 60;
      const sidebarWidth = sidebarOpen ? 360 : 0;
      const margin = 20;

      // Available viewport space
      const viewportWidth = window.innerWidth - sidebarWidth;
      const viewportHeight = window.innerHeight - headerHeight;

      // Terminal size (leave some margin)
      const maxWidth = viewportWidth - (margin * 2);
      const maxHeight = viewportHeight - (margin * 2);

      // Get current canvas offset and zoom from props or use defaults
      const currentCanvasOffset = canvasOffset || { x: 0, y: 0 };
      const currentCanvasZoom = canvasZoom || 1;

      // Calculate position to center in current viewport
      // We want the terminal to appear centered in the visible viewport
      // Canvas position = (-canvasOffset + screenPosition) / zoom
      const canvasX = (-currentCanvasOffset.x + sidebarWidth + margin) / currentCanvasZoom;
      const canvasY = (-currentCanvasOffset.y + headerHeight + margin) / currentCanvasZoom;

      setPosition({ x: canvasX, y: canvasY });
      setSize({ width: Math.min(maxWidth, 1400) / currentCanvasZoom, height: maxHeight / currentCanvasZoom });

      // Force re-render to apply new position
      setDragKey((k) => k + 1);

      // Enter fullscreen mode using the global toggle
      if (!isFullscreenMode) {
        toggleFullscreenMode();
      }

      // Focus on the terminal and bring to highest z-index
      onFocus(agent.id);

      // Notify terminal of fullscreen size after a brief delay - Terminal.tsx will handle the actual resize
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("terminal-container-resized", {
            detail: { id: agent.id },
          }),
        );
      }, 100);
    }
  }, [isMaximized, savedState, isFullscreenMode, toggleFullscreenMode, onFocus, agent.id, wsRef, size, position, isLocked, canvasOffset, canvasZoom]);

  // Calculate maximized layout for portal rendering
  // Don't update canvas position/size since we're using a portal
  const getMaximizedDimensions = useCallback(() => {
    const { dimensions } = calculateMaximizedLayout(sidebarOpen || false);

    // Just dispatch the resize event - Terminal.tsx will handle the actual resize
    window.dispatchEvent(
      new CustomEvent("terminal-container-resized", {
        detail: { id: agent.id },
      }),
    );

    return dimensions;
  }, [sidebarOpen, agent.id]);

  // Recalculate maximized dimensions if sidebar visibility changes while maximized
  useEffect(() => {
    if (!isMaximized || !isFullscreenMode) return; // Only apply when using portal
    getMaximizedDimensions();
    const t = setTimeout(() => getMaximizedDimensions(), 320); // after CSS transition (~250ms)
    return () => clearTimeout(t);
  }, [sidebarOpen, isMaximized, isFullscreenMode, getMaximizedDimensions]);

  // Recalculate on window resize while maximized
  useEffect(() => {
    if (!isMaximized || !isFullscreenMode) return; // Only apply when using portal
    const onResize = () => getMaximizedDimensions();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMaximized, isFullscreenMode, getMaximizedDimensions]);

  // Auto-restore terminal when fullscreen mode is turned off externally
  useEffect(() => {
    if (isMaximized && !isFullscreenMode && savedState && !isLocked) {
      // Fullscreen was turned off but terminal is still maximized - restore it
      // But only if not locked (locked terminals have their own positioning)
      setPosition(savedState.position);
      setSize(savedState.size);
      setIsMaximized(false);
      setDragKey((k) => k + 1);
    }
  }, [isFullscreenMode, isMaximized, savedState, isLocked]);

  // Detect dock/undock transitions and preserve terminal instance
  useEffect(() => {
    if (wasDockedRef.current !== isDocked) {
      wasDockedRef.current = isDocked;

      // Don't force re-render on detach - this was causing terminal destruction
      // Instead, maintain the same Terminal component instance
      if (!isDocked && terminalInstanceRef.current) {
      }

      // Send reset command to TUI tools to fix rendering issues after ANY dock state change
      if (agent.terminalType === 'tui-tool' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const toolName = (agent as any).toolName || agent.name;

        // Different TUI tools need different refresh commands
        setTimeout(() => {
          if (toolName === 'pyradio') {
            // For PyRadio: Send multiple commands to restore proper state
            // First, send ESC to ensure we're not in any submenu
            wsRef.current?.send(JSON.stringify({
              type: 'command',
              terminalId: agent.id,
              command: '\x1B' // ESC
            }));

            // Then send Ctrl+L to redraw screen
            setTimeout(() => {
              wsRef.current?.send(JSON.stringify({
                type: 'command',
                terminalId: agent.id,
                command: '\x0C' // Ctrl+L
              }));
            }, 50);

            // Force resize to trigger PyRadio's internal recalculation
            setTimeout(() => {
              wsRef.current?.send(JSON.stringify({
                type: 'resize',
                terminalId: agent.id,
                cols: 80,
                rows: 24
              }));
            }, 100);
          } else if (toolName === 'spotify') {
            // For Spotify: Send Ctrl+L to redraw screen
            wsRef.current?.send(JSON.stringify({
              type: 'command',
              terminalId: agent.id,
              command: '\x0C' // Ctrl+L (form feed/clear screen)
            }));
          } else if (toolName === 'mc' || toolName === 'file-manager') {
            // For MC: Send Ctrl+L to refresh panels
            wsRef.current?.send(JSON.stringify({
              type: 'command',
              terminalId: agent.id,
              command: '\x0C' // Ctrl+L
            }));
          } else if (toolName === 'bottom') {
            // For bottom: Just resize should be enough
            wsRef.current?.send(JSON.stringify({
              type: 'resize',
              terminalId: agent.id,
              cols: 80,
              rows: 24
            }));
          } else {
            // Generic refresh for other TUI tools
            wsRef.current?.send(JSON.stringify({
              type: 'command',
              terminalId: agent.id,
              command: '\x0C' // Ctrl+L
            }));
          }
        }, 200); // Slightly longer delay to ensure terminal has settled
      }
    }
  }, [isDocked, agent.id, agent.terminalType, wsRef]);

  // Cleanup Jotai atoms on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      const storedTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (storedTerminal) {
        cleanupTerminalAtoms(storedTerminal.id);
      }
    };
  }, [agent.id, terminalsMap]);

  const handleFocus = (e?: React.MouseEvent) => {
    // Prevent event from bubbling to canvas
    if (e) {
      e.stopPropagation();
    }

    onFocus(agent.id);

    // Focus the xterm instance with a small delay to ensure it's ready
    setTimeout(() => {
      try {
        if (
          terminalRef.current &&
          typeof terminalRef.current.focus === "function"
        ) {
          terminalRef.current.focus();
        }
      } catch (err) {
      }
    }, 10);
  };

  // Header click handler that doesn't stop propagation (allows dragging)
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // DON'T stop propagation here - it breaks react-draggable!
    // The canvas mouse handler should check for .terminal-drag-handle instead

    // Focus the wrapper element to trigger :focus-within CSS
    // This makes the orange border appear while preserving dragging
    if (nodeRef.current) {
      nodeRef.current.focus();
    }
    onFocus(agent.id);
  };

  // Click-to-select handler
  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent canvas deselect
    if (e.shiftKey) {
      selectItem(agent.id, true); // Multi-select
    } else {
      selectItem(agent.id, false); // Single select
    }
  }, [agent.id, selectItem]);

  // Wrapper for lock toggle that respects maximized state
  const handleCustomLockToggle = useCallback((e?: React.MouseEvent) => {
    if (e) {
      // Stop event propagation to prevent triggering other UI elements
      e.stopPropagation();
      e.preventDefault();
    }

    // Don't allow locking when maximized
    if (isMaximized) {
      console.warn('Cannot lock a maximized terminal. Please restore first.');
      return;
    }

    // Use the hook's toggle function
    hookHandleLockToggle();
  }, [isMaximized, hookHandleLockToggle]);

  // Memoize button handlers to prevent stale closures after state transitions
  const handleThemeToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowThemePicker(prev => !prev);
  }, []);

  const handlePowerOff = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // Maximize functionality removed - use Command Dispatcher instead

    const existingStored = Array.from(terminalsMap.values()).find(
      (t) => t.agentId === agent.id || (t.lastAgentId === agent.id && !t.isOn)
    );


    // Also check for duplicate offline terminals with same name
    const duplicateOfflineTerminals = Array.from(terminalsMap.values()).filter(
      (t) => !t.isOn && t.name === agent.name && t.id !== existingStored?.id
    );

    if (duplicateOfflineTerminals.length > 0) {
      duplicateOfflineTerminals.forEach(dup => {
        removeTerminal(dup.id);
      });
    }

    if (existingStored) {
      // Update the existing terminal to offline state
      updateTerminal(existingStored.id, {
        position: isDocked ? existingStored.position : position,  // Keep original position if docked
        size: size,
        theme: currentTheme,
        transparency: terminalOpacity,
        isOn: false,
        agentId: undefined,  // Disconnect from live agent
        embedded: isDocked ? true : false,  // Preserve embedded state if docked
        isLocked: false,
        viewportPosition: undefined,
        workingDir: agent.workingDir,
        sessionId: agent.sessionId,
        startCommand: (agent as any).startCommand || (agent as any).commands?.[0],
        toolName: agent.toolName,
      });
    } else {
      // Create a new offline terminal entry if one doesn't exist
      const newTerminal: TerminalState = {
        id: `${agent.id}-offline-${Date.now()}`,
        agentId: undefined,  // No live agent connected
        lastAgentId: agent.id,  // Remember the original agent ID
        name: agent.name,
        terminalType: agent.terminalType,
        position: isDocked ? { x: 100, y: 100 } : position,  // Default position if docked
        size: size,
        isOn: false,  // Terminal is off
        embedded: isDocked ? true : false,  // Preserve embedded state if docked
        theme: currentTheme,
        transparency: terminalOpacity,
        isLocked: false,
        viewportPosition: { x: 0, y: 0 },
        zIndex: zIndex,
        isMaximized: false,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        workingDir: agent.workingDir,
        sessionId: agent.sessionId,
        startCommand: (agent as any).startCommand || (agent as any).commands?.[0],
        toolName: agent.toolName,
      };
      addTerminal(newTerminal);
    }

    // Detach from terminal but preserve tmux session
    console.log('[DraggableTerminal] Power off - detaching from terminal (preserving tmux session:', agent.sessionId, ')');

    // Send 'detach' message instead of 'close' to preserve tmux session
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'detach',
        terminalId: agent.id
      }));
    }
  }, [
    agent.id,
    agent.name,
    agent.terminalType,
    agent.workingDir,
    agent.sessionId,
    agent.toolName,
    isMaximized,
    toggleMaximize,
    position,
    size,
    currentTheme,
    terminalOpacity,
    terminalsMap,
    updateTerminal,
    addTerminal,
    removeTerminal,
    isDocked,
    onClose
  ]);

  const handleClose = useCallback(() => {
    const storedTerminal = Array.from(terminalsMap.values()).find(
      (t) => t.agentId === agent.id,
    );
    if (storedTerminal) {
      cleanupTerminalAtoms(storedTerminal.id); // Cleanup Jotai atoms to prevent memory leaks
      removeTerminal(storedTerminal.id);
    }
    onClose();
  }, [agent.id, terminalsMap, removeTerminal, onClose]);

  // Get all documentation cards for this terminal
  const getAttachedDocumentCards = useCallback(() => {
    const cardsMap = useCanvasStore.getState().cards;
    const terminalStoreId = Array.from(terminalsMap.values()).find(
      (t) => t.agentId === agent.id
    )?.id;

    if (!terminalStoreId) return [];

    // Find all cards that are widget docs for this terminal
    const docCards = Array.from(cardsMap.values()).filter(card =>
      card.id.startsWith(`widget-doc-${terminalStoreId}-`)
    );

    return docCards;
  }, [agent.id, terminalsMap]);

  const handleFilePickerToggle = useCallback(() => {
    setShowFilePicker(prev => !prev);
  }, []);

  // Render placeholder on canvas when locked
  const placeholder = renderPlaceholder();

  // Render maximized terminal with animated background ONLY in fullscreen mode
  if (isMaximized && isFullscreenMode) {
    const headerHeight = 60;
    const margin = 20;

    return createPortal(
      <div
        className="terminal-maximized-overlay"
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
        {/* Background - static or animated based on settings */}
        {backgroundTheme === 'none' ? (
          <StaticBackground gradientType={staticGradient} />
        ) : (
          <AnimatedBackground
            type={backgroundType || "balatro"}
          />
        )}

        <div
          ref={nodeRef}
          className="draggable-terminal-wrapper maximized fullscreen"
          data-terminal-type={agent.terminalType}
          data-terminal-id={agent.id}
          tabIndex={-1}
          onClick={handleSelectClick}
          style={{
            position: "relative",
            maxWidth: "1600px",
            width: "90%",
            maxHeight: `calc(100vh - ${headerHeight + margin * 2}px)`,
            height: "85vh",
            zIndex: 1,
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
            borderRadius: '12px',
          }}
        >
          <div
            className="draggable-terminal-container"
            style={{
              width: "100%",
              height: "100%",
              background: `rgba(0, 0, 0, ${terminalOpacity})`,
              borderRadius: "12px",
            }}
          >
            {showHeader && (
              <div className="terminal-drag-handle">
                <div className="drag-indicator">⋮⋮</div>
                <div className="terminal-header-info">
                  <span className="terminal-name">
                    <span style={{ marginRight: '6px' }}>{getTerminalIcon(agent.terminalType, agent.name)}</span>
                    {xtermTitle || agent.name}
                  </span>
                  <span className="terminal-type">({agent.terminalType})</span>
                </div>
                <div className="terminal-window-controls">
                  <button
                    ref={themeButtonRef}
                    className="window-control-btn theme-btn"
                    onClick={handleThemeToggle}
                    title="Customize theme"
                  >
                    🎨
                  </button>
                  {showThemePicker && (
                    <ThemeDropdown
                      isOpen={showThemePicker}
                      onClose={() => setShowThemePicker(false)}
                      currentTheme={currentTheme}
                      currentOpacity={terminalOpacity}
                      currentFontSize={terminalFontSize}
                      currentFontFamily={terminalFontFamily}
                      onThemeSelect={(theme) => {
                        setCurrentTheme(theme);
                        terminalRef.current?.updateTheme(theme);
                        updateTerminalSettings({ theme });
                      }}
                      onOpacityChange={(opacity) => {
                        setTransparencyOverridden(true);
                        setTerminalOpacity(opacity);
                        updateTerminalSettings({ transparency: opacity });
                        if (terminalRef.current) {
                          terminalRef.current.updateOpacity(opacity);
                        }
                      }}
                      onFontSizeChange={(fontSize) => {
                        setFontOverridden(true);
                        setTerminalFontSize(fontSize);
                        terminalRef.current?.updateFontSize(fontSize);
                        updateTerminalSettings({ fontSize });
                      }}
                      onFontFamilyChange={(fontFamily) => {
                        setFontFamilyOverridden(true);
                        setTerminalFontFamily(fontFamily);
                        terminalRef.current?.updateFontFamily(fontFamily);
                        updateTerminalSettings({ fontFamily });
                      }}
                      buttonRef={themeButtonRef}
                    />
                  )}
                  <button
                    className="window-control-btn"
                    onClick={toggleMaximize}
                    title="Exit fullscreen"
                  >
                    ◱
                  </button>
                  <button
                    className="window-control-btn close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            <div
              className="terminal-viewport"
              style={{
                height: showHeader ? "calc(100% - 40px)" : "100%",
                width: "100%",
              }}
            >
              <Terminal
                ref={terminalRef}
                initialFontSize={fontOverridden ? terminalFontSize : undefined}
                agent={agent}
                onClose={handleClose}
                onCommand={onCommand}
                wsRef={wsRef}
                embedded={true}
                initialTheme={currentTheme}
                initialOpacity={terminalOpacity}
                canvasZoom={1} // Always 1 in fullscreen mode
                mountKey={agent.id}
                onTitleChange={setXtermTitle}
                isSelected={selected}
              />
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Render locked terminal in a portal with fixed positioning
  // NOTE: Locked terminals cannot be maximized - the maximize button is disabled
  if (isLocked && !isMaximized) {
    // Constrain locked position to viewport bounds
    const constrainedPosition = {
      x: Math.max(0, Math.min(window.innerWidth - size.width, viewportPosition.x)),
      y: Math.max(0, Math.min(window.innerHeight - size.height, viewportPosition.y))
    };

    const content = (
      <div
        ref={nodeRef}
        className={`draggable-terminal-wrapper locked ${isMaximized ? "maximized" : ""}`}
        data-terminal-type={agent.terminalType}
        data-terminal-id={agent.id}
        tabIndex={-1}
        onClick={handleSelectClick}
        style={{
          position: "fixed",
          left: isMaximized ? 20 : constrainedPosition.x,
          top: isMaximized ? "calc(3.5rem + 20px)" : constrainedPosition.y,
          right: isMaximized ? 20 : undefined,
          bottom: isMaximized ? 20 : undefined,
          zIndex: isMaximized ? 1000 : 10000, // Reasonable z-index for locked terminals
          outline: selected ? '2px solid #3b82f6' : 'none',
          outlineOffset: '2px',
          borderRadius: '12px',
          transform: `scale(${lockedZoom})`,
          transformOrigin: 'top left',
        }}
      >
        <ResizableBox
          width={isMaximized ? window.innerWidth - 40 : size.width}
          height={isMaximized ? window.innerHeight - 120 : size.height} // Account for nav header and padding
          onResizeStop={handleResizeStop}
          minConstraints={minConstraints}
          maxConstraints={[window.innerWidth - 50, window.innerHeight - 50]}
          resizeHandles={isMaximized ? [] : ["se"]}
          className="resizable-terminal"
        >
          <div
            className="draggable-terminal-container"
            style={{
              background: `rgba(0, 0, 0, ${terminalOpacity})`, // Same as unlocked terminals
            }}
          >
            {showHeader ? (
            <div className="terminal-drag-handle" style={{ cursor: "default" }}>
              <div className="drag-indicator">⋮⋮</div>
              <div className="terminal-header-info">
                <span className="terminal-name">
                  <span style={{ marginRight: '6px' }}>{getTerminalIcon(agent.terminalType, agent.name)}</span>
                  {displayTitle}
                  {xtermTitle && (
                    <button
                      className="window-control-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setUseXtermTitle(!useXtermTitle);
                      }}
                      title={useXtermTitle ? "Show static name" : "Show xterm title"}
                      style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        padding: '2px 6px',
                        background: useXtermTitle ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                        minWidth: '24px',
                        height: '20px'
                      }}
                    >
                      {useXtermTitle ? '📝' : '🏷️'}
                    </button>
                  )}
                </span>
                <span className="terminal-type">({agent.terminalType})</span>
                {agent.embedded && (
                  <span
                    className="terminal-embedded-badge"
                    style={{
                      marginLeft: "8px",
                      padding: "2px 6px",
                      background: "rgba(255, 215, 0, 0.2)",
                      border: "1px solid rgba(255, 215, 0, 0.5)",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#ffd700",
                    }}
                  >
                    📡 Connected to Dispatcher
                  </span>
                )}
              </div>
              <div className="terminal-window-controls">
                <button
                  className="window-control-btn lock-btn"
                  onClick={handleCustomLockToggle}
                  title="Unlock and return to canvas"
                  style={{ opacity: 1 }}
                >
                  🔒
                </button>
                <button
                  ref={themeButtonRef}
                  className="window-control-btn theme-btn"
                  onClick={handleThemeToggle}
                  title="Customize theme"
                >
                  🎨
                </button>
                <ThemeDropdown
                  isOpen={showThemePicker}
                  onClose={() => setShowThemePicker(false)}
                  currentTheme={currentTheme}
                  currentOpacity={terminalOpacity}
                  currentFontSize={terminalFontSize}
                  currentFontFamily={terminalFontFamily}
                  onOpacityChange={(opacity) => {
                    setTransparencyOverridden(true);
                    setTerminalOpacity(opacity);
                    updateTerminalSettings({ transparency: opacity });
                    if (terminalRef.current) {
                      terminalRef.current.updateOpacity(opacity);
                    }
                  }}
                  onFontSizeChange={(fontSize) => {
                    setFontOverridden(true);
                    setTerminalFontSize(fontSize);
                    updateTerminalSettings({ fontSize });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontSize(fontSize);
                    }
                  }}
                  onFontSizeReset={() => {
                    setFontOverridden(false);
                    setTerminalFontSize(terminalDefaultFontSize);
                    updateTerminalSettings({ fontSize: undefined });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontSize(
                        terminalDefaultFontSize,
                      );
                    }
                  }}
                  onFontFamilyChange={(fontFamily) => {
                    setFontFamilyOverridden(true);
                    setTerminalFontFamily(fontFamily);
                    updateTerminalSettings({ fontFamily });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontFamily(fontFamily);
                    }
                  }}
                  onThemeSelect={(key) => {
                    setThemeOverridden(true);
                    setCurrentTheme(key);
                    updateTerminalSettings({ theme: key });
                    if (terminalRef.current) {
                      terminalRef.current.updateTheme(key);
                    }
                    // Theme change already triggers fit/refresh in Terminal.tsx
                    // No need for manual resize event
                  }}
                  buttonRef={themeButtonRef}
                />
                <button
                  className="window-control-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowHeader(!showHeader);
                  }}
                  title={showHeader ? "Hide header (for TUI tools like MC)" : "Show header"}
                  style={{ fontSize: '14px', padding: '2px 6px' }}
                >
                  {showHeader ? '🔽' : '🔼'}
                </button>
                <button
                  className="window-control-btn power-off-btn"
                  onClick={handlePowerOff}
                  title="Power off terminal (preserves state)"
                >
                  ⏻
                </button>
                <button
                  className="window-control-btn close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleClose();
                  }}
                  title="Close terminal permanently"
                >
                  ✕
                </button>
              </div>
            </div>
            ) : (
              <button
                className="window-control-btn"
                onClick={() => setShowHeader(true)}
                title="Show header"
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  zIndex: 10,
                  background: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                🔼
              </button>
            )}
            {showIconView ? (
              // Icon view when zoomed out (scale text inversely with canvas zoom for readability)
              (() => {
                // Scale relative to the terminal box and compensate for zoom (within bounds)
                const base = Math.min(size.width, size.height);
                const zoomComp = Math.min(1 / (canvasZoom || 1), 4);
                const iconSize = Math.min(
                  base * 0.6 * zoomComp,
                  base * 0.95,
                  280,
                );
                // Fixed size for better readability at low zoom
                const titleSize = 24; // Fixed 24px for terminal name
                const typeSize = 16; // Fixed 16px for terminal type
                const pillSize = Math.max(
                  12,
                  Math.min(20, base * 0.055 * zoomComp),
                );
                const pillPadV = Math.max(
                  6,
                  Math.min(14, base * 0.03 * zoomComp),
                );
                const pillPadH = Math.max(
                  14,
                  Math.min(24, base * 0.04 * zoomComp),
                );
                return (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `rgba(0, 0, 0, ${terminalOpacity})`,
                      color: "#ffffff",
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: iconSize + "px",
                        marginBottom: "20px",
                        filter:
                          "drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))",
                        animation: "pulse 2s infinite",
                      }}
                    >
                      {getTerminalIcon(agent.terminalType, agent.name)}
                    </div>
                    <div
                      style={{
                        fontSize: titleSize + "px",
                        fontWeight: "bold",
                        marginBottom: "8px",
                        textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                        maxWidth: "90%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {displayTitle}
                    </div>
                    <div
                      style={{
                        fontSize: typeSize + "px",
                        opacity: 0.8,
                        marginBottom: "16px",
                      }}
                    >
                      {agent.terminalType}
                    </div>
                    <div
                      style={{
                        fontSize: pillSize + "px",
                        opacity: 0.6,
                        padding: `${pillPadV}px ${pillPadH}px`,
                        background: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "20px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      Zoom in to view terminal
                    </div>
                  </div>
                );
              })()
            ) : (
              <Terminal
                key={`terminal-${agent.id}`}  // Add key to prevent re-initialization on lock/unlock
                ref={terminalRef}
                initialFontSize={fontOverridden ? terminalFontSize : undefined}
                agent={agent}
                onCommand={onCommand}
                onClose={onClose}
                wsRef={wsRef}
                embedded
                initialTheme={currentTheme}
                initialOpacity={terminalOpacity}
                canvasZoom={canvasZoom}
                onTitleChange={setXtermTitle}
                isSelected={selected}
              />
            )}
          </div>
        </ResizableBox>
      </div>
    );

    return (
      <>
        {placeholder}
        {createPortal(content, document.body)}
      </>
    );
  }


  // If docked, render into the dock area using a portal
  if (isDocked) {
    const dockElement = document.getElementById("terminal-dock");
    if (dockElement) {
      return createPortal(
        <div
          className="draggable-terminal-wrapper docked"
          data-terminal-type={agent.terminalType}
          data-terminal-id={agent.id}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            zIndex,
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
            borderRadius: '12px',
          }}
          onClick={(e) => {
            // Handle selection
            handleSelectClick(e);

            // Only trigger focus if not clicking on buttons or controls
            const target = e.target as HTMLElement;
            if (
              !target.closest("button") &&
              !target.closest(".window-control-btn")
            ) {
              onFocus(agent.id);
            }
          }}
        >
          <div
            className="draggable-terminal-container"
            style={{
              width: "100%",
              height: "100%",
              background: `rgba(0, 0, 0, ${terminalOpacity})`,
            }}
          >
            <div
              className="terminal-drag-handle"
              onMouseDown={handleHeaderMouseDown}
            >
              <div className="drag-indicator">⋮⋮</div>
              <div className="terminal-header-info">
                <span className="terminal-name">
                  <span style={{ marginRight: '6px' }}>{getTerminalIcon(agent.terminalType, agent.name)}</span>
                  {displayTitle}
                  {xtermTitle && (
                    <button
                      className="window-control-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setUseXtermTitle(!useXtermTitle);
                      }}
                      title={useXtermTitle ? "Show static name" : "Show xterm title"}
                      style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        padding: '2px 6px',
                        background: useXtermTitle ? 'rgba(100, 200, 100, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                        minWidth: '24px',
                        height: '20px'
                      }}
                    >
                      {useXtermTitle ? '📝' : '🏷️'}
                    </button>
                  )}
                </span>
                <span className="terminal-type">({agent.terminalType})</span>
              </div>
              <div className="terminal-window-controls">
                <button
                  className="window-control-btn lock-btn"
                  onClick={handleCustomLockToggle}
                  title={isLocked ? "Unlock position" : "Lock position"}
                  style={{ opacity: isLocked ? 1 : 0.7 }}
                >
                  {isLocked ? "🔒" : "🔓"}
                </button>
                <button
                  ref={themeButtonRef}
                  className="window-control-btn theme-btn"
                  onClick={handleThemeToggle}
                  title="Customize theme"
                >
                  🎨
                </button>
                <ThemeDropdown
                  isOpen={showThemePicker}
                  onClose={() => setShowThemePicker(false)}
                  currentTheme={currentTheme}
                  currentOpacity={terminalOpacity}
                  currentFontSize={terminalFontSize}
                  currentFontFamily={terminalFontFamily}
                  onOpacityChange={(opacity) => {
                    setTransparencyOverridden(true);
                    setTerminalOpacity(opacity);
                    updateTerminalSettings({ transparency: opacity });
                    if (terminalRef.current) {
                      terminalRef.current.updateOpacity(opacity);
                    }
                  }}
                  onFontSizeChange={(fontSize) => {
                    setFontOverridden(true);
                    setTerminalFontSize(fontSize);
                    updateTerminalSettings({ fontSize });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontSize(fontSize);
                    }
                  }}
                  onFontSizeReset={() => {
                    setFontOverridden(false);
                    setTerminalFontSize(terminalDefaultFontSize);
                    updateTerminalSettings({ fontSize: undefined });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontSize(
                        terminalDefaultFontSize,
                      );
                    }
                  }}
                  onFontFamilyChange={(fontFamily) => {
                    setFontFamilyOverridden(true);
                    setTerminalFontFamily(fontFamily);
                    updateTerminalSettings({ fontFamily });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontFamily(fontFamily);
                    }
                  }}
                  onThemeSelect={(key) => {
                    setThemeOverridden(true);
                    setCurrentTheme(key);
                    updateTerminalSettings({ theme: key });
                    if (terminalRef.current) {
                      terminalRef.current.updateTheme(key);
                    }
                    // Theme change already triggers fit/refresh in Terminal.tsx
                    // No need for manual resize event
                  }}
                  buttonRef={themeButtonRef}
                />
                {/* Maximize button removed for embedded terminals as requested */}
                {/* Add undock button for embedded terminals */}
                {onUndock && (
                  <button
                    className="window-control-btn undock-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onUndock?.();
                    }}
                    title="Detach to canvas"
                    style={{ marginRight: '4px' }}
                  >
                    ⬈
                  </button>
                )}
                <button
                  className="window-control-btn close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose();
                  }}
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className="terminal-viewport"
              style={{ height: "calc(100% - 40px)" }}
            >
              <Terminal
                ref={terminalRef}
                initialFontSize={fontOverridden ? terminalFontSize : undefined}
                agent={agent}
                onClose={onClose}
                onCommand={onCommand}
                wsRef={wsRef}
                embedded={true} // Hide Terminal's internal header
                initialTheme={currentTheme}
                initialOpacity={terminalOpacity}
                canvasZoom={canvasZoom}
                mountKey={agent.id} // Use agent.id as key to preserve instance
                onTitleChange={setXtermTitle}
                isSelected={selected}
              />
            </div>
          </div>
        </div>,
        dockElement,
      );
    }
  }

  // Regular draggable terminal
  return (
    <>
      <Draggable
        key={`drag-${dragKey}-${isMaximized}`}
        nodeRef={nodeRef}
        position={position}
        onStart={() => setIsDragging(true)}
        onStop={(e, data) => {
          handleDragStop(e as any, data as any);
          setIsDragging(false);
        }}
        handle=".terminal-drag-handle"
        disabled={isMaximized || isResizing}
        bounds={{left: 0, top: 0, right: 10000, bottom: 10000}} // World bounds match MINIMAP_WORLD
        scale={canvasZoom}
      >
        <div
          ref={nodeRef}
          className={`draggable-terminal-wrapper ${isDragging ? "dragging" : ""} ${isMaximized ? "maximized" : ""}`}
          data-terminal-type={agent.terminalType}
          data-terminal-id={agent.id}
          tabIndex={-1}
          style={{
            position: "absolute",
            zIndex: isMaximized ? Math.max(zIndex, 500) : zIndex, // Higher z-index when maximized
            // No transform needed - terminals are inside the scaled canvas
            transform: undefined,
            transformOrigin: "top left",
            outline: selected ? '2px solid #3b82f6' : 'none',
            outlineOffset: '2px',
            borderRadius: '12px',
          }}
          onClick={(e) => {
            // Handle selection
            handleSelectClick(e);

            // Only trigger focus if not clicking on buttons or controls
            const target = e.target as HTMLElement;
            if (
              !target.closest("button") &&
              !target.closest(".window-control-btn")
            ) {
              onFocus(agent.id);
            }
          }}
        >
          <ResizableBox
            width={size.width}
            height={size.height}
            onResizeStart={(e) => handleResizeStart(e as any)}
            onResize={(e) => handleResize(e as any)}
            onResizeStop={handleResizeStop}
            minConstraints={minConstraints}
            maxConstraints={[window.innerWidth - 50, window.innerHeight - 50]}
            resizeHandles={isMaximized || isLocked ? [] : ["se"]}
            className="resizable-terminal"
          >
            <div
              className="draggable-terminal-container"
              style={{
                background: `rgba(0, 0, 0, ${terminalOpacity})`,
              }}
            >
              {showHeader ? (
              <div
                className="terminal-drag-handle"
                onMouseDown={handleHeaderMouseDown}
              >
                <div className="drag-indicator">⋮⋮</div>
                <div className="terminal-header-info">
                  <span className="terminal-name">
                    <span style={{ marginRight: '6px' }}>{getTerminalIcon(agent.terminalType, agent.name)}</span>
                    {agent.name}
                  </span>
                  <span className="terminal-type">({agent.terminalType})</span>
                  {agent.embedded && (
                    <span
                      className="terminal-embedded-badge"
                      style={{
                        marginLeft: "8px",
                        padding: "2px 6px",
                        background: "rgba(255, 215, 0, 0.2)",
                        border: "1px solid rgba(255, 215, 0, 0.5)",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "#ffd700",
                      }}
                    >
                      📡 Connected to Dispatcher
                    </span>
                  )}
                </div>
                <div className="terminal-window-controls">
                  <button
                    className="window-control-btn lock-btn"
                    onClick={handleCustomLockToggle}
                    title={isLocked ? "Unlock position" : "Lock position"}
                    style={{ opacity: isLocked ? 1 : 0.7 }}
                  >
                    {isLocked ? "🔒" : "🔓"}
                  </button>
                  <button
                    ref={themeButtonRef}
                    className="window-control-btn theme-btn"
                    onClick={handleThemeToggle}
                    title="Customize theme"
                  >
                    🎨
                  </button>
                <ThemeDropdown
                  isOpen={showThemePicker}
                  onClose={() => setShowThemePicker(false)}
                  currentTheme={currentTheme}
                  currentOpacity={terminalOpacity}
                  currentFontSize={terminalFontSize}
                  onOpacityChange={(opacity) => {
                    setTerminalOpacity(opacity);
                    updateTerminalSettings({ transparency: opacity });
                    // Update terminal opacity
                    if (terminalRef.current) {
                      terminalRef.current.updateOpacity(opacity);
                    }
                  }}
              onFontSizeChange={(fontSize) => {
                setFontOverridden(true);
                setTerminalFontSize(fontSize);
                updateTerminalSettings({ fontSize });
                if (terminalRef.current) {
                  terminalRef.current.updateFontSize(fontSize);
                }
              }}
                  onFontSizeReset={() => {
                    setFontOverridden(false);
                    setTerminalFontSize(terminalDefaultFontSize);
                    updateTerminalSettings({ fontSize: undefined });
                    if (terminalRef.current) {
                      terminalRef.current.updateFontSize(
                        terminalDefaultFontSize,
                      );
                    }
                  }}
                  onThemeSelect={(key) => {
                    setCurrentTheme(key);
                    updateTerminalSettings({ theme: key });
                    // Update the terminal's theme
                    if (terminalRef.current) {
                        terminalRef.current.updateTheme(key);
                      }
                      // Trigger resize to refresh terminal after theme change
                      // Just trigger a resize event - Terminal.tsx will handle the actual resize with debouncing
                      setTimeout(() => {
                        window.dispatchEvent(
                          new CustomEvent("terminal-container-resized", {
                            detail: { id: agent.id },
                          }),
                        );
                      }, 100);
                    }}
                    buttonRef={themeButtonRef}
                  />
                  <button
                    className="window-control-btn maximize-btn"
                    onClick={toggleMaximize}
                    title="Maximize to fullscreen"
                  >
                    ◰
                  </button>
                  <button
                    className="window-control-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowHeader(!showHeader);
                    }}
                    title={showHeader ? "Hide header (for TUI tools like MC)" : "Show header"}
                    style={{ fontSize: '14px', padding: '2px 6px' }}
                  >
                    {showHeader ? '🔽' : '🔼'}
                  </button>
                  <button
                    className="window-control-btn power-off-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handlePowerOff(e);
                    }}
                    title="Power off terminal (preserves state)"
                  >
                    ⏻
                  </button>
                  <button
                    className="window-control-btn close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleClose();
                    }}
                    title="Close terminal permanently"
                  >
                    ✕
                  </button>
                </div>
              </div>
              ) : (
                <button
                  className="window-control-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowHeader(true);
                  }}
                  title="Show header"
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    zIndex: 10,
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  🔼
                </button>
              )}
              <div
                className="terminal-content"
                onFocusCapture={() => onFocus(agent.id)}
                style={{
                  cursor: "text",
                  position: "relative",
                  display: "flex",
                  flex: 1,
                  pointerEvents: isDragging ? 'none' : 'auto', // Prevent terminal content from interfering with drag
                }}
              >
                {showIconView ? (
                  (() => {
                    // Scale relative to the terminal box and compensate for zoom (within bounds)
                    const base = Math.min(size.width, size.height);
                    const zoomComp = Math.min(1 / (canvasZoom || 1), 4);
                    const iconSize = Math.min(
                      base * 0.6 * zoomComp,
                      base * 0.95,
                      280,
                    );
                    // Fixed size for better readability at low zoom
                    const titleSize = 24; // Fixed 24px for terminal name
                    const typeSize = 16; // Fixed 16px for terminal type
                    const pillSize = Math.max(
                      12,
                      Math.min(20, base * 0.055 * zoomComp),
                    );
                    const pillPadV = Math.max(
                      6,
                      Math.min(14, base * 0.03 * zoomComp),
                    );
                    const pillPadH = Math.max(
                      14,
                      Math.min(24, base * 0.04 * zoomComp),
                    );
                    return (
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          padding: "20px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: iconSize + "px",
                            marginBottom: "20px",
                            filter:
                              "drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))",
                            animation: "pulse 2s infinite",
                          }}
                        >
                          {getTerminalIcon(agent.terminalType, agent.name)}
                        </div>
                        <div
                          style={{
                            fontSize: titleSize + "px",
                            fontWeight: "bold",
                            marginBottom: "8px",
                            textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                            maxWidth: "90%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displayTitle}
                        </div>
                        <div
                          style={{
                            fontSize: typeSize + "px",
                            opacity: 0.8,
                            marginBottom: "16px",
                          }}
                        >
                          {agent.terminalType}
                        </div>
                        <div
                          style={{
                            fontSize: pillSize + "px",
                            opacity: 0.6,
                            padding: `${pillPadV}px ${pillPadH}px`,
                            background: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "20px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                          }}
                        >
                          Zoom in to view terminal
                        </div>
                      </div>
                    );
                  })()
              ) : (
                <Terminal
                  key={`terminal-${agent.id}`}  // Use same key as fullscreen view
                  ref={terminalRef}
                  initialFontSize={fontOverridden ? terminalFontSize : undefined}
                  agent={agent}
                  onClose={onClose}
                  onCommand={onCommand}
                  wsRef={wsRef}
                  embedded
                  initialTheme={currentTheme}
                  initialOpacity={terminalOpacity}
                  canvasZoom={canvasZoom}
                  mountKey={agent.id} // Use agent.id as key to preserve instance
                  onTitleChange={setXtermTitle}
                  isSelected={selected}
                  />
                )}
              </div>
            </div>
          </ResizableBox>
        </div>
      </Draggable>

    </>
  );
};

// Memoized component with custom comparison
export const DraggableTerminal = React.memo(
  DraggableTerminalComponent,
  (prevProps, nextProps) => {
    // Only re-render if these specific props change
    // canvasZoom IS included so Terminal receives updated zoom and can adjust font size
    // The font-size approach is much cheaper than the old transform approach
    return (
      prevProps.agent.id === nextProps.agent.id &&
      prevProps.agent.status === nextProps.agent.status &&
      prevProps.agent.embedded === nextProps.agent.embedded &&
      prevProps.zIndex === nextProps.zIndex &&
      prevProps.canvasZoom === nextProps.canvasZoom && // Allow re-render for font-size zoom
      prevProps.isDocked === nextProps.isDocked &&
      prevProps.sidebarOpen === nextProps.sidebarOpen &&
      prevProps.backgroundType === nextProps.backgroundType &&
      prevProps.initialTheme === nextProps.initialTheme &&
      prevProps.initialTransparency === nextProps.initialTransparency
    );
  },
);
