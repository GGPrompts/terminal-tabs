/**
 * Opustrator - Simplified Backend
 * 
 * Core principles:
 * - Single source of truth for terminal state (terminalRegistry)
 * - Direct terminal type from agent config
 * - Minimal API surface
 * - Clean WebSocket communication
 */

require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

// Core modules
const terminalRegistry = require('./modules/terminal-registry');
const unifiedSpawn = require('./modules/unified-spawn');
const layoutManager = require('./modules/layout-manager');
const TUIToolsManager = require('./modules/tui-tools');
const ptyHandler = require('./modules/pty-handler');
// Removed terminal-recovery.js - was causing duplicate terminals and conflicts
const apiRouter = require('./routes/api');
const filesRouter = require('./routes/files');
// const workspaceRouter = require('./routes/workspace'); // Archived - workspace-manager removed

// Initialize services
const tuiTools = new TUIToolsManager(terminalRegistry);

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);
app.use('/api/files', filesRouter);
// app.use('/api/workspace', workspaceRouter); // Archived - workspace-manager removed

// TUI Tools endpoints
app.get('/api/tui-tools', async (req, res) => {
  const tools = await tuiTools.getInstalledTools();
  res.json(tools);
});

app.post('/api/tui-tools/spawn', async (req, res) => {
  const { toolName, workingDir } = req.body;
  try {
    const terminal = await tuiTools.spawnTUITool(toolName, workingDir);
    res.json(terminal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle different startup modes based on environment variables
// FORCE_CLEANUP=true: Kill all PTY processes immediately (clean start)
// CLEANUP_ON_START defaults to false to preserve terminals across restarts
// Set CLEANUP_ON_START=true to clean up terminals on restart
const CLEANUP_ON_START = process.env.CLEANUP_ON_START === 'true'; // Default to false

// Intelligent cleanup function
async function intelligentCleanup() {
  const terminals = terminalRegistry.getAllTerminals();
  console.log(`[Server] Running intelligent cleanup on ${terminals.length} terminals`);

  // First, clean up duplicates
  terminalRegistry.cleanupDuplicates();

  // Then clean up any terminals that match common problematic names
  const problematicNames = ['pyradio', 'bottom', 'claude-code', 'opencode', 'gemini', 'codex'];
  terminals.forEach(terminal => {
    const baseName = terminal.name.split('-')[0];
    if (problematicNames.includes(baseName) && terminal.state === 'disconnected') {
      console.log(`[Server] Cleaning up disconnected terminal: ${terminal.name}`);
      terminalRegistry.closeTerminal(terminal.id);
    }
  });
}

if (process.env.FORCE_CLEANUP === 'true') {
  // Force cleanup - immediately kill all terminals
  ptyHandler.cleanupWithGrace(true).then(() => {
    terminalRegistry.cleanup();
    console.log('[Server] Force cleaned all terminals (FORCE_CLEANUP=true)');
  }).catch(err => {
    console.error('[Server] Error during force cleanup:', err);
  });
} else if (CLEANUP_ON_START) {
  // Clean start requested
  intelligentCleanup().then(() => {
    // Also do PTY cleanup for any orphaned processes
    return ptyHandler.cleanupWithGrace(false);
  }).then(() => {
    console.log('[Server] Completed intelligent cleanup (CLEANUP_ON_START=true)');
  }).catch(err => {
    console.error('[Server] Error during intelligent cleanup:', err);
  });
} else {
  console.log('[Server] Preserving existing terminals (normal start, CLEANUP_ON_START=false)');
}

// WebSocket server
const wss = new WebSocket.Server({ server });

// Track active WebSocket connections
const activeConnections = new Set();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Add to active connections
  activeConnections.add(ws);

  // Track terminals created by this connection
  const connectionTerminals = new Set();

  // Rate limiting for malformed messages
  const malformedMessageCount = { count: 0, lastReset: Date.now() };
  const MAX_MALFORMED_PER_MINUTE = 10;

  // Send initial terminal state
  ws.send(JSON.stringify({
    type: 'terminals',
    data: terminalRegistry.getAllTerminals()
  }));

  // Send immediate memory stats to new client
  const memUsage = process.memoryUsage();
  ws.send(JSON.stringify({
    type: 'memory-stats',
    data: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      activeConnections: activeConnections.size,
      terminals: terminalRegistry.getActiveTerminalCount()
    }
  }));

  // Create message handler
  const messageHandler = async (message) => {
    let data;
    try {
      data = JSON.parse(message);
      
      switch (data.type) {
        case 'spawn':
          // Debug log for Gemini spawn issues
          if (data.config && data.config.terminalType === 'gemini') {
            console.log('[WS] Spawning Gemini terminal with config:', data.config);
          }
          // Use UnifiedSpawn for better validation and rate limiting
          // Pass requestId from frontend if provided
          const result = await unifiedSpawn.spawn({
            ...data.config,
            requestId: data.requestId
          });
          if (result.success) {
            // Track this terminal for this connection
            connectionTerminals.add(result.terminal.id);
            console.log('[WS] Spawned terminal', {
              id: result.terminal.id,
              name: result.terminal.name,
              type: result.terminal.terminalType,
              platform: result.terminal.platform
            });
            // Include requestId if provided
            broadcast({
              type: 'terminal-spawned',
              data: result.terminal,
              requestId: data.requestId
            });
          } else {
            // Include requestId in error response for tracking
            ws.send(JSON.stringify({
              type: 'spawn-error',
              error: result.error,
              requestId: data.requestId,
              terminalType: data.config?.terminalType,
              terminalName: data.config?.name
            }));
          }
          break;
          
        case 'command':
          console.log(`[WS] Received command for terminal ${data.terminalId}: "${data.command?.substring(0, 50)}"`)
          await terminalRegistry.sendCommand(data.terminalId, data.command);
          break;
          
        case 'resize':
          await terminalRegistry.resizeTerminal(data.terminalId, data.cols, data.rows);
          break;
          
        case 'detach':
          // Power off button: detach from tmux but keep session alive
          console.log(`[WS] Detaching from terminal ${data.terminalId} (preserving tmux session)`);
          connectionTerminals.delete(data.terminalId);
          await terminalRegistry.closeTerminal(data.terminalId, false); // Don't force - keep tmux session alive
          broadcast({ type: 'terminal-closed', data: { id: data.terminalId } });
          break;

        case 'close':
          // X button: force close and kill tmux session
          console.log(`[WS] Force closing terminal ${data.terminalId} (killing tmux session)`);
          connectionTerminals.delete(data.terminalId);
          await terminalRegistry.closeTerminal(data.terminalId, true); // Force close - kill tmux session
          broadcast({ type: 'terminal-closed', data: { id: data.terminalId } });
          break;

        case 'reconnect':
          // Attempt to reconnect to existing terminal
          const terminalId = data.data?.terminalId || data.terminalId;
          console.log(`[WS] Received reconnect request for terminal: ${terminalId}`);

          // First, cancel any pending disconnect for this terminal
          // This is critical - we need to stop the grace period timer immediately
          terminalRegistry.cancelDisconnect(terminalId);

          // Now attempt to reconnect
          const reconnected = terminalRegistry.reconnectToTerminal(terminalId);
          if (reconnected) {
            // Add to this connection's terminal set
            connectionTerminals.add(terminalId);
            console.log(`[WS] Successfully reconnected to terminal ${terminalId}`);
            ws.send(JSON.stringify({ type: 'terminal-reconnected', data: reconnected }));
          } else {
            console.log(`[WS] Failed to reconnect to terminal ${terminalId} - terminal not found in registry`);
            ws.send(JSON.stringify({ type: 'reconnect-failed', terminalId: terminalId }));
          }
          break;
          
        case 'update-embedded':
          // Update the embedded status of a terminal
          const terminal = terminalRegistry.getTerminal(data.terminalId);
          if (terminal) {
            terminal.embedded = data.embedded;
            console.log(`[WS] Updated terminal ${data.terminalId} embedded status to ${data.embedded}`);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);

      // Rate limit check for malformed messages
      const now = Date.now();
      if (now - malformedMessageCount.lastReset > 60000) {
        malformedMessageCount.count = 0;
        malformedMessageCount.lastReset = now;
      }
      malformedMessageCount.count++;

      // Terminate connection if too many malformed messages
      if (malformedMessageCount.count > MAX_MALFORMED_PER_MINUTE) {
        console.error('Too many malformed messages from client, terminating connection');
        ws.terminate();
        return;
      }

      // For JSON parse errors, terminate the connection immediately
      if (error instanceof SyntaxError) {
        console.error('Invalid JSON received, terminating connection');
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
        }
        ws.terminate();
        return;
      }

      // For other errors, send error message but keep connection
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    }
  };

  // Create close handler
  const closeHandler = () => {
    console.log('WebSocket client disconnected');
    // Disconnect terminals belonging to this connection (with grace period)
    for (const terminalId of connectionTerminals) {
      terminalRegistry.disconnectTerminal(terminalId);
    }
    // Clear terminal references to free memory
    connectionTerminals.clear();

    // Remove from active connections
    activeConnections.delete(ws);
    // Clean up event listeners
    ws.removeListener('message', messageHandler);
    ws.removeListener('close', closeHandler);
    ws.removeListener('error', errorHandler);
  };

  // Create error handler
  const errorHandler = (error) => {
    console.error('WebSocket error:', error);
    // Ensure cleanup happens and terminate the connection
    ws.terminate();
  };

  // Attach event listeners
  ws.on('message', messageHandler);
  ws.on('close', closeHandler);
  ws.on('error', errorHandler);
});

// Broadcast to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  // Use activeConnections set instead of wss.clients for better memory management
  activeConnections.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (error) {
        // Remove dead connections
        console.error('[Server] Error broadcasting to client:', error);
        activeConnections.delete(client);
      }
    }
  });
}

// Terminal output streaming - remove any existing listeners first
terminalRegistry.removeAllListeners('output');
terminalRegistry.on('output', (terminalId, data) => {
  broadcast({
    type: 'terminal-output',
    terminalId,
    data
  });
});

// Listen for terminal lifecycle close events (natural exit) and broadcast to clients
terminalRegistry.removeAllListeners('closed');
terminalRegistry.on('closed', (terminalId) => {
  broadcast({ type: 'terminal-closed', data: { id: terminalId } });
});

// Periodic memory monitoring and leak prevention - clean up dead connections
setInterval(() => {
  // Remove dead WebSocket connections
  const deadConnections = [];
  activeConnections.forEach(ws => {
    if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
      deadConnections.push(ws);
    }
  });
  
  deadConnections.forEach(ws => {
    console.log('[Server] Removing dead WebSocket connection');
    activeConnections.delete(ws);
    try {
      ws.terminate();
    } catch (e) {
      // Ignore errors
    }
  });
  
  // Log memory usage for monitoring
  const memUsage = process.memoryUsage();
  const heapUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rss = Math.round(memUsage.rss / 1024 / 1024);
  console.log(`[Server] Memory: ${heapUsed}MB / ${heapTotal}MB, Active WS: ${activeConnections.size}, Terminals: ${terminalRegistry.getActiveTerminalCount()}`);

  // Broadcast memory stats to all connected clients
  broadcast({
    type: 'memory-stats',
    data: {
      heapUsed,
      heapTotal,
      rss, // Resident Set Size - total memory allocated
      external: Math.round(memUsage.external / 1024 / 1024),
      activeConnections: activeConnections.size,
      terminals: terminalRegistry.getActiveTerminalCount()
    }
  });
}, 5000); // Run every 5 seconds

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  
  // Close all WebSocket connections
  activeConnections.forEach(ws => {
    try {
      ws.close(1000, 'Server shutting down');
    } catch (e) {
      // Ignore errors during shutdown
    }
  });
  activeConnections.clear();
  
  // Close WebSocket server
  wss.close(() => {
    console.log('[Server] WebSocket server closed');
  });
  
  // Clean up terminal registry listeners
  terminalRegistry.removeAllListeners();

  // Clean up all terminals
  await terminalRegistry.cleanup();

  // Note persistence was removed in v3.10 (manual save system)
  // console.log('[Server] Saving all pending notes...');
  // notePersistence.shutdown();
  
  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 8127;
server.listen(PORT, async () => {
  console.log(`Opustrator running on port ${PORT}`);
  console.log(`WebSocket server ready`);

  // Initialize note persistence service

  // Attempt to recover any existing terminals
  // TODO: Terminal recovery module needs to be implemented
  // if (process.env.RECOVER_TERMINALS !== 'false') {
  //   setTimeout(async () => {
  //     console.log('[Server] Checking for recoverable terminals...');
  //     const recovered = await terminalRecovery.recoverTerminals();
  //     if (recovered.length > 0) {
  //       console.log(`[Server] Recovered ${recovered.length} terminals`);
  //       // Notify any connected clients about recovered terminals
  //       broadcast({
  //         type: 'terminals-recovered',
  //         data: recovered
  //       });
  //     }
  //   }, 2000); // Wait 2 seconds for system to stabilize
  // }
});