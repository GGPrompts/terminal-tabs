/**
 * AI Routes - API endpoints for AI-powered terminal features
 */

const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');

/**
 * POST /api/ai/suggest
 * Get command suggestion based on partial input and context
 */
router.post('/suggest', async (req, res) => {
  try {
    const { input, context } = req.body;

    if (!input || input.length < 2) {
      return res.status(400).json({
        error: 'Input too short',
        message: 'Please provide at least 2 characters'
      });
    }

    const suggestion = await aiService.suggestCommand(input, context);
    res.json(suggestion);
  } catch (error) {
    console.error('[AI Routes] Suggest error:', error);
    res.status(500).json({
      error: 'Suggestion failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/nl-to-command
 * Convert natural language to shell command
 */
router.post('/nl-to-command', async (req, res) => {
  try {
    const { prompt, context } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Empty prompt',
        message: 'Please provide a natural language prompt'
      });
    }

    const result = await aiService.nlToCommand(prompt, context);
    res.json(result);
  } catch (error) {
    console.error('[AI Routes] NL to command error:', error);
    res.status(500).json({
      error: 'Conversion failed',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/explain-error
 * Analyze terminal error and suggest fix
 */
router.post('/explain-error', async (req, res) => {
  try {
    const { errorOutput, context } = req.body;

    if (!errorOutput || errorOutput.trim().length === 0) {
      return res.status(400).json({
        error: 'Empty error output',
        message: 'Please provide error output to analyze'
      });
    }

    const result = await aiService.explainError(errorOutput, context);
    res.json(result);
  } catch (error) {
    console.error('[AI Routes] Error explanation failed:', error);
    res.status(500).json({
      error: 'Error analysis failed',
      message: error.message
    });
  }
});

/**
 * GET /api/ai/health
 * Check if AI service is available
 */
router.get('/health', async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    res.json(health);
  } catch (error) {
    console.error('[AI Routes] Health check error:', error);
    res.status(503).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/ai/config
 * Get current AI configuration (without sensitive data)
 */
router.get('/config', (req, res) => {
  res.json({
    provider: aiService.provider,
    model: aiService.model,
    baseURL: aiService.baseURL.replace(/:[^:]+@/, ':***@'), // Hide credentials in URL
    temperature: aiService.temperature,
    maxTokens: aiService.maxTokens,
    hasApiKey: !!aiService.apiKey
  });
});

module.exports = router;
