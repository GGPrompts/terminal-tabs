import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface SplitPane {
  id: string;
  terminalId: string; // References another terminal in the store
  size: number; // Percentage (0-100)
  position: 'left' | 'right' | 'top' | 'bottom';
}

export interface SplitLayout {
  type: 'single' | 'vertical' | 'horizontal';
  panes: SplitPane[];
}

export interface Terminal {
  id: string;
  name: string;
  terminalType: string;
  command?: string; // Original command (e.g., 'tfe', 'lazygit') for matching during reconnection
  icon?: string;
  agentId?: string;
  workingDir?: string;
  theme?: string; // Text color theme (amber, matrix, etc.)
  background?: string; // Background gradient key (dark-neutral, amber-warmth, etc.)
  transparency?: number;
  fontSize?: number;
  fontFamily?: string;
  sessionName?: string;
  createdAt: number;
  status?: 'spawning' | 'active' | 'closed' | 'error';
  requestId?: string; // For matching placeholder with WebSocket response
  isHidden?: boolean; // Hide from tab bar (e.g., when part of a split)
  windowId?: string; // Which browser window/tab this terminal belongs to (for multi-window support)

  // Split layout data (Phase 1 of split layout system)
  splitLayout?: SplitLayout;
}

interface SimpleTerminalState {
  terminals: Terminal[];
  activeTerminalId: string | null;
  focusedTerminalId: string | null; // Track focused pane in splits

  // Actions
  addTerminal: (terminal: Terminal) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, updates: Partial<Terminal>) => void;
  setActiveTerminal: (id: string | null) => void;
  clearAllTerminals: () => void;
  reorderTerminals: (newOrder: Terminal[]) => void;
  setFocusedTerminal: (id: string | null) => void;
}

export const useSimpleTerminalStore = create<SimpleTerminalState>()(
  persist(
    (set) => ({
      terminals: [],
      activeTerminalId: null,
      focusedTerminalId: null,

      addTerminal: (terminal) =>
        set((state) => {
          // Only set as active if we don't have an active terminal yet
          // This prevents cross-window interference when spawning from other windows
          const shouldSetActive = !state.activeTerminalId
          return {
            terminals: [...state.terminals, terminal],
            activeTerminalId: shouldSetActive ? terminal.id : state.activeTerminalId,
          }
        }),

      removeTerminal: (id) =>
        set((state) => {
          const newTerminals = state.terminals.filter((t) => t.id !== id);
          const newActiveId =
            state.activeTerminalId === id
              ? newTerminals[newTerminals.length - 1]?.id ?? null
              : state.activeTerminalId;

          return {
            terminals: newTerminals,
            activeTerminalId: newActiveId,
          };
        }),

      updateTerminal: (id, updates) =>
        set((state) => ({
          terminals: state.terminals.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      setActiveTerminal: (id) =>
        set({ activeTerminalId: id }),

      clearAllTerminals: () =>
        set({ terminals: [], activeTerminalId: null, focusedTerminalId: null }),

      reorderTerminals: (newOrder) =>
        set({ terminals: newOrder }),

      setFocusedTerminal: (id) =>
        set({ focusedTerminalId: id }),
    }),
    {
      name: "simple-terminal-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        terminals: state.terminals,
        activeTerminalId: state.activeTerminalId,
      }),
    }
  )
);
