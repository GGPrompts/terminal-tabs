import React, { useState, useEffect } from 'react';
import { FolderOpen, Terminal, Play, Save, ArrowLeft } from 'lucide-react';
import { DirectorySelector } from './DirectorySelector';
import { useTerminalSpawn } from '../hooks/useTerminalSpawn';
import { useSettingsStore } from '../stores/useSettingsStore';
import './TerminalTemplateViewer.css';

interface TerminalTemplateViewerProps {
  templatePath: string;
  wsRef?: React.MutableRefObject<WebSocket | null>;
  onClose?: () => void;
}

interface TemplateConfig {
  name: string;
  displayName: string;
  terminalType: string;
  icon?: string;
  color?: string;
  workingDir?: string;
  startCommand?: string;
  commands?: string[];
  toolName?: string;
  isTUITool?: boolean;
  attachedDoc?: string;
  resumable?: boolean;
  quickAccess?: boolean;
  description?: string;
}

export const TerminalTemplateViewer: React.FC<TerminalTemplateViewerProps> = ({
  templatePath,
  wsRef,
  onClose
}) => {
  const [template, setTemplate] = useState<TemplateConfig | null>(null);
  const [workingDir, setWorkingDir] = useState('/home/matt/workspace');
  const [showDirSelector, setShowDirSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { spawnFromTemplate } = useTerminalSpawn(wsRef);

  // Load template on mount
  useEffect(() => {
    loadTemplate();
  }, [templatePath]);

  const loadTemplate = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure we have an absolute path
      const fullPath = templatePath.startsWith('/')
        ? templatePath
        : `/home/matt/workspace/opustrator/${templatePath}`;


      const response = await fetch(`/api/files/read?path=${encodeURIComponent(fullPath)}`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      // The API returns { path, content, fileName, fileSize }
      const config = JSON.parse(data.content) as TemplateConfig;

      setTemplate(config);
      setWorkingDir(config.workingDir || '/home/matt/workspace');
    } catch (err) {
      console.error('[TemplateViewer] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpawn = async () => {
    if (!template) return;


    try {
      await spawnFromTemplate(templatePath, { workingDir });
      // Don't close immediately to see if there are errors
      // if (onClose) onClose();
    } catch (err) {
      console.error('[TemplateViewer] Spawn error:', err);
      setError(err instanceof Error ? err.message : 'Failed to spawn terminal');
    }
  };

  const handleSaveWorkingDir = async () => {
    if (!template) return;

    try {
      const updatedTemplate = { ...template, workingDir };

      // For now, just update the local state
      // TODO: Add backend endpoint to save templates
      setTemplate(updatedTemplate);


      // Show success for now
      alert('Working directory updated for this session. (Saving to file not yet implemented)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  if (isLoading) {
    return <div className="terminal-template-viewer">Loading template...</div>;
  }

  if (error) {
    return <div className="terminal-template-viewer error">Error: {error}</div>;
  }

  if (!template) {
    return <div className="terminal-template-viewer">No template loaded</div>;
  }

  return (
    <div className="terminal-template-viewer">
      <button
        onClick={onClose}
        className="back-btn"
        title="Back to files"
      >
        <ArrowLeft size={16} />
        Back to Files
      </button>

      <div className="template-header">
        <div className="template-title">
          <span className="template-icon">{template.icon || '📄'}</span>
          <h3>{template.displayName || template.name}</h3>
        </div>
        {template.description && (
          <p className="template-description">{template.description}</p>
        )}
      </div>

      <div className="template-config">
        <div className="config-row">
          <label>Terminal Type:</label>
          <span className="config-value">{template.terminalType}</span>
        </div>

        {template.isTUITool && (
          <div className="config-row">
            <label>Tool Name:</label>
            <span className="config-value">{template.toolName}</span>
          </div>
        )}

        {template.commands && template.commands.length > 0 && (
          <div className="config-row">
            <label>Command:</label>
            <span className="config-value code">{template.commands[0]}</span>
          </div>
        )}

        <div className="config-row working-dir-row">
          <label>Launch Directory:</label>
          <div className="working-dir-wrapper">
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="working-dir-input"
            />
            <div className="working-dir-controls">
              <button
                onClick={() => setShowDirSelector(true)}
                className="browse-btn"
                title="Browse directories"
              >
                <FolderOpen size={16} />
              </button>
              <button
                onClick={handleSaveWorkingDir}
                className="save-btn"
                title="Save as default for this template"
              >
                <Save size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="template-actions">
        <button
          onClick={handleSpawn}
          className="spawn-btn primary"
        >
          <Terminal size={16} />
          Spawn Terminal
        </button>

        <button
          onClick={handleSpawn}
          className="spawn-btn secondary"
        >
          <Play size={16} />
          Spawn with Current Dir
        </button>
      </div>

      {showDirSelector && (
        <DirectorySelector
          isOpen={showDirSelector}
          currentPath={workingDir}
          onSelect={(path) => {
            setWorkingDir(path);
            setShowDirSelector(false);
          }}
          onClose={() => setShowDirSelector(false)}
        />
      )}
    </div>
  );
};