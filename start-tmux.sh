#!/bin/bash

# Terminal Tabs - Tmux Launch Script
# Starts both backend and frontend in a tmux session

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR"

SESSION_NAME="terminal-tabs"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Terminal Tabs Tmux Launch Script     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}❌ tmux is not installed. Please install it first:${NC}"
    echo -e "   ${YELLOW}sudo apt install tmux${NC}"
    exit 1
fi

# Kill existing session if it exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Existing session found. Killing it...${NC}"
    tmux kill-session -t $SESSION_NAME
fi

# Check if backend dependencies are installed
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
    cd "$BACKEND_DIR"
    npm install
fi

# Check if frontend dependencies are installed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    npm install
fi

echo -e "${GREEN}🚀 Creating tmux session: $SESSION_NAME${NC}"
echo ""

# Create new tmux session with backend in first window
tmux new-session -d -s $SESSION_NAME -n backend -c "$BACKEND_DIR"
tmux send-keys -t $SESSION_NAME:backend "npm start" C-m

# Create frontend window
tmux new-window -t $SESSION_NAME -n frontend -c "$FRONTEND_DIR"
tmux send-keys -t $SESSION_NAME:frontend "npm run dev" C-m

# Create a logs window (optional)
tmux new-window -t $SESSION_NAME -n logs -c "$SCRIPT_DIR"
tmux send-keys -t $SESSION_NAME:logs "echo 'Logs window - use Ctrl+C to refresh'; sleep 2; clear" C-m

# Select the frontend window
tmux select-window -t $SESSION_NAME:frontend

echo -e "${GREEN}✅ Terminal Tabs started in tmux session!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Tmux Commands:${NC}"
echo -e "  Attach:  ${YELLOW}tmux attach -t $SESSION_NAME${NC}"
echo -e "  Detach:  ${YELLOW}Ctrl+B, then D${NC}"
echo -e "  Windows: ${YELLOW}Ctrl+B, then 0/1/2${NC} (backend/frontend/logs)"
echo -e "  Kill:    ${YELLOW}tmux kill-session -t $SESSION_NAME${NC}"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:5173${NC}"
echo -e "  Backend:  ${YELLOW}http://localhost:8127${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Attaching to tmux session...${NC}"
echo ""

# Attach to the session
tmux attach -t $SESSION_NAME
