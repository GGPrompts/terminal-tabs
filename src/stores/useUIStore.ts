import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarTab: string;
  sidebarWidth: number;

  // Chat/Command Dispatcher state
  chatPosition: { x: number; y: number };
  chatSize: { width: number; height: number };
  chatMinimized: boolean;

  // Minimap state
  minimapVisible: boolean;
  minimapPosition: { x: number; y: number };
  minimapSize: { width: number; height: number };

  // Fullscreen state
  isFullscreenMode: boolean;

  // Modal states
  lastOpenModal: string | null;
  modalPositions: Record<string, { x: number; y: number }>;

  // File viewer preferences
  fileViewerFontSize: number;
  fileViewerLineWrap: boolean;
  fileViewerTheme: string;

  // Other UI preferences
  showConnectionStatus: boolean;
  showPerformanceMetrics: boolean;
  autoHideMenuBar: boolean;
}

interface UIActions {
  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: string) => void;
  setSidebarWidth: (width: number) => void;

  // Fullscreen actions
  setIsFullscreenMode: (fullscreen: boolean) => void;
  toggleFullscreenMode: () => void;

  // Chat actions
  setChatPosition: (position: { x: number; y: number }) => void;
  setChatSize: (size: { width: number; height: number }) => void;
  setChatMinimized: (minimized: boolean) => void;

  // Minimap actions
  setMinimapVisible: (visible: boolean) => void;
  setMinimapPosition: (position: { x: number; y: number }) => void;
  setMinimapSize: (size: { width: number; height: number }) => void;

  // Modal actions
  setLastOpenModal: (modal: string | null) => void;
  setModalPosition: (modal: string, position: { x: number; y: number }) => void;

  // File viewer actions
  setFileViewerFontSize: (size: number) => void;
  setFileViewerLineWrap: (wrap: boolean) => void;
  setFileViewerTheme: (theme: string) => void;

  // Other preferences
  setShowConnectionStatus: (show: boolean) => void;
  setShowPerformanceMetrics: (show: boolean) => void;
  setAutoHideMenuBar: (autoHide: boolean) => void;

  // Batch update
  updateUI: (updates: Partial<UIState>) => void;
  resetUI: () => void;
}

type UIStore = UIState & UIActions;

const defaultState: UIState = {
  // Sidebar defaults
  sidebarOpen: true,
  sidebarTab: "activity",
  sidebarWidth: 300,

  // Chat defaults
  chatPosition: { x: window.innerWidth - 500, y: window.innerHeight - 520 },
  chatSize: { width: 480, height: 500 },
  chatMinimized: false,

  // Minimap defaults
  minimapVisible: true,
  minimapPosition: { x: 20, y: 20 },
  minimapSize: { width: 200, height: 150 },

  // Fullscreen defaults
  isFullscreenMode: false,

  // Modal defaults
  lastOpenModal: null,
  modalPositions: {},

  // File viewer defaults
  fileViewerFontSize: 14,
  fileViewerLineWrap: false,
  fileViewerTheme: "vs-dark",

  // Other preferences
  showConnectionStatus: true,
  showPerformanceMetrics: false,
  autoHideMenuBar: false,
};

export const useUIStore = create<UIStore>()(
  persist(
    immer((set) => ({
      ...defaultState,

      // Sidebar actions
      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open;
        }),
      setSidebarTab: (tab) =>
        set((state) => {
          state.sidebarTab = tab;
        }),
      setSidebarWidth: (width) =>
        set((state) => {
          state.sidebarWidth = width;
        }),

      // Fullscreen actions
      setIsFullscreenMode: (fullscreen) =>
        set((state) => {
          state.isFullscreenMode = fullscreen;
        }),
      toggleFullscreenMode: () =>
        set((state) => {
          state.isFullscreenMode = !state.isFullscreenMode;
        }),

      // Chat actions
      setChatPosition: (position) =>
        set((state) => {
          state.chatPosition = position;
        }),
      setChatSize: (size) =>
        set((state) => {
          state.chatSize = size;
        }),
      setChatMinimized: (minimized) =>
        set((state) => {
          state.chatMinimized = minimized;
        }),

      // Minimap actions
      setMinimapVisible: (visible) =>
        set((state) => {
          state.minimapVisible = visible;
        }),
      setMinimapPosition: (position) =>
        set((state) => {
          state.minimapPosition = position;
        }),
      setMinimapSize: (size) =>
        set((state) => {
          state.minimapSize = size;
        }),

      // Modal actions
      setLastOpenModal: (modal) =>
        set((state) => {
          state.lastOpenModal = modal;
        }),
      setModalPosition: (modal, position) =>
        set((state) => {
          state.modalPositions[modal] = position;
        }),

      // File viewer actions
      setFileViewerFontSize: (size) =>
        set((state) => {
          state.fileViewerFontSize = size;
        }),
      setFileViewerLineWrap: (wrap) =>
        set((state) => {
          state.fileViewerLineWrap = wrap;
        }),
      setFileViewerTheme: (theme) =>
        set((state) => {
          state.fileViewerTheme = theme;
        }),

      // Other preferences
      setShowConnectionStatus: (show) =>
        set((state) => {
          state.showConnectionStatus = show;
        }),
      setShowPerformanceMetrics: (show) =>
        set((state) => {
          state.showPerformanceMetrics = show;
        }),
      setAutoHideMenuBar: (autoHide) =>
        set((state) => {
          state.autoHideMenuBar = autoHide;
        }),

      // Batch update
      updateUI: (updates) =>
        set((state) => {
          Object.assign(state, updates);
        }),

      // Reset to defaults
      resetUI: () => set(() => defaultState),
    })),
    {
      name: "opustrator-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist UI preferences but not transient state
        sidebarOpen: state.sidebarOpen,
        sidebarTab: state.sidebarTab,
        sidebarWidth: state.sidebarWidth,
        chatMinimized: state.chatMinimized,
        minimapVisible: state.minimapVisible,
        fileViewerFontSize: state.fileViewerFontSize,
        fileViewerLineWrap: state.fileViewerLineWrap,
        fileViewerTheme: state.fileViewerTheme,
        showConnectionStatus: state.showConnectionStatus,
        showPerformanceMetrics: state.showPerformanceMetrics,
        autoHideMenuBar: state.autoHideMenuBar,
        // Don't persist positions/sizes/zoom - let those reset on reload
      }),
    }
  )
);
