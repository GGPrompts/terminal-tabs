import {
  Terminal as TerminalIcon,
  Bot,
  Sparkles,
  Code2,
  Theater,
  Shell,
  Zap,
  FileCode,
  Monitor,
  GitBranch,
  Database,
  Cpu,
  Boxes,
  FileJson,
  Wrench,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TerminalIconConfig {
  icon: LucideIcon;
  color: string;
  bgGradient: string;
  label: string;
  category: 'agent' | 'utility' | 'tool';
}

export const TERMINAL_ICON_MAP: Record<string, TerminalIconConfig> = {
  'claude-code': {
    icon: Bot,
    color: '#ff6b35',
    bgGradient: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
    label: 'Claude Code',
    category: 'agent',
  },
  'opencode': {
    icon: Code2,
    color: '#9333ea',
    bgGradient: 'linear-gradient(135deg, #9333ea 0%, #c084fc 100%)',
    label: 'OpenCode',
    category: 'agent',
  },
  'codex': {
    icon: FileJson,
    color: '#06b6d4',
    bgGradient: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
    label: 'Codex',
    category: 'agent',
  },
  'orchestrator': {
    icon: Theater,
    color: '#fbbf24',
    bgGradient: 'linear-gradient(135deg, #fbbf24 0%, #fde047 100%)',
    label: 'Orchestrator',
    category: 'agent',
  },
  'gemini': {
    icon: Sparkles,
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    label: 'Gemini',
    category: 'agent',
  },
  'bash': {
    icon: Shell,
    color: '#737373',
    bgGradient: 'linear-gradient(135deg, #737373 0%, #a3a3a3 100%)',
    label: 'Bash',
    category: 'utility',
  },
  'python': {
    icon: FileCode,
    color: '#3776ab',
    bgGradient: 'linear-gradient(135deg, #3776ab 0%, #4b8bbe 100%)',
    label: 'Python',
    category: 'utility',
  },
  'script': {
    icon: FileCode,
    color: '#a3a3a3',
    bgGradient: 'linear-gradient(135deg, #a3a3a3 0%, #d4d4d4 100%)',
    label: 'Script',
    category: 'utility',
  },
  'tui-tool': {
    icon: Monitor,
    color: '#3b82f6',
    bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
    label: 'TUI Tool',
    category: 'utility',
  },
  'lazygit': {
    icon: GitBranch,
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    label: 'LazyGit',
    category: 'tool',
  },
  'database': {
    icon: Database,
    color: '#10b981',
    bgGradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    label: 'Database',
    category: 'tool',
  },
  'htop': {
    icon: Activity,
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
    label: 'htop',
    category: 'tool',
  },
  'docker': {
    icon: Boxes,
    color: '#0ea5e9',
    bgGradient: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
    label: 'Docker',
    category: 'tool',
  },
  'default': {
    icon: TerminalIcon,
    color: '#6b7280',
    bgGradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
    label: 'Terminal',
    category: 'utility',
  },
};

export function getTerminalIcon(terminalType: string): TerminalIconConfig {
  return TERMINAL_ICON_MAP[terminalType] || TERMINAL_ICON_MAP.default;
}
