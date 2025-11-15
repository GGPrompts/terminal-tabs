# ai-experiments Branch

**Git Worktree Location**: `~/projects/terminal-tabs-ai`
**Branch**: `feat/ai-experiments`
**Status**: ✅ 90% Complete - **Terminals Working + AI Features**

## What This Is

Adds AI-powered features to terminals. Context-aware command suggestions, error detection and diagnostics. Requires Ollama running locally.

## Current Status

- ✅ **Terminals Work**: Full terminal functionality from master
- ✅ **AI Suggestions**: Inline command suggestions with Tab to accept
- ✅ **Error Diagnostics**: Auto-detect npm/git/build errors
- ✅ **Context Hooks**: Auto-refresh terminal state every 5s
- ⚠️ **Requires Ollama**: External dependency

## Built Components

- **AICommandSuggester** (`src/components/ai/AICommandSuggester.tsx`)
  - Tab to accept, Esc to dismiss
  - Context-aware (cwd, git status, recent commands)
  - Confidence scores
  - Debounced fetching (3+ chars trigger)

- **ErrorDiagnosticsPanel** (`src/components/ai/ErrorDiagnosticsPanel.tsx`)
  - Error pattern detection
  - Suggested fixes
  - Stack trace parsing

- **useTerminalContext** (`src/hooks/useTerminalContext.ts`)
  - Auto-refresh terminal state every 5s
  - Provides context for AI

## Requirements

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download model
ollama pull qwen2.5-coder:7b

# Start Ollama server
ollama serve
```

## How to Work on This

```bash
cd ~/projects/terminal-tabs-ai

# Install dependencies
npm install

# Make sure Ollama is running
ollama serve

# Start dev server
npm run dev

# Open http://localhost:5173
```

## Features

- 🤖 AI command suggestions as you type
- 🔍 Error detection and diagnostics
- 💡 Context-aware suggestions (cwd, git, history)
- ⚡ Fast suggestions (<500ms)

## Assessment

- ✅ Future-forward - AI suggestions genuinely useful
- 💡 Error diagnostics - Could save hours of debugging
- ⚠️ Ollama dependency - Requires external service
- 🎯 Experimental - Accuracy varies

## Main Documentation

See [FEATURE_BRANCHES.md](../terminal-tabs/FEATURE_BRANCHES.md) in the main repo for complete overview of all branches.
