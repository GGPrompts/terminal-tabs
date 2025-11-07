/**
 * Opustrator API Routes - Simplified & Explicit
 * 
 * Key principles:
 * - Minimal API surface (reduced from 120+ to ~15 endpoints)
 * - terminal-registry.js as single source of truth
 * - Explicit terminal types (no guessing)
 * - Clear validation and error handling
 */

const express = require('express');
const Joi = require('joi');
const terminalRegistry = require('../modules/terminal-registry');
const unifiedSpawn = require('../modules/unified-spawn');
const layoutManager = require('../modules/layout-manager');

const router = express.Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const terminalTypes = unifiedSpawn.getTerminalTypes();

const spawnAgentSchema = Joi.object({
  name: Joi.string().min(1).max(50).optional(),
  terminalType: Joi.string().valid(...terminalTypes).required(),
  platform: Joi.string().valid('docker', 'local').default('docker'),
  workingDir: Joi.string().optional(),
  resumable: Joi.boolean().default(false),
  color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: Joi.string().max(10).optional(),
  env: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  prompt: Joi.string().max(500).optional(),
  autoStart: Joi.boolean().default(true),
  agentConfigPath: Joi.string().optional()
});

const commandSchema = Joi.object({
  command: Joi.string().required().min(1).max(10000)
});

const resizeSchema = Joi.object({
  cols: Joi.number().integer().min(20).max(300).required(),
  rows: Joi.number().integer().min(10).max(100).required()
});

const saveLayoutSchema = Joi.object({
  name: Joi.string().required().min(1).max(50).pattern(/^[a-zA-Z0-9_-]+$/),
  terminals: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      terminalType: Joi.string().required(),
      name: Joi.string().required(),
      position: Joi.object().optional()
    })
  ).required(),
  arrangement: Joi.string().valid('tabs', 'grid', 'split').default('tabs'),
  metadata: Joi.object().optional()
});

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.details[0].message,
        details: error.details
      });
    }
    req.body = value;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: error.details[0].message
      });
    }
    req.params = value;
    next();
  };
}

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  console.error('API Error:', err);
  
  // Known error types
  if (err.message.includes('not found')) {
    return res.status(404).json({
      error: 'Resource not found',
      message: err.message
    });
  }
  
  if (err.message.includes('Terminal type') || err.message.includes('Unknown terminal type')) {
    return res.status(400).json({
      error: 'Invalid terminal type',
      message: err.message,
      supportedTypes: terminalTypes
    });
  }
  
  if (err.message.includes('Permission denied') || err.message.includes('EACCES')) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'Unable to access the requested resource'
    });
  }
  
  // Generic server error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
}

// =============================================================================
// AGENT ROUTES
// =============================================================================

/**
 * GET /api/spawn-options - List available spawn options from spawn-options.json
 */
router.get('/spawn-options', asyncHandler(async (req, res) => {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const spawnOptionsPath = path.join(__dirname, '../../spawn-options.json');
    const data = await fs.readFile(spawnOptionsPath, 'utf-8');
    const spawnConfig = JSON.parse(data);

    res.json({
      success: true,
      count: spawnConfig.spawnOptions.length,
      data: spawnConfig.spawnOptions
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load spawn options',
      message: error.message
    });
  }
}));

/**
 * POST /api/agents - Spawn new agent with explicit terminal type
 * 
 * Required: terminalType (explicit - no guessing!)
 * Optional: name, platform, workingDir, env, etc.
 */
router.post('/agents', validateBody(spawnAgentSchema), asyncHandler(async (req, res) => {
  const config = req.body;
  
  // Spawn agent using UnifiedSpawn for validation and rate limiting
  const result = await unifiedSpawn.spawn(config);
  
  if (!result.success) {
    return res.status(400).json({
      error: 'Failed to spawn agent',
      message: result.error,
      requestId: result.requestId,
      retryAfter: result.retryAfter
    });
  }
  
  const terminal = result.terminal;
  
  res.status(201).json({
    success: true,
    message: `Agent '${terminal.name}' spawned successfully`,
    data: {
      id: terminal.id,
      name: terminal.name,
      terminalType: terminal.terminalType,
      platform: terminal.platform,
      resumable: terminal.resumable,
      color: terminal.color,
      icon: terminal.icon,
      workingDir: terminal.workingDir,
      state: terminal.state,
      createdAt: terminal.createdAt
    }
  });
}));

/**
 * GET /api/agents - List all active agent terminals
 */
router.get('/agents', asyncHandler(async (req, res) => {
  const terminals = terminalRegistry.getAllTerminals();
  
  res.json({
    success: true,
    count: terminals.length,
    data: terminals.map(t => ({
      id: t.id,
      name: t.name,
      terminalType: t.terminalType, // Always explicit
      platform: t.platform,
      resumable: t.resumable,
      color: t.color,
      icon: t.icon,
      workingDir: t.workingDir,
      state: t.state,
      embedded: t.embedded,
      createdAt: t.createdAt,
      lastActivity: t.lastActivity
    }))
  });
}));

/**
 * GET /api/agents/:id - Get specific agent details
 */
router.get('/agents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const terminal = terminalRegistry.getTerminal(id);
  
  if (!terminal) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No agent found with ID: ${id}`
    });
  }
  
  res.json({
    success: true,
    data: {
      id: terminal.id,
      name: terminal.name,
      terminalType: terminal.terminalType,
      platform: terminal.platform,
      resumable: terminal.resumable,
      color: terminal.color,
      icon: terminal.icon,
      workingDir: terminal.workingDir,
      state: terminal.state,
      embedded: terminal.embedded,
      createdAt: terminal.createdAt,
      lastActivity: terminal.lastActivity,
      config: terminal.config // Include full config for debugging
    }
  });
}));

/**
 * DELETE /api/agents/:id - Close agent and cleanup
 */
router.delete('/agents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const terminal = terminalRegistry.getTerminal(id);
  
  if (!terminal) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No agent found with ID: ${id}`
    });
  }
  
  // Close terminal (handles cleanup automatically)
  terminalRegistry.closeTerminal(id);
  
  res.json({
    success: true,
    message: `Agent '${terminal.name}' closed successfully`,
    data: {
      id: terminal.id,
      name: terminal.name,
      terminalType: terminal.terminalType
    }
  });
}));

/**
 * POST /api/agents/:id/command - Send command to agent
 */
router.post('/agents/:id/command', validateBody(commandSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  
  const terminal = terminalRegistry.getTerminal(id);
  if (!terminal) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No agent found with ID: ${id}`
    });
  }
  
  if (terminal.state !== 'active') {
    return res.status(400).json({
      error: 'Agent not active',
      message: `Cannot send command to agent in state: ${terminal.state}`
    });
  }
  
  // Send command to terminal
  terminalRegistry.sendCommand(id, command);
  
  res.json({
    success: true,
    message: 'Command sent successfully',
    data: {
      terminalId: id,
      command: command.length > 100 ? command.substring(0, 100) + '...' : command,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/agents/:id/resize - Resize terminal
 */
router.post('/agents/:id/resize', validateBody(resizeSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cols, rows } = req.body;
  
  const terminal = terminalRegistry.getTerminal(id);
  if (!terminal) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No agent found with ID: ${id}`
    });
  }
  
  // Resize terminal
  terminalRegistry.resizeTerminal(id, cols, rows);
  
  res.json({
    success: true,
    message: 'Terminal resized successfully',
    data: {
      terminalId: id,
      cols,
      rows
    }
  });
}));

// =============================================================================
// LAYOUT ROUTES
// =============================================================================

/**
 * GET /api/layouts - Get saved terminal arrangements
 */
router.get('/layouts', asyncHandler(async (req, res) => {
  const layouts = await layoutManager.getAllLayouts();
  
  res.json({
    success: true,
    count: layouts.length,
    data: layouts
  });
}));

/**
 * GET /api/layouts/:name - Get specific layout
 */
router.get('/layouts/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  try {
    const layout = await layoutManager.loadLayout(name);
    
    res.json({
      success: true,
      data: layout
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Layout not found',
        message: error.message
      });
    }
    throw error;
  }
}));

/**
 * POST /api/layouts - Save current layout
 */
router.post('/layouts', validateBody(saveLayoutSchema), asyncHandler(async (req, res) => {
  const layoutData = req.body;
  
  // Validate that all terminal IDs exist
  for (const terminalRef of layoutData.terminals) {
    const terminal = terminalRegistry.getTerminal(terminalRef.id);
    if (!terminal) {
      return res.status(400).json({
        error: 'Invalid terminal reference',
        message: `Terminal ${terminalRef.id} does not exist`
      });
    }
  }
  
  const savedLayout = await layoutManager.saveLayout(layoutData.name, layoutData);
  
  res.status(201).json({
    success: true,
    message: `Layout '${layoutData.name}' saved successfully`,
    data: savedLayout
  });
}));

/**
 * PUT /api/layouts/:name - Update existing layout
 */
router.put('/layouts/:name', validateBody(saveLayoutSchema), asyncHandler(async (req, res) => {
  const { name } = req.params;
  const updates = req.body;
  
  // Ensure the name matches
  if (updates.name && updates.name !== name) {
    return res.status(400).json({
      error: 'Name mismatch',
      message: 'Layout name in URL and body must match'
    });
  }
  
  const updatedLayout = await layoutManager.updateLayout(name, updates);
  
  res.json({
    success: true,
    message: `Layout '${name}' updated successfully`,
    data: updatedLayout
  });
}));

/**
 * DELETE /api/layouts/:name - Delete layout
 */
router.delete('/layouts/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  await layoutManager.deleteLayout(name);
  
  res.json({
    success: true,
    message: `Layout '${name}' deleted successfully`
  });
}));

// =============================================================================
// UTILITY ROUTES
// =============================================================================

/**
 * GET /api/terminal-types - Get available terminal types
 */
router.get('/terminal-types', asyncHandler(async (req, res) => {
  const availableTypes = unifiedSpawn.getAvailableTypes();
  const types = unifiedSpawn.getTerminalTypes();
  const typeConfigs = {};

  for (const type of types) {
    typeConfigs[type] = unifiedSpawn.getTerminalTypeConfig(type);
  }

  res.json({
    success: true,
    data: {
      types,
      configs: typeConfigs,
      availableTypes // Include platform and resumable info
    }
  });
}));

/**
 * GET /api/spawn-stats - Get spawn statistics
 */
router.get('/spawn-stats', asyncHandler(async (req, res) => {
  const stats = unifiedSpawn.getStats();
  
  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/health - Health check
 */
router.get('/health', asyncHandler(async (req, res) => {
  const terminals = terminalRegistry.getAllTerminals();

  res.json({
    success: true,
    status: 'healthy',
    data: {
      uptime: process.uptime(),
      activeTerminals: terminals.filter(t => t.state === 'active').length,
      totalTerminals: terminals.length,
      memoryUsage: process.memoryUsage(),
      version: '3.0.0'
    }
  });
}));

/**
 * GET /api/tmux/sessions - List active tmux sessions (simple)
 */
router.get('/tmux/sessions', asyncHandler(async (req, res) => {
  const { execSync } = require('child_process');

  try {
    // List tmux sessions with format: session_name:session_id
    const output = execSync('tmux list-sessions -F "#{session_name}"', { encoding: 'utf8' });
    const sessions = output.trim().split('\n').filter(s => s.length > 0);

    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length
      }
    });
  } catch (error) {
    // If tmux server is not running or no sessions exist
    if (error.status === 1) {
      res.json({
        success: true,
        data: {
          sessions: [],
          count: 0
        }
      });
    } else {
      throw error;
    }
  }
}));

// =============================================================================
// TMUX SESSION MANAGER ENDPOINTS
// =============================================================================

const tmuxSessionManager = require('../modules/tmux-session-manager');

/**
 * GET /api/tmux/sessions/detailed - List all sessions with rich metadata
 * Returns:
 * - Basic info (name, windows, attached)
 * - Working directory & git branch
 * - AI tool detection
 * - Claude Code statusline (if applicable)
 * - Opustrator managed vs external
 */
router.get('/tmux/sessions/detailed', asyncHandler(async (req, res) => {
  const sessions = await tmuxSessionManager.listDetailedSessions();
  const grouped = tmuxSessionManager.groupSessions(sessions);

  res.json({
    success: true,
    data: {
      sessions,
      grouped,
      count: sessions.length,
      counts: {
        opustrator: grouped.opustrator.length,
        claudeCode: grouped.claudeCode.length,
        external: grouped.external.length,
      }
    }
  });
}));

/**
 * GET /api/tmux/sessions/:name - Get detailed info for a specific session
 */
router.get('/tmux/sessions/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const sessions = await tmuxSessionManager.listDetailedSessions();
  const session = sessions.find(s => s.name === name);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: `Session ${name} not found`
    });
  }

  res.json({
    success: true,
    data: session
  });
}));

/**
 * GET /api/tmux/sessions/:name/preview - Capture pane content for preview
 * Query params:
 * - lines: number of lines to capture (default: 100)
 * - window: window index (default: 0)
 * - full: capture full scrollback (default: false)
 */
router.get('/tmux/sessions/:name/preview', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const lines = parseInt(req.query.lines || '100', 10);
  const windowIndex = parseInt(req.query.window || '0', 10);
  const full = req.query.full === 'true';

  let result;
  if (full) {
    result = await tmuxSessionManager.captureFullScrollback(name, windowIndex);
  } else {
    result = await tmuxSessionManager.capturePanePreview(name, lines, windowIndex);
  }

  if (result.success) {
    res.json({
      success: true,
      data: {
        content: result.content,
        lines: result.lines,
        paneId: result.paneId
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
}));

/**
 * GET /api/tmux/sessions/:name/statusline - Get Claude Code statusline
 * Only works for Claude Code sessions
 */
router.get('/tmux/sessions/:name/statusline', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const sessions = await tmuxSessionManager.listDetailedSessions();
  const session = sessions.find(s => s.name === name);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: `Session ${name} not found`
    });
  }

  if (session.aiTool !== 'claude-code') {
    return res.status(400).json({
      success: false,
      error: `Session ${name} is not a Claude Code session`
    });
  }

  res.json({
    success: true,
    data: {
      claudeState: session.claudeState,
      statusIcon: tmuxSessionManager.getStatusIcon(session)
    }
  });
}));

/**
 * GET /api/tmux/sessions/:name/windows - List windows for a session
 */
router.get('/tmux/sessions/:name/windows', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const result = await tmuxSessionManager.listWindows(name);

  if (result.success) {
    res.json({
      success: true,
      data: result.windows
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
}));

/**
 * POST /api/tmux/sessions/:name/command - Send command to session
 * Body: { command: string }
 */
router.post('/tmux/sessions/:name/command', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Command is required'
    });
  }

  const result = await tmuxSessionManager.sendCommand(name, command);

  if (result.success) {
    res.json({
      success: true,
      message: `Command sent to session ${name}`
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
}));

/**
 * DELETE /api/tmux/sessions/:name - Kill a tmux session
 * WARNING: This is destructive and cannot be undone
 */
router.delete('/tmux/sessions/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const result = await tmuxSessionManager.killSession(name);

  if (result.success) {
    res.json({
      success: true,
      message: `Session ${name} killed`
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error
    });
  }
}));

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Apply error handler
router.use(errorHandler);

module.exports = router;
