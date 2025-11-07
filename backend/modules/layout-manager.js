/**
 * Layout Manager - Persistent storage for terminal arrangements
 * 
 * Manages:
 * - Saving current terminal layouts
 * - Loading saved layouts
 * - Layout metadata and configurations
 */

const fs = require('fs').promises;
const path = require('path');

class LayoutManager {
  constructor() {
    this.layoutsDir = path.join(__dirname, '../../data/layouts');
    this.ensureLayoutsDir();
  }

  /**
   * Ensure layouts directory exists
   */
  async ensureLayoutsDir() {
    try {
      await fs.mkdir(this.layoutsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create layouts directory:', error);
    }
  }

  /**
   * Save layout configuration
   */
  async saveLayout(name, layout) {
    await this.ensureLayoutsDir();
    
    const layoutData = {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      terminals: layout.terminals || [],
      arrangement: layout.arrangement || 'tabs',
      metadata: layout.metadata || {}
    };

    const filePath = path.join(this.layoutsDir, `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(layoutData, null, 2));
    
    return layoutData;
  }

  /**
   * Load layout by name
   */
  async loadLayout(name) {
    const filePath = path.join(this.layoutsDir, `${name}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Layout '${name}' not found`);
      }
      throw error;
    }
  }

  /**
   * Get all saved layouts
   */
  async getAllLayouts() {
    await this.ensureLayoutsDir();
    
    try {
      const files = await fs.readdir(this.layoutsDir);
      const layouts = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.layoutsDir, file), 'utf-8');
            const layout = JSON.parse(data);
            layouts.push({
              name: layout.name,
              createdAt: layout.createdAt,
              updatedAt: layout.updatedAt,
              terminalCount: layout.terminals.length,
              arrangement: layout.arrangement
            });
          } catch (error) {
            console.error(`Failed to parse layout file ${file}:`, error);
          }
        }
      }
      
      return layouts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error('Failed to read layouts directory:', error);
      return [];
    }
  }

  /**
   * Delete layout by name
   */
  async deleteLayout(name) {
    const filePath = path.join(this.layoutsDir, `${name}.json`);
    
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Layout '${name}' not found`);
      }
      throw error;
    }
  }

  /**
   * Update existing layout
   */
  async updateLayout(name, updates) {
    const existing = await this.loadLayout(name);
    
    const updatedLayout = {
      ...existing,
      ...updates,
      name, // Preserve original name
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    return this.saveLayout(name, updatedLayout);
  }
}

module.exports = new LayoutManager();