import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { enableMapSet } from "immer";

// Enable Immer plugin for Map and Set support
enableMapSet();

// CLEANUP_ON_START should only be handled by backend on server startup
// Frontend should always preserve terminals but mark them as offline on refresh
const CLEANUP_ON_START = false; // Never clean on frontend refresh

// Terminal state for persistence
export interface TerminalState {
  id: string;
  name: string;
  terminalType: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMaximized: boolean;
  theme?: string;
  transparency?: number;
  fontSize?: number; // Terminal-specific font size
  fontFamily?: string; // Terminal-specific font family

  // Lock state
  isLocked?: boolean;
  viewportPosition?: { x: number; y: number }; // Position when locked to viewport
  lockedZoom?: number; // Canvas zoom level when locked (for maintaining visual size)


  // On/Off state
  isOn: boolean;
  agentId?: string; // WebSocket agent ID when on
  lastAgentId?: string; // Previous agent ID for reconnection after refresh
  embedded?: boolean; // Whether terminal is embedded in Command Dispatcher

  // Session management
  workingDir?: string;
  startCommand?: string; // Command to run when turning on (shell setup)
  commands?: string[]; // Commands to auto-execute after terminal starts (e.g., ['mc\n'] for file manager)
  toolName?: string; // Name of TUI tool (e.g., 'mc', 'lazygit')
  isTUITool?: boolean; // Whether this is a TUI tool terminal
  sessionId?: string; // For Claude Code resumption
  sessionName?: string; // tmux session name for persistence
  lastCommand?: string;
  createdAt: number;
  lastModified?: number;
  lastActiveAt: number;
}

// Card/Note state
export interface CardState {
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
  category?: string; // Category for organization
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;

  // Lock state
  isLocked?: boolean;
  viewportPosition?: { x: number; y: number }; // Position when locked to viewport
  lockedZoom?: number; // Canvas zoom level when locked (for maintaining visual size)


  editable?: boolean;
  isMarkdown?: boolean;
  startInEditMode?: boolean; // For file viewers, start in edit mode
  transparency?: number; // Optional background transparency for cards
  fontFamily?: string; // Font family for file viewers
  themeId?: string; // Theme ID for file viewers
  createdAt: number;
  lastModified: number;
}

// Card categories configuration
export interface CardCategory {
  id: string;
  name: string;
  color: string;
  variant: CardState["variant"];
}

// Session Manager Panel state
export interface SessionManagerPanelState {
  id: string;
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isLocked?: boolean;
  viewportPosition?: { x: number; y: number }; // Position when locked to viewport
  lockedZoom?: number; // Canvas zoom level when locked (for maintaining visual size)
}

// Drawing objects for canvas drawing feature
export interface DrawingObject {
  id: string;
  type: 'freehand' | 'line' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser' | 'select';
  points: { x: number; y: number }[];
  style: {
    stroke: string;
    strokeWidth: number;
    fill?: string;
    opacity: number;
    fontSize?: number;
    fontFamily?: string;
  };
  text?: string;
  selected?: boolean;
  timestamp: number;
}

// Widget prop types for different widget types
export interface ChartWidgetProps {
  data: Array<{ name: string; value: number; [key: string]: string | number }>;
  type: "line" | "bar" | "area" | "pie";
  title?: string;
}

export interface MonacoWidgetProps {
  code: string;
  language: string;
  theme?: string;
  readOnly?: boolean;
}

export interface TerminalWidgetProps {
  command?: string;
  workingDir?: string;
}

export interface SpotifyVisualizerProps {
  accessToken?: string;
  playlistId?: string;
}

export interface WebSocketVisualizerProps {
  url: string;
  protocol?: string;
}

export type WidgetProps =
  | ChartWidgetProps
  | MonacoWidgetProps
  | TerminalWidgetProps
  | SpotifyVisualizerProps
  | WebSocketVisualizerProps;

// Widget state (charts, code editors, etc)
export interface WidgetState {
  id: string;
  type:
    | "chart"
    | "monaco"
    | "terminal-widget"
    | "spotify-visualizer"
    | "websocket-visualizer";
  props: WidgetProps;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  zIndex: number;
  isLocked?: boolean;
  viewportPosition?: { x: number; y: number };
  createdAt: number;
}

// Canvas viewport state
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// Layout preset
export interface LayoutPreset {
  id: string;
  name: string;
  description?: string;
  terminals: TerminalState[];
  cards: CardState[];
  widgets: WidgetState[];
  viewport: ViewportState;
  backgroundTheme?: string; // Canvas background theme
  drawingObjects?: DrawingObject[]; // Saved drawings
  createdAt: number;
}

// Validation helper functions for layout data
const validateTerminalData = (terminal: any): terminal is TerminalState => {
  // Check required fields exist
  if (!terminal || typeof terminal !== 'object') return false;
  if (!terminal.id || typeof terminal.id !== 'string') return false;
  if (!terminal.name || typeof terminal.name !== 'string') return false;
  if (!terminal.terminalType || typeof terminal.terminalType !== 'string') return false;
  if (!terminal.position || typeof terminal.position.x !== 'number' || typeof terminal.position.y !== 'number') return false;
  if (!terminal.size || typeof terminal.size.width !== 'number' || typeof terminal.size.height !== 'number') return false;

  // Validate bounds
  if (terminal.position.x < -10000 || terminal.position.y < -10000) return false;
  if (terminal.size.width <= 0 || terminal.size.height <= 0) return false;
  if (terminal.size.width > 10000 || terminal.size.height > 10000) return false;

  return true;
};

const validateCardData = (card: any): card is CardState => {
  // Check required fields exist
  if (!card || typeof card !== 'object') return false;
  if (!card.id || typeof card.id !== 'string') return false;
  if (!card.title || typeof card.title !== 'string') return false;
  if (!card.variant || typeof card.variant !== 'string') return false;
  if (!card.position || typeof card.position.x !== 'number' || typeof card.position.y !== 'number') return false;
  if (!card.size || typeof card.size.width !== 'number' || typeof card.size.height !== 'number') return false;

  // Validate bounds
  if (card.position.x < -10000 || card.position.y < -10000) return false;
  if (card.size.width <= 0 || card.size.height <= 0) return false;

  // Stricter size limits to prevent corrupted cards (especially file viewers)
  // Max 2500x2000 is generous but prevents canvas-wide corruption
  if (card.size.width > 2500 || card.size.height > 2000) {
    console.warn(`Card ${card.id} has corrupt size (${card.size.width}x${card.size.height}), clamping to max`);
    // Clamp to reasonable size instead of rejecting
    card.size.width = Math.min(card.size.width, 2000);
    card.size.height = Math.min(card.size.height, 1500);
  }

  return true;
};

const cloneTerminalState = (terminal: TerminalState): TerminalState => ({
  ...terminal,
  position: { ...terminal.position },
  size: { ...terminal.size },
  viewportPosition: terminal.viewportPosition
    ? { ...terminal.viewportPosition }
    : undefined,
  commands: terminal.commands ? [...terminal.commands] : undefined,
});

const cloneCardState = (card: CardState): CardState => ({
  ...card,
  position: { ...card.position },
  size: { ...card.size },
  viewportPosition: card.viewportPosition
    ? { ...card.viewportPosition }
    : undefined,
  content: card.content,
  backContent: card.backContent,
});

const cloneWidgetState = (widget: WidgetState): WidgetState => ({
  ...widget,
  position: widget.position ? { ...widget.position } : undefined,
  size: widget.size ? { ...widget.size } : undefined,
  viewportPosition: widget.viewportPosition
    ? { ...widget.viewportPosition }
    : undefined,
  props: widget.props ? JSON.parse(JSON.stringify(widget.props)) : widget.props,
});

interface CanvasStore {
  // Terminal management
  terminals: Map<string, TerminalState>;
  activeTerminalId: string | null;

  // Card management
  cards: Map<string, CardState>;
  activeCardId: string | null;
  cardCategories: CardCategory[]; // Card category definitions

  // Widget management
  widgets: WidgetState[];
  activeWidgetId: string | null;

  // Session Manager Panel
  sessionManagerPanel: SessionManagerPanelState | null;
  openSessionManager: (position?: { x: number; y: number }) => void;
  closeSessionManager: () => void;
  updateSessionManagerPosition: (position: { x: number; y: number }) => void;
  updateSessionManagerSize: (size: { width: number; height: number }) => void;
  updateSessionManagerState: (updates: Partial<SessionManagerPanelState>) => void;
  toggleSessionManagerLock: () => void;
  bringSessionManagerToFront: () => void;

  // Selection management (multi-select)
  selectedIds: Set<string>; // IDs of selected terminals/cards (terminal-xxx or card-xxx)
  selectItem: (id: string, multi?: boolean) => void;
  deselectItem: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // Drawing state
  drawingObjects: DrawingObject[];
  drawingMode: boolean;
  currentDrawingTool: DrawingObject['type'];
  currentStroke: string;
  currentStrokeWidth: number;
  currentFill?: string;
  isDrawing: boolean;
  currentPath: { x: number; y: number }[];

  // Canvas state
  viewport: ViewportState;
  isDragging: boolean;
  isPanning: boolean;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  minimapSize: { width: number; height: number }; // Minimap dimensions (saved with workspace)

  // Z-index management
  maxZIndex: number;

  // Layout presets
  layouts: Map<string, LayoutPreset>;
  activeLayoutId: string | null;

  // Actions - Terminals
  addTerminal: (
    terminal: Omit<TerminalState, "createdAt" | "lastActiveAt" | "zIndex">,
  ) => void;
  updateTerminal: (id: string, updates: Partial<TerminalState>) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string | null) => void;
  bringTerminalToFront: (id: string) => void;
  turnOnTerminal: (id: string, agentId: string) => void;
  turnOffTerminal: (id: string) => void;

  // Actions - Cards
  addCard: (
    card: Omit<CardState, "createdAt" | "lastModified" | "zIndex">,
  ) => void;
  updateCard: (id: string, updates: Partial<CardState>) => void;
  removeCard: (id: string) => void;
  setActiveCard: (id: string | null) => void;
  bringCardToFront: (id: string) => void;

  // Actions - Card Categories
  updateCardCategory: (
    categoryId: string,
    updates: Partial<CardCategory>,
  ) => void;
  resetCardCategories: () => void;

  // Actions - Widgets
  addWidget: (widget: Omit<WidgetState, "createdAt" | "zIndex">) => void;
  updateWidget: (id: string, updates: Partial<WidgetState>) => void;
  removeWidget: (id: string) => void;
  setActiveWidget: (id: string | null) => void;
  bringWidgetToFront: (id: string) => void;

  // Actions - Canvas
  setViewport: (viewport: Partial<ViewportState>) => void;
  resetViewport: () => void;
  setDragging: (isDragging: boolean) => void;
  setPanning: (isPanning: boolean) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  setMinimapSize: (size: { width: number; height: number }) => void;

  // Actions - Layouts
  saveLayout: (
    name: string,
    layoutId?: string,
    backgroundTheme?: string,
  ) => string;
  loadLayout: (id: string, callbacks?: { onBackgroundChange?: (theme: string) => void }) => void;
  deleteLayout: (id: string) => void;
  renameLayout: (id: string, newName: string) => void;
  exportLayout: (id: string) => string;
  importLayout: (jsonData: string) => void;

  // Utility actions
  clearCanvas: () => void;
  getNextZIndex: () => number;
  cleanupOrphanedTerminals: () => void;

  // Drawing actions
  setDrawingMode: (enabled: boolean) => void;
  setCurrentDrawingTool: (tool: DrawingObject['type']) => void;
  setDrawingStyle: (stroke: string, strokeWidth: number, fill?: string) => void;
  startDrawing: (x: number, y: number) => void;
  addDrawingPoint: (x: number, y: number) => void;
  finishDrawing: () => void;
  deleteDrawingObject: (id: string) => void;
  updateDrawingObject: (id: string, updates: Partial<DrawingObject>) => void;
  clearAllDrawings: () => void;
}

// Helper to verify localStorage is working
const verifyLocalStorage = () => {
  try {
    const testKey = "opustrator-test";
    localStorage.setItem(testKey, "test");
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    return result === "test";
  } catch (e) {
    console.error("[CanvasStore] localStorage is not available:", e);
    return false;
  }
};


export const useCanvasStore = create<CanvasStore>()(
  // TEST: persist() temporarily disabled to test performance
  // persist(
    immer((set, get) => ({
      // Initial state
      terminals: new Map(),
      activeTerminalId: null,
      cards: new Map(),
      activeCardId: null,

      // Log state on initialization
      _debugInit: (() => {
        console.log('[CanvasStore] Store initialized');
        return true;
      })(),

      // Selection state
      selectedIds: new Set(),

      // Drawing state
      drawingObjects: [],
      drawingMode: false,
      currentDrawingTool: 'freehand',
      currentStroke: '#00ffff', // Neon cyan default
      currentStrokeWidth: 2,
      currentFill: undefined,
      isDrawing: false,
      currentPath: [],

      cardCategories: [
        { id: "note", name: "Note", color: "#6b7280", variant: "default" },
        {
          id: "primary",
          name: "Primary",
          color: "#3b82f6",
          variant: "primary",
        },
        {
          id: "success",
          name: "Success",
          color: "#10b981",
          variant: "success",
        },
        {
          id: "warning",
          name: "Warning",
          color: "#f59e0b",
          variant: "warning",
        },
        { id: "danger", name: "Danger", color: "#ef4444", variant: "danger" },
        { id: "info", name: "Info", color: "#06b6d4", variant: "info" },
        { id: "purple", name: "Purple", color: "#8b5cf6", variant: "purple" },
        {
          id: "glow",
          name: "Glow",
          color: "linear-gradient(135deg, #667eea, #764ba2)",
          variant: "glow",
        },
      ],
      widgets: [],
      activeWidgetId: null,
      sessionManagerPanel: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      isDragging: false,
      isPanning: false,
      gridEnabled: false,
      snapToGrid: false,
      gridSize: 20,
      minimapSize: { width: 300, height: 300 }, // Default 300x300 square
      maxZIndex: 0,
      layouts: new Map(),
      activeLayoutId: null,

      // Terminal actions
      addTerminal: (terminal) =>
        set((state) => {
          const now = Date.now();
          const zIndex = state.maxZIndex + 1;
          state.terminals.set(terminal.id, {
            ...terminal,
            createdAt: now,
            lastActiveAt: now,
            zIndex,
          });
          state.maxZIndex = zIndex;
        }),

      updateTerminal: (id, updates) =>
        set((state) => {
          const terminal = state.terminals.get(id);
          if (terminal) {
            state.terminals.set(id, {
              ...terminal,
              ...updates,
              lastActiveAt: Date.now(),
            });
          }
        }),

      removeTerminal: (id) =>
        set((state) => {
          state.terminals.delete(id);
          if (state.activeTerminalId === id) {
            state.activeTerminalId = null;
          }
        }),

      setActiveTerminal: (id) =>
        set((state) => {
          state.activeTerminalId = id;
        }),

      bringTerminalToFront: (id) =>
        set((state) => {
          const terminal = state.terminals.get(id);
          if (terminal) {
            const newZIndex = state.maxZIndex + 1;
            state.terminals.set(id, {
              ...terminal,
              zIndex: newZIndex,
              lastActiveAt: Date.now(),
            });
            state.maxZIndex = newZIndex;
            state.activeTerminalId = id;
          }
        }),

      turnOnTerminal: (id, agentId) =>
        set((state) => {
          const terminal = state.terminals.get(id);
          if (terminal) {
            state.terminals.set(id, {
              ...terminal,
              isOn: true,
              agentId,
              lastAgentId: agentId, // Also update lastAgentId for future reconnection
              lastActiveAt: Date.now(),
            });
          }
        }),

      turnOffTerminal: (id) =>
        set((state) => {
          const terminal = state.terminals.get(id);
          if (terminal) {
            state.terminals.set(id, {
              ...terminal,
              isOn: false,
              lastAgentId: terminal.agentId, // Preserve for reconnection
              agentId: undefined, // Clear current connection
              lastActiveAt: Date.now(),
            });
          }
        }),

      // Card actions
      addCard: (card) =>
        set((state) => {
          const now = Date.now();
          const zIndex = state.maxZIndex + 1;
          state.cards.set(card.id, {
            ...card,
            createdAt: now,
            lastModified: now,
            zIndex,
          });
          state.maxZIndex = zIndex;
        }),

      updateCard: (id, updates) =>
        set((state) => {
          const card = state.cards.get(id);
          if (card) {
            state.cards.set(id, {
              ...card,
              ...updates,
              lastModified: Date.now(),
            });
          }
        }),

      removeCard: (id) =>
        set((state) => {
          state.cards.delete(id);
          if (state.activeCardId === id) {
            state.activeCardId = null;
          }
        }),

      setActiveCard: (id) =>
        set((state) => {
          state.activeCardId = id;
        }),

      bringCardToFront: (id) =>
        set((state) => {
          const card = state.cards.get(id);
          if (card) {
            const newZIndex = state.maxZIndex + 1;
            state.cards.set(id, {
              ...card,
              zIndex: newZIndex,
              lastModified: Date.now(),
            });
            state.maxZIndex = newZIndex;
            state.activeCardId = id;
          }
        }),

      // Card category actions
      updateCardCategory: (categoryId, updates) =>
        set((state) => {
          const index = state.cardCategories.findIndex(
            (c) => c.id === categoryId,
          );
          if (index !== -1) {
            state.cardCategories[index] = {
              ...state.cardCategories[index],
              ...updates,
            };
          }
        }),

      resetCardCategories: () =>
        set((state) => {
          state.cardCategories = [
            { id: "note", name: "Note", color: "#6b7280", variant: "default" },
            {
              id: "primary",
              name: "Primary",
              color: "#3b82f6",
              variant: "primary",
            },
            {
              id: "success",
              name: "Success",
              color: "#10b981",
              variant: "success",
            },
            {
              id: "warning",
              name: "Warning",
              color: "#f59e0b",
              variant: "warning",
            },
            {
              id: "danger",
              name: "Danger",
              color: "#ef4444",
              variant: "danger",
            },
            { id: "info", name: "Info", color: "#06b6d4", variant: "info" },
            {
              id: "purple",
              name: "Purple",
              color: "#8b5cf6",
              variant: "purple",
            },
            {
              id: "glow",
              name: "Glow",
              color: "linear-gradient(135deg, #667eea, #764ba2)",
              variant: "glow",
            },
          ];
        }),

      // Widget actions
      addWidget: (widget) =>
        set((state) => {
          const now = Date.now();
          const zIndex = state.maxZIndex + 1;
          state.widgets.push({
            ...widget,
            createdAt: now,
            zIndex,
          });
          state.maxZIndex = zIndex;
        }),

      updateWidget: (id, updates) =>
        set((state) => {
          const index = state.widgets.findIndex((w) => w.id === id);
          if (index !== -1) {
            state.widgets[index] = {
              ...state.widgets[index],
              ...updates,
            };
          }
        }),

      removeWidget: (id) =>
        set((state) => {
          state.widgets = state.widgets.filter((w) => w.id !== id);
          if (state.activeWidgetId === id) {
            state.activeWidgetId = null;
          }
        }),

      setActiveWidget: (id) =>
        set((state) => {
          state.activeWidgetId = id;
        }),

      bringWidgetToFront: (id) =>
        set((state) => {
          const index = state.widgets.findIndex((w) => w.id === id);
          if (index !== -1) {
            const newZIndex = state.maxZIndex + 1;
            state.widgets[index] = {
              ...state.widgets[index],
              zIndex: newZIndex,
            };
            state.maxZIndex = newZIndex;
            state.activeWidgetId = id;
          }
        }),

      // Session Manager actions
      openSessionManager: (position) =>
        set((state) => {
          if (!state.sessionManagerPanel) {
            const newZIndex = state.maxZIndex + 1;
            // Use provided position or default to (100, 100)
            const spawnPosition = position || { x: 100, y: 100 };
            state.sessionManagerPanel = {
              id: 'session-manager',
              isOpen: true,
              position: spawnPosition,
              size: { width: 550, height: 800 },
              zIndex: newZIndex,
              isLocked: false,
              viewportPosition: { x: 100, y: 100 },
            };
            state.maxZIndex = newZIndex;
          } else {
            state.sessionManagerPanel.isOpen = true;
            const newZIndex = state.maxZIndex + 1;
            state.sessionManagerPanel.zIndex = newZIndex;
            state.maxZIndex = newZIndex;
          }
        }),

      closeSessionManager: () =>
        set((state) => {
          if (state.sessionManagerPanel) {
            state.sessionManagerPanel.isOpen = false;
          }
        }),

      updateSessionManagerPosition: (position) =>
        set((state) => {
          if (state.sessionManagerPanel) {
            state.sessionManagerPanel.position = position;
          }
        }),

      updateSessionManagerSize: (size) =>
        set((state) => {
          if (state.sessionManagerPanel) {
            state.sessionManagerPanel.size = size;
          }
        }),

      updateSessionManagerState: (updates) =>
        set((state) => {
          if (state.sessionManagerPanel) {
            state.sessionManagerPanel = {
              ...state.sessionManagerPanel,
              ...updates,
            };
          }
        }),

      toggleSessionManagerLock: () =>
        set((state) => {
          if (state.sessionManagerPanel) {
            state.sessionManagerPanel.isLocked = !state.sessionManagerPanel.isLocked;
          }
        }),

      bringSessionManagerToFront: () =>
        set((state) => {
          if (state.sessionManagerPanel) {
            const newZIndex = state.maxZIndex + 1;
            state.sessionManagerPanel.zIndex = newZIndex;
            state.maxZIndex = newZIndex;
          }
        }),

      // Canvas actions
      setViewport: (viewport) =>
        set((state) => {
          state.viewport = { ...state.viewport, ...viewport };
        }),

      resetViewport: () =>
        set((state) => {
          state.viewport = { x: 0, y: 0, zoom: 1 };
        }),

      setDragging: (isDragging) =>
        set((state) => {
          state.isDragging = isDragging;
        }),

      setPanning: (isPanning) =>
        set((state) => {
          state.isPanning = isPanning;
        }),

      toggleGrid: () =>
        set((state) => {
          state.gridEnabled = !state.gridEnabled;
        }),

      toggleSnapToGrid: () =>
        set((state) => {
          state.snapToGrid = !state.snapToGrid;
        }),

      setGridSize: (size) =>
        set((state) => {
          state.gridSize = size;
        }),

      setMinimapSize: (size) =>
        set((state) => {
          state.minimapSize = size;
        }),

      // Selection actions
      selectItem: (id, multi = false) =>
        set((state) => {
          if (!multi) {
            // Single select - clear existing and add this one
            state.selectedIds.clear();
          }
          state.selectedIds.add(id);
        }),

      deselectItem: (id) =>
        set((state) => {
          state.selectedIds.delete(id);
        }),

      clearSelection: () =>
        set((state) => {
          state.selectedIds.clear();
        }),

      isSelected: (id) => {
        return get().selectedIds.has(id);
      },

      // Layout actions
      saveLayout: (name, layoutId, backgroundTheme) => {
        const id = layoutId || `layout-${Date.now()}`;

        // When saving a layout, ensure all active agents have stored terminals
        // This is handled by the component that calls saveLayout

        set((draft) => {
          const existingLayout = layoutId ? draft.layouts.get(layoutId) : null;

          // Get the current state using draft for the most up-to-date values
          // Filter out orphaned terminals that have been closed but not cleaned up
          const allTerminals = Array.from(draft.terminals.values());

          // Only include terminals that are:
          // 1. Currently on (active/connected) - but not orphaned
          // 2. OR intentionally offline (turned off with power button, not deleted)
          // This filters out "zombie" terminals that were closed but not removed
          const validTerminals = allTerminals.filter(terminal => {
            // First validate terminal data structure
            if (!validateTerminalData(terminal)) {
              console.warn(`Skipping invalid terminal data: ${(terminal as any)?.id}`);
              return false;
            }

            // For online terminals, make sure they have a valid agentId
            // (not orphaned terminals that lost their agent connection)
            if (terminal.isOn) {
              // Online terminal must have an agentId to be valid
              // If it doesn't, it's an orphaned terminal that should be excluded
              return !!terminal.agentId;
            }

            // For offline terminals, only keep those that were intentionally turned off
            // (not orphaned terminals from closed agents)
            // An offline terminal is valid if it has reasonable data and no stale agentId
            if (!terminal.isOn && terminal.name && terminal.terminalType) {
              // If it has an agentId but is offline, it might be orphaned
              // Only keep it if it has a lastAgentId (was properly turned off)
              if (terminal.agentId && !terminal.lastAgentId) {
                return false; // Orphaned - has agentId but wasn't properly turned off
              }
              return true;
            }

            return false;
          });

          const currentCards = Array.from(draft.cards.values());

          // Validate cards before saving
          const validCards = currentCards.filter(card => {
            if (!validateCardData(card)) {
              console.warn(`Skipping invalid card data: ${(card as any)?.id}`);
              return false;
            }
            return true;
          });

          const layoutData: LayoutPreset = {
            id,
            name,
            description: existingLayout?.description,
            terminals: validTerminals.map((terminal) => {
              const cloned = cloneTerminalState(terminal)
              cloned.agentId = undefined
              cloned.isOn = false
              return cloned
            }),
            cards: validCards.map(cloneCardState),
            widgets: draft.widgets.map(cloneWidgetState),
            // Don't save viewport - always start layouts at default zoom/position
            viewport: { x: 0, y: 0, zoom: 1 },
            backgroundTheme,
            drawingObjects: draft.drawingObjects || [],
            createdAt: existingLayout?.createdAt || Date.now(),
          }

          draft.layouts.set(id, layoutData);
          draft.activeLayoutId = id;
        });

        return id;
      },

      loadLayout: (id, callbacks) =>
        set((state) => {
          const layout = state.layouts.get(id);
          if (layout) {
            // Validate and filter terminals before loading
            const validTerminals = layout.terminals.filter((t) => {
              if (!validateTerminalData(t)) {
                console.warn(`Skipping corrupt terminal in layout: ${(t as any)?.id}`);
                return false;
              }
              return true;
            });

            // Validate and filter cards before loading
            const validCards = layout.cards.filter((c) => {
              if (!validateCardData(c)) {
                console.warn(`Skipping corrupt card in layout: ${(c as any)?.id}`);
                return false;
              }
              return true;
            });

            state.terminals = new Map(
              validTerminals.map((t) => [t.id, cloneTerminalState(t)]),
            );
            state.cards = new Map(
              validCards.map((c) => [c.id, cloneCardState(c)]),
            );
            state.widgets = (layout.widgets || []).map(cloneWidgetState);
            state.viewport = { ...layout.viewport };
            state.activeLayoutId = id;
            state.drawingObjects = layout.drawingObjects || [];

            // Update maxZIndex
            const allZIndexes = [
              ...layout.terminals.map((t) => t.zIndex),
              ...layout.cards.map((c) => c.zIndex),
              ...(layout.widgets || []).map((w) => w.zIndex),
            ];
            state.maxZIndex = Math.max(0, ...allZIndexes);

            // Restore background theme if present and callback provided
            if (layout.backgroundTheme && callbacks?.onBackgroundChange) {
              callbacks.onBackgroundChange(layout.backgroundTheme);
            }
          }
        }),

      deleteLayout: (id) =>
        set((state) => {
          state.layouts.delete(id);
          if (state.activeLayoutId === id) {
            state.activeLayoutId = null;
          }
        }),

      renameLayout: (id, newName) =>
        set((state) => {
          const layout = state.layouts.get(id);
          if (layout) {
            layout.name = newName;
          }
        }),

      exportLayout: (id) => {
        const layout = get().layouts.get(id);
        return layout ? JSON.stringify(layout, null, 2) : "";
      },

      importLayout: (jsonData) =>
        set((state) => {
          try {
            const layout = JSON.parse(jsonData) as LayoutPreset;
            const newId = `layout-${Date.now()}`;
            layout.id = newId;
            layout.createdAt = Date.now();
            state.layouts.set(newId, layout);
          } catch (error) {
            console.error("Failed to import layout:", error);
          }
        }),

      // Utility actions
      clearCanvas: () =>
        set((state) => {
          state.terminals.clear();
          state.cards.clear();
          state.activeTerminalId = null;
          state.activeCardId = null;
          state.maxZIndex = 0;
        }),

      getNextZIndex: () => {
        const state = get();
        return state.maxZIndex + 1;
      },

      cleanupOrphanedTerminals: () =>
        set((state) => {
          // First, remove all orphaned offline terminals (no agentId, no lastAgentId, and no sessionId)
          const terminalsToKeep = Array.from(state.terminals.values()).filter((terminal) => {
            // Keep online terminals
            if (terminal.isOn && terminal.agentId) return true;

            // Keep offline terminals that were properly turned off (have lastAgentId)
            if (!terminal.isOn && terminal.lastAgentId) return true;

            // Keep offline terminals with tmux sessionId (can be reconnected)
            if (!terminal.isOn && (terminal.sessionId || terminal.sessionName)) return true;

            // Remove orphaned offline terminals (offline with no lastAgentId and no sessionId)
            return false;
          });

          // Clear the map and re-populate with cleaned terminals
          state.terminals.clear();
          terminalsToKeep.forEach((terminal) => {
            state.terminals.set(terminal.id, terminal);
          });

          // Then group remaining terminals by name for duplicate removal
          const terminalsByName = new Map<string, TerminalState[]>();
          state.terminals.forEach((terminal) => {
            const name = terminal.name;
            if (!terminalsByName.has(name)) {
              terminalsByName.set(name, []);
            }
            terminalsByName.get(name)!.push(terminal);
          });

          // For each group with duplicates, keep only the most recently active one that's connected
          terminalsByName.forEach((terminals, name) => {
            if (terminals.length > 1) {

              // Sort by lastActiveAt (most recent first)
              terminals.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));

              // Keep the first one that has an agentId or lastAgentId, or just the first one
              const toKeep = terminals.find(t => t.agentId || t.lastAgentId) || terminals[0];

              // Remove all others
              terminals.forEach(terminal => {
                if (terminal.id !== toKeep.id) {
                  state.terminals.delete(terminal.id);
                }
              });
            }
          });
        }),

      // Drawing actions
      setDrawingMode: (enabled) =>
        set((state) => {
          state.drawingMode = enabled;
          if (!enabled) {
            state.isDrawing = false;
            state.currentPath = [];
          }
        }),

      setCurrentDrawingTool: (tool) =>
        set((state) => {
          state.currentDrawingTool = tool;
        }),

      setDrawingStyle: (stroke, strokeWidth, fill) =>
        set((state) => {
          state.currentStroke = stroke;
          state.currentStrokeWidth = strokeWidth;
          state.currentFill = fill;
        }),

      startDrawing: (x, y) =>
        set((state) => {
          state.isDrawing = true;
          state.currentPath = [{ x, y }];
        }),

      addDrawingPoint: (x, y) =>
        set((state) => {
          if (state.isDrawing) {
            state.currentPath.push({ x, y });
          }
        }),

      finishDrawing: () =>
        set((state) => {
          if (!state.isDrawing || state.currentPath.length === 0) {
            state.isDrawing = false;
            state.currentPath = [];
            return;
          }

          const newDrawing: DrawingObject = {
            id: `drawing-${Date.now()}`,
            type: state.currentDrawingTool,
            points: [...state.currentPath],
            style: {
              stroke: state.currentStroke,
              strokeWidth: state.currentStrokeWidth,
              fill: state.currentFill,
              opacity: 1,
            },
            timestamp: Date.now(),
          };

          state.drawingObjects.push(newDrawing);
          state.isDrawing = false;
          state.currentPath = [];
        }),

      deleteDrawingObject: (id) =>
        set((state) => {
          state.drawingObjects = state.drawingObjects.filter((obj) => obj.id !== id);
        }),

      updateDrawingObject: (id, updates) =>
        set((state) => {
          const index = state.drawingObjects.findIndex((obj) => obj.id === id);
          if (index !== -1) {
            state.drawingObjects[index] = {
              ...state.drawingObjects[index],
              ...updates,
            };
          }
        }),

      clearAllDrawings: () =>
        set((state) => {
          state.drawingObjects = [];
        }),
    }))
    // TEST: persist config commented out for performance testing
    /*,
    {
      name: "opustrator-canvas-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Convert Maps to arrays of entries for proper JSON serialization
        // JSON.stringify converts Maps to {}, so we convert to arrays first
        // The merge function will convert them back to Maps on load
        terminals: Array.from(state.terminals.entries()),
        cards: Array.from(state.cards.entries()),
        // DO NOT persist viewport - causes coordinate system issues (per CLAUDE.md)
        // Terminal/card positions are in world coordinates, independent of viewport
        cardCategories: state.cardCategories,
        layouts: Array.from(state.layouts.entries()),
        activeLayoutId: state.activeLayoutId,
        maxZIndex: state.maxZIndex,
        drawingObjects: state.drawingObjects,
        sessionManagerPanel: state.sessionManagerPanel,
        selectedIds: Array.from(state.selectedIds),
      }),
      // Custom merge function to properly restore Maps from arrays
      merge: (persistedState: any, currentState: any) => {
        console.log('[CanvasStore] Merging persisted state');

        // Convert arrays back to Maps (partialize converted Maps to arrays)
        const cards = Array.isArray(persistedState?.cards)
          ? new Map(persistedState.cards)
          : new Map();
        const terminals = Array.isArray(persistedState?.terminals)
          ? new Map(persistedState.terminals)
          : new Map();
        const layouts = Array.isArray(persistedState?.layouts)
          ? new Map(persistedState.layouts)
          : new Map();
        const selectedIds = Array.isArray(persistedState?.selectedIds)
          ? new Set(persistedState.selectedIds)
          : new Set();

        console.log('  Restored cards:', cards.size);
        console.log('  Restored terminals:', terminals.size);

        // Ensure sessionManagerPanel has valid defaults if loaded from old localStorage
        const sessionManagerPanel = persistedState?.sessionManagerPanel
          ? {
              ...persistedState.sessionManagerPanel,
              size: persistedState.sessionManagerPanel.size || { width: 550, height: 800 },
              position: persistedState.sessionManagerPanel.position || { x: 100, y: 100 },
              viewportPosition: persistedState.sessionManagerPanel.viewportPosition || { x: 100, y: 100 },
            }
          : null;

        // IMPORTANT: Always ignore persisted viewport data and use default
        // This prevents coordinate system issues when viewport changes between saves
        // Old localStorage may have viewport data from before this fix
        const cleanedPersistedState = { ...persistedState };
        delete cleanedPersistedState.viewport;
        console.log('  Ignoring persisted viewport, using defaults');

        return {
          ...currentState,
          ...cleanedPersistedState,
          cards,
          terminals,
          layouts,
          selectedIds,
          sessionManagerPanel,
          // Use default viewport from currentState (zoom: 1, x: 0, y: 0)
          viewport: currentState.viewport,
        };
      },
    }
    */
);

// Direct selectors - return Maps to avoid conversion issues
export const useTerminalsMap = () => useCanvasStore((state) => state.terminals);
export const useCardsMap = () => useCanvasStore((state) => state.cards);
export const useLayoutsMap = () => useCanvasStore((state) => state.layouts);
export const useActiveTerminal = () => {
  const activeId = useCanvasStore((state) => state.activeTerminalId);
  return useCanvasStore((state) =>
    activeId ? state.terminals.get(activeId) : null,
  );
};
export const useActiveCard = () => {
  const activeId = useCanvasStore((state) => state.activeCardId);
  return useCanvasStore((state) =>
    activeId ? state.cards.get(activeId) : null,
  );
};
