#!/bin/bash
# Tabz Docker Entrypoint
# Starts both backend and frontend servers

set -e

# Set environment variables with defaults
export NODE_ENV=${NODE_ENV:-development}
export LOG_LEVEL=${LOG_LEVEL:-4}
export BACKEND_PORT=${BACKEND_PORT:-8127}
export FRONTEND_PORT=${FRONTEND_PORT:-3007}

# Force consistent terminal type
export TERM=xterm-256color

echo "🚀 Starting Tabz..."
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Log Level: $LOG_LEVEL"
echo ""

# Fix working directory in spawn-options.json for Docker
# Replace host path with container path
if [ -f /app/public/spawn-options.json ]; then
  sed -i 's|/home/matt/projects/terminal-tabs|/app|g' /app/public/spawn-options.json
  echo "✅ Updated spawn-options.json working directory to /app"
fi

# Create backend .env file
cat > /app/backend/.env << EOF
LOG_LEVEL=$LOG_LEVEL
PORT=$BACKEND_PORT
EOF

# Start backend in background
echo "📡 Starting backend server..."
cd /app/backend
npm start &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# Start frontend (runs in foreground)
echo "🎨 Starting frontend dev server..."
cd /app
npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
