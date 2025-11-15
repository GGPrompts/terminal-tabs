/**
 * AI Client - Frontend API client for AI features
 */

const API_BASE_URL = 'http://localhost:8127/api/ai';

export interface Suggestion {
  command: string;
  confidence: number;
  explanation: string;
  source: 'ai' | 'history' | 'template';
  error?: string;
}

export interface GeneratedCommand {
  command: string;
  explanation: string;
  destructive: boolean;
  confidence: number;
}

export interface ErrorAnalysis {
  type: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  explanation: string;
  suggestedFix: string;
  docsUrl?: string;
}

export interface AIConfig {
  provider: string;
  model: string;
  baseURL: string;
  temperature: number;
  maxTokens: number;
  hasApiKey: boolean;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  provider?: string;
  model?: string;
  error?: string;
}

/**
 * Get command suggestion based on partial input
 */
export async function getSuggestion(
  input: string,
  context: {
    cwd?: string;
    recentCommands?: string[];
    gitStatus?: string;
    gitRepo?: boolean;
    files?: string[];
  }
): Promise<Suggestion> {
  const response = await fetch(`${API_BASE_URL}/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, context }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Convert natural language to shell command
 */
export async function nlToCommand(
  prompt: string,
  context: {
    cwd?: string;
    gitRepo?: boolean;
  }
): Promise<GeneratedCommand> {
  const response = await fetch(`${API_BASE_URL}/nl-to-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, context }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Analyze error and get suggested fix
 */
export async function explainError(
  errorOutput: string,
  context: {
    cwd?: string;
    lastCommand?: string;
  }
): Promise<ErrorAnalysis> {
  const response = await fetch(`${API_BASE_URL}/explain-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errorOutput, context }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check AI service health
 */
export async function checkHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}` };
    }

    return response.json();
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current AI configuration
 */
export async function getConfig(): Promise<AIConfig> {
  const response = await fetch(`${API_BASE_URL}/config`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
