const express = require('express');
const router = express.Router();
const WorkspaceManager = require('../modules/workspace-manager');

const workspaceManager = new WorkspaceManager();

// Initialize workspace on startup
workspaceManager.initWorkspace().catch(console.error);

// List files in a category
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const files = await workspaceManager.listFiles(category);
    res.json(files);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read a specific file
router.get('/:category/:filename', async (req, res) => {
  try {
    const { category, filename } = req.params;
    const file = await workspaceManager.readFile(category, filename);
    res.json(file);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Save/update a file
router.post('/:category/:filename', async (req, res) => {
  try {
    const { category, filename } = req.params;
    const { content, metadata } = req.body;
    
    const result = await workspaceManager.saveFile(category, filename, content, metadata);
    res.json(result);
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a file
router.delete('/:category/:filename', async (req, res) => {
  try {
    const { category, filename } = req.params;
    const result = await workspaceManager.deleteFile(category, filename);
    res.json(result);
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search files
router.post('/search', async (req, res) => {
  try {
    const { query, category, tags, searchContent } = req.body;
    const results = await workspaceManager.searchFiles(query, {
      category,
      tags,
      searchContent
    });
    res.json(results);
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workspace structure
router.get('/structure', async (req, res) => {
  try {
    const structure = await workspaceManager.getWorkspaceStructure();
    res.json(structure);
  } catch (error) {
    console.error('Error getting workspace structure:', error);
    res.status(500).json({ error: error.message });
  }
});

// SSE endpoint for file watch events
router.get('/watch/:category', (req, res) => {
  const { category } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const sendEvent = (event, data) => {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
  };
  
  workspaceManager.watchCategory(category, (event, path) => {
    sendEvent(event, { path, category });
  });
  
  req.on('close', () => {
    workspaceManager.stopWatching(category);
  });
});

module.exports = router;