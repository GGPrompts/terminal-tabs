import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface AgentTemplate {
  id: string;
  name: string;
  terminalType: string;
  description?: string;
  icon?: string;
  color?: string;
  platform?: string;
  resumable?: boolean;
  tags?: string[];
  workingDir?: string;
  startCommand?: string;
  customConfig?: Record<string, any>;
  createdAt: number;
  lastUsed?: number;
  favorite?: boolean;
}

interface AgentsStore {
  templates: AgentTemplate[];
  customTemplates: AgentTemplate[];
  recentAgents: string[]; // IDs of recently used agents
  favoriteAgents: string[]; // IDs of favorite agents

  addCustomTemplate: (
    template: Omit<AgentTemplate, "id" | "createdAt">,
  ) => void;
  updateTemplate: (id: string, updates: Partial<AgentTemplate>) => void;
  deleteCustomTemplate: (id: string) => void;

  addToRecent: (id: string) => void;
  toggleFavorite: (id: string) => void;

  importTemplates: (templates: AgentTemplate[]) => void;
  exportTemplates: () => string;

  getTemplateById: (id: string) => AgentTemplate | undefined;
  getAllTemplates: () => AgentTemplate[];
}

const defaultTemplates: AgentTemplate[] = [
  {
    id: "frontend-dev",
    name: "frontend-dev",
    terminalType: "claude-code",
    description: "Frontend development with React, Vue, and modern frameworks",
    icon: "🎨",
    color: "#ff6b35",
    platform: "local",
    resumable: true,
    tags: ["frontend", "react", "vue", "typescript"],
    createdAt: Date.now(),
  },
  {
    id: "backend-dev",
    name: "backend-dev",
    terminalType: "opencode",
    description: "Backend development with Node.js, Python, and databases",
    icon: "⚙️",
    color: "#4ecdc4",
    platform: "local",
    resumable: true,
    tags: ["backend", "nodejs", "python", "database"],
    createdAt: Date.now(),
  },
  {
    id: "data-science",
    name: "data-science",
    terminalType: "claude-code",
    description: "Data analysis, machine learning, and visualization",
    icon: "📊",
    color: "#95e1d3",
    platform: "local",
    resumable: true,
    tags: ["data", "ml", "python", "jupyter"],
    createdAt: Date.now(),
  },
  {
    id: "devops",
    name: "devops",
    terminalType: "opencode",
    description: "DevOps, CI/CD, containers, and infrastructure",
    icon: "🚀",
    color: "#f38181",
    platform: "local",
    resumable: false,
    tags: ["devops", "docker", "kubernetes", "ci/cd"],
    createdAt: Date.now(),
  },
  {
    id: "orchestrator",
    name: "orchestrator",
    terminalType: "orchestrator",
    description: "Multi-agent orchestration and coordination",
    icon: "🎭",
    color: "#aa96da",
    platform: "local",
    resumable: true,
    tags: ["orchestrator", "multi-agent", "coordination"],
    createdAt: Date.now(),
  },
  {
    id: "claude-default",
    name: "Claude Code",
    terminalType: "claude-code",
    description: "Default Claude Code agent",
    icon: "🤖",
    color: "#8a2be2",
    platform: "local",
    resumable: true,
    tags: ["claude", "ai", "assistant"],
    createdAt: Date.now(),
  },
  {
    id: "opencode-default",
    name: "OpenCode",
    terminalType: "opencode",
    description: "Default OpenCode agent",
    icon: "💻",
    color: "#00bcd4",
    platform: "local",
    resumable: true,
    tags: ["opencode", "coding", "assistant"],
    createdAt: Date.now(),
  },
  {
    id: "bash-terminal",
    name: "Bash Terminal",
    terminalType: "bash",
    description: "Standard bash terminal",
    icon: "🖥️",
    color: "#2c3e50",
    platform: "local",
    resumable: false,
    tags: ["terminal", "bash", "shell"],
    createdAt: Date.now(),
  },
];

export const useAgentsStore = create<AgentsStore>()(
  immer((set, get) => ({
      templates: defaultTemplates,
      customTemplates: [],
      recentAgents: [],
      favoriteAgents: [],

      addCustomTemplate: (template) =>
        set((state) => {
          const newTemplate: AgentTemplate = {
            ...template,
            id: `custom-${Date.now()}`,
            createdAt: Date.now(),
          };
          state.customTemplates.push(newTemplate);
        }),

      updateTemplate: (id, updates) =>
        set((state) => {
          const customIndex = state.customTemplates.findIndex(
            (t) => t.id === id,
          );
          if (customIndex !== -1) {
            state.customTemplates[customIndex] = {
              ...state.customTemplates[customIndex],
              ...updates,
            };
          }
        }),

      deleteCustomTemplate: (id) =>
        set((state) => {
          state.customTemplates = state.customTemplates.filter(
            (t) => t.id !== id,
          );
          state.recentAgents = state.recentAgents.filter(
            (agentId) => agentId !== id,
          );
          state.favoriteAgents = state.favoriteAgents.filter(
            (agentId) => agentId !== id,
          );
        }),

      addToRecent: (id) =>
        set((state) => {
          state.recentAgents = [
            id,
            ...state.recentAgents.filter((agentId) => agentId !== id),
          ].slice(0, 10);

          const allTemplates = [...state.templates, ...state.customTemplates];
          const template = allTemplates.find((t) => t.id === id);
          if (template) {
            template.lastUsed = Date.now();
          }
        }),

      toggleFavorite: (id) =>
        set((state) => {
          const isFavorite = state.favoriteAgents.includes(id);
          if (isFavorite) {
            state.favoriteAgents = state.favoriteAgents.filter(
              (agentId) => agentId !== id,
            );
          } else {
            state.favoriteAgents.push(id);
          }

          const allTemplates = [...state.templates, ...state.customTemplates];
          const template = allTemplates.find((t) => t.id === id);
          if (template) {
            template.favorite = !isFavorite;
          }
        }),

      importTemplates: (templates) =>
        set((state) => {
          const imported = templates.map((t) => ({
            ...t,
            id: `imported-${Date.now()}-${Math.random()}`,
            createdAt: Date.now(),
          }));
          state.customTemplates.push(...imported);
        }),

      exportTemplates: () => {
        const state = get();
        return JSON.stringify(state.customTemplates, null, 2);
      },

      getTemplateById: (id) => {
        const state = get();
        return [...state.templates, ...state.customTemplates].find(
          (t) => t.id === id,
        );
      },

      getAllTemplates: () => {
        const state = get();
        return [...state.templates, ...state.customTemplates];
      },
    })),
);

export const agentCategories = [
  { value: "all", label: "All Agents" },
  { value: "favorites", label: "⭐ Favorites" },
  { value: "recent", label: "🕐 Recent" },
  { value: "claude", label: "🤖 Claude" },
  { value: "opencode", label: "💻 OpenCode" },
  { value: "custom", label: "✨ Custom" },
];
