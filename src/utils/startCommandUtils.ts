/**
 * Utility functions for generating terminal start commands
 */

/**
 * Generate the appropriate start command for a terminal based on its type and working directory
 */
export function generateStartCommand(terminalType: string, workingDir?: string): string {
  // Map of terminal types to their commands
  const aiCommands: Record<string, string> = {
    'claude-code': 'claude',
    'opencode': 'opencode',
    'codex': 'codex',
    'gemini': 'gemini',
    'gordon': 'gordon',
    'mc': 'mc'
  };

  // If it's an AI terminal type, use its specific command
  if (aiCommands[terminalType]) {
    const command = aiCommands[terminalType];
    return workingDir
      ? `cd ${workingDir} && ${command}`
      : command;
  }

  // For TUI tools, just use the tool name
  if (terminalType === 'tui-tool') {
    return workingDir
      ? `cd ${workingDir}`
      : '';
  }

  // Default to bash for regular terminals
  return workingDir
    ? `cd ${workingDir} && bash`
    : 'bash';
}

/**
 * Get just the command name for display purposes
 */
export function getTerminalCommand(terminalType: string): string {
  const aiCommands: Record<string, string> = {
    'claude-code': 'claude',
    'opencode': 'opencode',
    'codex': 'codex',
    'gemini': 'gemini',
    'gordon': 'gordon',
    'mc': 'mc'
  };

  return aiCommands[terminalType] || 'bash';
}

/**
 * Check if a terminal type is an AI assistant
 */
export function isAITerminal(terminalType: string): boolean {
  return ['claude-code', 'opencode', 'codex', 'gemini', 'gordon', 'mc'].includes(terminalType);
}