import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Terminal {
  id: string;
  name: string;
  terminalType: string;
  icon?: string;
  agentId?: string;
  workingDir?: string;
  theme?: string;
  transparency?: number;
  fontSize?: number;
  fontFamily?: string;
  sessionName?: string;
  createdAt: number;
  status?: 'spawning' | 'active' | 'closed' | 'error';
  requestId?: string; // For matching placeholder with WebSocket response
}

interface SimpleTerminalState {
  terminals: Terminal[];
  activeTerminalId: string | null;

  // Actions
  addTerminal: (terminal: Terminal) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, updates: Partial<Terminal>) => void;
  setActiveTerminal: (id: string | null) => void;
  clearAllTerminals: () => void;
}

export const useSimpleTerminalStore = create<SimpleTerminalState>()(
  persist(
    (set) => ({
      terminals: [],
      activeTerminalId: null,

      addTerminal: (terminal) =>
        set((state) => ({
          terminals: [...state.terminals, terminal],
          activeTerminalId: terminal.id,
        })),

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
        set({ terminals: [], activeTerminalId: null }),
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
