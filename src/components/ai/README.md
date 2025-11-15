# AI Components

AI-powered features for terminal workflows (experimental).

## Components

### AICommandSuggester

Inline command suggestions powered by AI, similar to GitHub Copilot for the terminal.

**Features:**
- Real-time suggestions as you type (debounced 500ms)
- Context-aware (current directory, git status, recent commands, files)
- Confidence scores (0-100%)
- Press **Tab** to accept, **Esc** to dismiss
- Fallback when AI service unavailable

**Usage:**

```tsx
import { AICommandSuggester } from '@/components/ai/AICommandSuggester';
import { useState } from 'react';

function TerminalWithAI() {
  const [input, setInput] = useState('');

  const handleAccept = (command: string) => {
    setInput(command);
    // Optionally submit the command
    submitCommand(command);
  };

  return (
    <div className="relative">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="terminal-input"
      />

      <AICommandSuggester
        terminalId="terminal-123"
        currentInput={input}
        onAccept={handleAccept}
        enabled={true}
      />
    </div>
  );
}
```

**Props:**
- `terminalId` (string, required): Terminal ID to get context from
- `currentInput` (string, required): Current terminal input
- `onAccept` (function, required): Callback when suggestion is accepted
- `enabled` (boolean, optional): Enable/disable suggestions (default: true)

---

### ErrorDiagnosticsPanel

Real-time error detection with AI-powered fixes for terminal errors.

**Features:**
- Pattern matching for 15+ common error types (npm, git, Python, TypeScript, etc.)
- AI-powered error analysis (optional)
- One-click "Apply Fix" button
- Stack trace parsing and display
- Documentation links
- Severity levels (warning, error, critical)
- Demo mode with sample errors
- Collapsible detailed view

**Usage:**

```tsx
import { ErrorDiagnosticsPanel } from '@/components/ai/ErrorDiagnosticsPanel';
import { useState } from 'react';

function TerminalWithErrorDetection() {
  const [terminalOutput, setTerminalOutput] = useState('');

  const handleApplyFix = (fix: string) => {
    // Send fix command to terminal
    sendCommandToTerminal(fix);
  };

  return (
    <div>
      {/* Your terminal component */}
      <Terminal onOutput={(output) => setTerminalOutput(output)} />

      {/* Error Diagnostics Panel */}
      <ErrorDiagnosticsPanel
        terminalId="terminal-123"
        terminalOutput={terminalOutput}
        onApplyFix={handleApplyFix}
        enabled={true}
      />
    </div>
  );
}
```

**Props:**
- `terminalId` (string, required): Terminal ID to get context for AI analysis
- `terminalOutput` (string, required): Current terminal output to scan for errors
- `onApplyFix` (function, required): Callback when user clicks "Apply Fix" with the suggested fix command
- `enabled` (boolean, optional): Enable/disable error detection (default: true)
- `demoMode` (boolean, optional): Show sample errors for testing (default: false)
- `className` (string, optional): Additional CSS classes

**Demo Mode:**

```tsx
import { ErrorDiagnosticsDemo } from '@/components/ai/ErrorDiagnosticsDemo';

// Interactive demo showcasing all features
function DemoPage() {
  return <ErrorDiagnosticsDemo />;
}
```

**Detected Error Types (29 patterns total):**

**Terminal/CLI Errors (15 patterns):**
1. **Command Not Found** - Typos, uninstalled commands, missing packages
2. **npm Errors** - ENOENT, EACCES, 404, ERESOLVE, and more
3. **Git Errors** - Not a repo, remote conflicts, merge issues
4. **Python Errors** - ModuleNotFoundError, SyntaxError, IndentationError
5. **Build Errors** - TypeScript, ESLint failures
6. **Permission Errors** - EACCES, permission denied
7. **Network Errors** - ENOTFOUND, ETIMEDOUT, ECONNREFUSED

**Browser/JavaScript Errors (14 patterns):**
8. **JavaScript Runtime** - TypeError, ReferenceError, Uncaught errors
9. **React Errors** - Hooks violations, unmounted state updates, invalid children
10. **Build Errors (Vite/Webpack)** - Failed imports, module not found, transform errors
11. **Network/Fetch** - Failed to fetch, CORS errors
12. **Console Warnings** - Missing keys, deprecated APIs

**Example Fixes:**

**Terminal Errors:**
- `gti` → Suggests `git` (common typo)
- `npm ERR! ENOENT` → Suggests `npm init -y`
- `ModuleNotFoundError: No module named 'requests'` → Suggests `pip install requests`
- `fatal: not a git repository` → Suggests `git init`
- Permission errors → Suggests fixing npm permissions (never use sudo!)

**Browser Errors:**
- `TypeError: Cannot read property 'X' of undefined` → Suggests optional chaining `object?.X`
- `ReferenceError: useState is not defined` → Suggests import statement
- `Warning: Missing key prop` → Suggests adding unique keys to list items
- `Can't perform React state update on unmounted` → Suggests cleanup in useEffect
- `Failed to fetch` → Suggests error handling and CORS check
- `CORS policy error` → Suggests adding CORS headers to backend

**AI Analysis:**

Click the "AI Analysis" button on any error to get deeper insights from the AI:
- More detailed explanation
- Alternative fixes
- Best practices
- Relevant documentation

The AI analysis uses the `/api/ai/explain-error` endpoint and provides context-aware suggestions based on your current directory, recent commands, and git status.

**Browser Error Detection:**

ErrorDiagnosticsPanel automatically detects browser errors from forwarded console logs! Since browser console logs are forwarded to the backend terminal (when `LOG_LEVEL >= 4` in backend/.env), you get instant frontend error detection with:

- JavaScript runtime errors (TypeError, ReferenceError)
- React errors (hooks violations, unmounted updates)
- Build errors (Vite/Webpack import failures)
- Network errors (fetch failures, CORS issues)
- Console warnings (missing keys, deprecated APIs)

**Example:**
```javascript
// Browser console logs this:
console.error('TypeError: Cannot read property "length" of undefined');

// Backend terminal receives:
[Browser:utils.ts:42] TypeError: Cannot read property 'length' of undefined

// ErrorDiagnosticsPanel detects and shows fix:
// Use optional chaining: object?.length
```

See **BROWSER_ERRORS_ADDED.md** for complete list of 14 browser error patterns!

## Hooks

### useTerminalContext

Gathers contextual information about a terminal session for AI suggestions.

**Usage:**

```tsx
import { useTerminalContext } from '@/hooks/useTerminalContext';

function MyComponent({ terminalId }: { terminalId: string }) {
  const context = useTerminalContext(terminalId);

  console.log(context.cwd); // Current working directory
  console.log(context.recentCommands); // Last 10 commands
  console.log(context.gitRepo); // Is this a git repository?
  console.log(context.gitStatus); // Git status summary
  console.log(context.files); // Files in current directory

  return <div>...</div>;
}
```

**Returns:**
```typescript
{
  cwd: string;              // Current working directory (~/projects/myapp)
  recentCommands: string[]; // Last 10 commands
  gitStatus?: string;       // Git status summary (e.g., "3 files changed")
  gitRepo?: boolean;        // Is this a git repository?
  files?: string[];         // Files in current directory (max 50)
  lastCommand?: string;     // Most recent command
}
```

**Auto-refresh:** Context is refreshed every 5 seconds.

## AI Client

Utility functions for calling AI API endpoints.

```tsx
import * as aiClient from '@/lib/ai-client';

// Get command suggestion
const suggestion = await aiClient.getSuggestion('git com', {
  cwd: '~/projects/myapp',
  recentCommands: ['git add .', 'npm test'],
  gitRepo: true,
});

// Natural language to command
const result = await aiClient.nlToCommand('install react router', {
  cwd: '~/projects/myapp',
});

// Explain error
const analysis = await aiClient.explainError(
  'npm ERR! code ENOENT',
  { cwd: '~/projects/myapp', lastCommand: 'npm install' }
);

// Health check
const health = await aiClient.checkHealth();
console.log(health.status); // 'ok' or 'error'

// Get config
const config = await aiClient.getConfig();
console.log(config.model); // 'qwen2.5-coder:7b'
```

## Backend Setup

### Environment Variables

Add to `backend/.env`:

```bash
# AI Configuration
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1  # Or your vLLM endpoint
AI_MODEL=qwen2.5-coder:7b
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=500

# Optional: API key (if using OpenAI or similar)
# AI_API_KEY=sk-...
```

### Supported Providers

The backend supports any **OpenAI-compatible API**:

1. **Ollama** (local, privacy-first)
   ```bash
   AI_BASE_URL=http://localhost:11434/v1
   AI_MODEL=qwen2.5-coder:7b
   ```

2. **vLLM** (Docker, local)
   ```bash
   AI_BASE_URL=http://localhost:8000/v1
   AI_MODEL=Qwen/Qwen2.5-Coder-7B-Instruct
   ```

3. **OpenAI** (cloud)
   ```bash
   AI_BASE_URL=https://api.openai.com/v1
   AI_MODEL=gpt-4o-mini
   AI_API_KEY=sk-...
   ```

4. **Anthropic Claude** (via OpenAI proxy)
   ```bash
   AI_BASE_URL=https://your-proxy.com/v1
   AI_MODEL=claude-3-haiku
   AI_API_KEY=sk-...
   ```

### API Endpoints

#### POST /api/ai/suggest
Get command suggestion based on partial input.

**Request:**
```json
{
  "input": "git com",
  "context": {
    "cwd": "~/projects/myapp",
    "recentCommands": ["git add ."],
    "gitRepo": true,
    "gitStatus": "2 files changed"
  }
}
```

**Response:**
```json
{
  "command": "git commit -m \"message\"",
  "confidence": 85,
  "explanation": "Commit staged changes with a message",
  "source": "ai"
}
```

#### POST /api/ai/nl-to-command
Convert natural language to shell command.

**Request:**
```json
{
  "prompt": "install react router",
  "context": {
    "cwd": "~/projects/myapp"
  }
}
```

**Response:**
```json
{
  "command": "npm install react-router-dom",
  "explanation": "Installs React Router DOM package",
  "destructive": false,
  "confidence": 95
}
```

#### POST /api/ai/explain-error
Analyze error and suggest fix.

**Request:**
```json
{
  "errorOutput": "npm ERR! code ENOENT",
  "context": {
    "cwd": "~/projects/myapp",
    "lastCommand": "npm install"
  }
}
```

**Response:**
```json
{
  "type": "npm_error",
  "severity": "error",
  "message": "npm ERR! code ENOENT",
  "explanation": "package.json not found",
  "suggestedFix": "npm init -y",
  "docsUrl": "https://docs.npmjs.com/cli/v10/commands/npm-init"
}
```

#### GET /api/ai/health
Check if AI service is available.

**Response:**
```json
{
  "status": "ok",
  "provider": "openai-compatible",
  "model": "qwen2.5-coder:7b"
}
```

#### GET /api/ai/config
Get current AI configuration (without sensitive data).

**Response:**
```json
{
  "provider": "openai-compatible",
  "model": "qwen2.5-coder:7b",
  "baseURL": "http://localhost:11434/v1",
  "temperature": 0.7,
  "maxTokens": 500,
  "hasApiKey": false
}
```

## Testing

### 1. Setup AI Backend

**Option A: Ollama (recommended for local development)**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull qwen2.5-coder:7b

# Ollama runs on http://localhost:11434
```

**Option B: vLLM (Docker)**
```bash
# Run vLLM container with your model
docker run -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model Qwen/Qwen2.5-Coder-7B-Instruct

# vLLM runs on http://localhost:8000
```

### 2. Configure Backend

Update `backend/.env`:
```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:11434/v1  # Or http://localhost:8000/v1 for vLLM
AI_MODEL=qwen2.5-coder:7b
```

### 3. Test API

```bash
# Health check
curl http://localhost:8127/api/ai/health

# Test suggestion
curl -X POST http://localhost:8127/api/ai/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "input": "git com",
    "context": {
      "cwd": "~/projects",
      "gitRepo": true
    }
  }'
```

### 4. Test in UI

1. Start the app: `./start-tmux.sh`
2. Open a terminal
3. Start typing a command (minimum 3 characters)
4. Wait for AI suggestion to appear (500ms debounce)
5. Press **Tab** to accept or **Esc** to dismiss

## Performance

- **Debounce:** 500ms (prevents API spam while typing)
- **Context refresh:** Every 5 seconds (for terminal context)
- **Min input length:** 3 characters (prevents unnecessary API calls)
- **Timeout:** 30 seconds (AI request timeout)

## Privacy

- **Local-first:** Use Ollama or vLLM for complete privacy
- **No telemetry:** Commands/context never sent to external services (unless using cloud AI)
- **Opt-in:** AI features are disabled by default
- **Transparent:** All AI calls logged in backend

## Future Components

Planned AI components (from IMPLEMENTATION_PLAN.md):

1. **ErrorDiagnosticsPanel** - Detect errors and suggest fixes
2. **NaturalLanguageTerminal** - Convert natural language to commands
3. **SessionSummaryBot** - Summarize terminal sessions, generate commit messages

These will be added in future iterations!

## Troubleshooting

### AI suggestions not appearing

1. Check AI service is running:
   ```bash
   curl http://localhost:8127/api/ai/health
   ```

2. Check browser console for errors

3. Verify backend environment variables:
   ```bash
   cat backend/.env | grep AI_
   ```

### Slow responses

- Use a smaller model (llama3.2:3b instead of qwen2.5-coder:7b)
- Reduce `AI_MAX_TOKENS` in backend/.env
- Check if model is running on GPU (much faster than CPU)

### Poor suggestions

- Try a different model (qwen2.5-coder is good for code/terminal)
- Adjust `AI_TEMPERATURE` (lower = more deterministic, higher = more creative)
- Provide more context (recent commands, git status helps)

## Contributing

When adding new AI features:

1. Add backend route to `backend/routes/ai.js`
2. Add service method to `backend/services/ai-service.js`
3. Add client function to `src/lib/ai-client.ts`
4. Create component in `src/components/ai/`
5. Document here!
