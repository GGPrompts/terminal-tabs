import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type BackgroundTheme =
  | "balatro"
  | "rain"
  | "clouds"
  | "particles"
  | "waves"
  | "gradient"
  | "embers"
  | "fireflies"
  | "space"
  | "stars"
  | "circuit"
  | "thunderstorm"
  | "ocean"
  | "crystal"
  | "none";
export type TerminalTheme =
  | "default"
  | "cyberpunk"
  | "matrix"
  | "holographic"
  | "vaporwave"
  | "aurora"
  | "synthwave"
  | "retro";

interface AppSettings {
  theme: "dark" | "light";
  backgroundTheme: BackgroundTheme;
  backgroundOpacity: number;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
  terminalDefaultTheme: TerminalTheme;
  terminalDefaultTransparency: number;
  terminalDefaultFontSize: number;
  terminalDefaultFontFamily: string;
  fileViewerDefaultFontSize: number;
  fileViewerDefaultTransparency: number;
  fileViewerDefaultTheme: string;
  fileViewerDefaultFontFamily: string;
  defaultTerminalSize: { width: number; height: number };

  // FileTree settings
  fileTreeMaxDepth: number;
  fileTreeLazyLoad: boolean;
  fileTreeSearchMaxDepth: number;
  defaultCardSize: { width: number; height: number };
  defaultFileViewerSize: { width: number; height: number };
  wasdBaseSpeed: number;
  forceZoomTo100OnSpawn: boolean;
  closeTerminalsOnLayoutSwitch: boolean;
  minimapOpacity: number;
  autoReconnectToTmuxSessions: boolean;

  // Canvas settings
  canvasTexture: string;
  canvasTextureIntensity: string;
  idleTimeout: number; // Milliseconds before background pauses when canvas is empty
  staticGradient: string; // Gradient used for "none" background and idle/paused states

  // Directory settings
  workingDirectory: string;
  directoryFavorites: string[];
  fileFavorites: string[];

  // UI flags
  seenFlags: {
    wasdNavigation: boolean;
  };
}

interface SettingsStore extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const defaultSettings: AppSettings = {
  theme: "dark",
  backgroundTheme: "space",
  backgroundOpacity: 0.8,
  gridEnabled: false,
  gridSize: 20,
  snapToGrid: false,
  terminalDefaultTheme: "default",
  terminalDefaultTransparency: 0.1,
  terminalDefaultFontSize: 16, // Match Word 12pt standard for better readability
  terminalDefaultFontFamily: "monospace", // System default monospace font
  fileViewerDefaultFontSize: 16, // Match Word 12pt standard for better readability
  fileViewerDefaultTransparency: 0.8, // 80% opacity (20% transparency)
  fileViewerDefaultTheme: "carbon",
  fileViewerDefaultFontFamily: "monospace", // System default monospace font for file viewers
  defaultTerminalSize: { width: 600, height: 720 },

  // FileTree settings
  fileTreeMaxDepth: 3, // Reduced from 8 for faster loading - use keyboard nav to go deeper
  fileTreeLazyLoad: true,
  fileTreeSearchMaxDepth: 10,
  defaultCardSize: { width: 300, height: 500 },
  defaultFileViewerSize: { width: 500, height: 600 },
  wasdBaseSpeed: 50,
  forceZoomTo100OnSpawn: true,
  closeTerminalsOnLayoutSwitch: false,
  minimapOpacity: 0.9,
  autoReconnectToTmuxSessions: true, // Set to false to prevent reconnecting to external tmux sessions

  // Canvas settings
  canvasTexture: "circuit",
  canvasTextureIntensity: "medium",
  idleTimeout: 5000, // 5 seconds default
  staticGradient: "space", // Deep space gradient by default

  // Directory settings
  workingDirectory: "/home/matt",
  directoryFavorites: [],
  fileFavorites: [],

  // UI flags
  seenFlags: {
    wasdNavigation: false,
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    immer((set, get) => ({
      ...defaultSettings,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({
          _hasHydrated: state
        });
      },

      updateSettings: (settings) =>
        set((state) => {
          Object.assign(state, settings);
        }),

      resetSettings: () => set(() => defaultSettings),

      exportSettings: () => {
        const {
          updateSettings,
          resetSettings,
          exportSettings,
          importSettings,
          _hasHydrated,
          setHasHydrated,
          ...settings
        } = get();
        return JSON.stringify(settings, null, 2);
      },

      importSettings: (json) =>
        set((state) => {
          try {
            const settings = JSON.parse(json) as Partial<AppSettings>;
            Object.assign(state, settings);
          } catch (error) {
            console.error("Failed to import settings:", error);
          }
        }),
    })),
    {
      name: "opustrator-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        console.log('[SettingsStore] Hydration complete, workingDirectory:', state?.workingDirectory);
        state?.setHasHydrated(true);
      },
      partialize: (state) => {
        // Exclude functions and hydration flag from persistence
        const { updateSettings, resetSettings, exportSettings, importSettings, _hasHydrated, setHasHydrated, ...settings } = state;
        return settings;
      },
    }
  )
);

export const backgroundThemes = [
  {
    value: "balatro",
    label: "🎰 Balatro",
    description: "Pixelated lava lamp effect",
  },
  { value: "rain", label: "🌧️ Rain", description: "Falling rain animation" },
  { value: "clouds", label: "☁️ Clouds", description: "Floating clouds" },
  {
    value: "particles",
    label: "✨ Particles",
    description: "Floating particles",
  },
  { value: "waves", label: "🌊 Waves", description: "Wave patterns" },
  {
    value: "gradient",
    label: "🌈 Gradient",
    description: "Soft shifting color gradient",
  },
  {
    value: "space",
    label: "🌌 Space",
    description: "Parallax starfield journey",
  },
  {
    value: "embers",
    label: "🔥 Embers",
    description: "Floating ember particles",
  },
  {
    value: "circuit",
    label: "🟩 Circuit",
    description: "Glowing circuit board grid",
  },
  {
    value: "thunderstorm",
    label: "⛈️ Thunderstorm",
    description: "Lightning flashes and clouds",
  },
  {
    value: "ocean",
    label: "🌊 Deep Ocean",
    description: "Ambient underwater waves",
  },
  {
    value: "crystal",
    label: "💎 Crystal",
    description: "Slow shimmering crystal light",
  },
  { value: "none", label: "⬜ None", description: "No background" },
];

export const terminalThemes = [
  { value: "default", label: "Default" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "matrix", label: "Matrix" },
  { value: "holographic", label: "Holographic" },
  { value: "vaporwave", label: "Vaporwave" },
  { value: "aurora", label: "Aurora" },
  { value: "synthwave", label: "Synthwave" },
  { value: "retro", label: "Retro" },
];

export const staticGradients = [
  { value: "balatro", label: "🎰 Balatro", description: "Warm lava lamp colors" },
  { value: "embers", label: "🔥 Embers", description: "Orange to red ember glow" },
  { value: "space", label: "🌌 Space", description: "Deep space blue-purple" },
  { value: "thunderstorm", label: "⛈️ Thunderstorm", description: "Stormy grey-blue" },
  { value: "ocean", label: "🌊 Ocean", description: "Deep ocean blue-teal" },
  { value: "crystal", label: "💎 Crystal", description: "Purple to blue shimmer" },
  { value: "circuit", label: "🟩 Circuit", description: "Dark grey with green" },
  { value: "rain", label: "🌧️ Rain", description: "Dark blue grey" },
  { value: "clouds", label: "☁️ Clouds", description: "Light sky (light mode)" },
  { value: "particles", label: "✨ Particles", description: "Dark with warmth" },
  { value: "gradient", label: "🌈 Gradient", description: "Subtle purple-blue" },
  { value: "default", label: "🌑 Default", description: "Deep blue-grey" },
];
