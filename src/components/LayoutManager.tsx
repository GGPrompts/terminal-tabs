import React, { useState, useMemo, useEffect } from "react";
import {
  useCanvasStore,
  useLayoutsMap,
  useTerminalsMap,
} from "../stores/canvasStore";
import { DirectorySelector } from "./DirectorySelector";
import { Zap, Download, Upload, RotateCcw } from "lucide-react";
import { generateStartCommand } from "../utils/startCommandUtils";
import { useSettingsStore } from "../stores/useSettingsStore";
// Auto-persist enabled - no manual save needed
import "./LayoutManager.css";

interface LayoutManagerProps {
  agents?: any[]; // Active WebSocket agents
  terminalPositions?: Record<string, { x: number; y: number }>;
  terminalSizes?: Record<string, { width: number; height: number }>;
  backgroundTheme?: string; // Current background theme
  wsRef?: React.MutableRefObject<WebSocket | null>;
  onBackgroundChange?: (type: string) => void; // Callback to update background
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  agents = [],
  terminalPositions = {},
  terminalSizes = {},
  backgroundTheme,
  wsRef,
  onBackgroundChange,
}) => {
  const [newLayoutName, setNewLayoutName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportDirModal, setShowExportDirModal] = useState(false);
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [editingLayoutName, setEditingLayoutName] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exportDirectory, setExportDirectory] = useState(() => {
    return (
      localStorage.getItem('layout-export-directory') ||
      '/home/matt/workspace/opustrator/library/layouts'
    );
  });

  // Helper function to shorten path display
  const shortenPath = (path: string, maxDepth: number = 3): string => {
    const parts = path.split('/').filter(p => p);
    if (parts.length <= maxDepth) {
      return path;
    }
    return '.../' + parts.slice(-maxDepth).join('/');
  };

  // Use Map selector and convert to array with useMemo
  const layoutsMap = useLayoutsMap();
  const terminalsMap = useTerminalsMap();
  const layoutsArray = useMemo(
    () => Array.from(layoutsMap.values()),
    [layoutsMap],
  );
  const saveLayout = useCanvasStore((state) => state.saveLayout);
  const loadLayout = useCanvasStore((state) => state.loadLayout);
  const deleteLayout = useCanvasStore((state) => state.deleteLayout);
  const renameLayout = useCanvasStore((state) => state.renameLayout);
  const exportLayout = useCanvasStore((state) => state.exportLayout);
  const importLayout = useCanvasStore((state) => state.importLayout);
  const activeLayoutId = useCanvasStore((state) => state.activeLayoutId);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const addTerminal = useCanvasStore((state) => state.addTerminal);

  // Track changes for manual save reminder
  useEffect(() => {
    // Mark as having unsaved changes when terminals or cards change
    const hasContent = terminalsMap.size > 0 ||
      Array.from(useCanvasStore.getState().cards.values()).length > 0;

    if (hasContent && activeLayoutId) {
      setHasUnsavedChanges(true);
    }
  }, [terminalsMap, activeLayoutId]);

  // Clear unsaved changes flag after manual save
  const handleManualSave = (layoutName: string, layoutId: string) => {
    // Update terminal positions before saving
    agents.forEach((agent) => {
      const existingTerminal = Array.from(terminalsMap.values()).find(
        (t) => t.agentId === agent.id,
      );
      if (existingTerminal) {
        const updateTerminal = useCanvasStore.getState().updateTerminal;
        updateTerminal(existingTerminal.id, {
          position: terminalPositions[agent.id] || existingTerminal.position,
          size: terminalSizes[agent.id] || existingTerminal.size,
        });
      }
    });

    saveLayout(layoutName, layoutId, backgroundTheme);
    setHasUnsavedChanges(false);
  };

  const handleSaveLayout = () => {
    if (newLayoutName.trim()) {
      // Update or create stored terminals for all active agents
      agents.forEach((agent) => {
        const existingTerminal = Array.from(terminalsMap.values()).find(
          (t) => t.agentId === agent.id,
        );
        if (!existingTerminal) {
          // Build the actual start command using the utility function
          const startCommand = generateStartCommand(agent.terminalType, agent.workingDir);

          // Create stored terminal for this agent
          const terminalId = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          addTerminal({
            id: terminalId,
            name: agent.name,
            terminalType: agent.terminalType,
            position: terminalPositions[agent.id] || { x: 50, y: 50 },
            size: terminalSizes[agent.id] || { width: 600, height: 720 },
            isMaximized: false,
            isOn: true,
            agentId: agent.id,
            workingDir: agent.workingDir || "/workspace",
            startCommand: startCommand,
            sessionId: agent.sessionId,
          });
        } else {
          // Update existing terminal with current position and size
          const updateTerminal = useCanvasStore.getState().updateTerminal;
          updateTerminal(existingTerminal.id, {
            position: terminalPositions[agent.id] || existingTerminal.position,
            size: terminalSizes[agent.id] || existingTerminal.size,
          });
        }
      });

      // Now save the layout with all terminals stored and background theme
      const layoutId = saveLayout(newLayoutName, undefined, backgroundTheme);
      setNewLayoutName("");
      setShowCreateForm(false);
      setHasUnsavedChanges(false);
    }
  };

  const handleExportLayout = async (id: string) => {
    const data = exportLayout(id);
    const layout = layoutsArray.find((l) => l.id === id);
    // Use consistent filename for the same layout (no timestamp for updates)
    const filename = `layout-${layout?.name.replace(/\s+/g, "-")}.json`;

    // Save to WSL filesystem
    try {
      const sanitizedDir = exportDirectory.replace(/\/$/, '');
      const targetPath = `${sanitizedDir}/${filename}`;
      const response = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          content: data
        })
      });

      if (response.ok) {
        console.log(`Layout exported to ${targetPath}`);
      }
    } catch (error) {
      console.error('Failed to export layout:', error);
    }
  };

  const handleImportFromFile = async (filePath: string) => {
    try {
      const response = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      if (response.ok) {
        const content = await response.text();
        importLayout(content);
        setShowImportModal(false);
      }
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingLayoutId(id);
    setEditingLayoutName(currentName);
  };

  const handleFinishRename = () => {
    if (editingLayoutId && editingLayoutName.trim()) {
      renameLayout(editingLayoutId, editingLayoutName);
    }
    setEditingLayoutId(null);
    setEditingLayoutName("");
  };

  return (
    <div className="layout-manager">
      <div className="layout-header">
        <h3 className="layout-title">
          📐 Layout Manager
          {hasUnsavedChanges && (
            <span style={{
              marginLeft: '8px',
              width: '8px',
              height: '8px',
              display: 'inline-block',
              background: '#fbbf24',
              borderRadius: '50%',
              animation: 'pulse 2s ease infinite',
            }} title="Unsaved changes" />
          )}
        </h3>
        <button
          className="layout-add-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
          title="Create new layout from current canvas"
        >
          +
        </button>
      </div>

      {showCreateForm && (
        <div className="layout-create-form">
          <input
            type="text"
            className="layout-name-input"
            placeholder="Layout name..."
            value={newLayoutName}
            onChange={(e) => setNewLayoutName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveLayout()}
            autoFocus
          />
          <div className="layout-form-actions">
            <button
              className="layout-save-btn"
              onClick={handleSaveLayout}
              disabled={!newLayoutName.trim()}
            >
              Save
            </button>
            <button
              className="layout-cancel-btn"
              onClick={() => {
                setShowCreateForm(false);
                setNewLayoutName("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="layout-list">
        {layoutsArray.length === 0 ? (
          <div className="layout-empty">
            <p>No saved layouts</p>
            <small>Save your current workspace as a layout</small>
          </div>
        ) : (
          layoutsArray.map((layout) => (
            <div
              key={layout.id}
              className={`layout-item ${activeLayoutId === layout.id ? "active" : ""}`}
            >
              <div className="layout-info">
                <div className="layout-name">
                  {editingLayoutId === layout.id ? (
                    <input
                      type="text"
                      className="layout-rename-input"
                      value={editingLayoutName}
                      onChange={(e) => setEditingLayoutName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleFinishRename();
                        if (e.key === "Escape") {
                          setEditingLayoutId(null);
                          setEditingLayoutName("");
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      {layout.name}
                      {activeLayoutId === layout.id && (
                        <span className="active-indicator">●</span>
                      )}
                    </>
                  )}
                </div>
                <div className="layout-meta">
                  {layout.terminals.length} terminals, {layout.cards.length}{" "}
                  cards
                  {layout.backgroundTheme && (
                    <span className="layout-background-tag">
                      {" | "}
                      {layout.backgroundTheme}
                    </span>
                  )}
                </div>
              </div>
              <div className="layout-actions">
                {activeLayoutId !== layout.id && (
                  <button
                    className="layout-action"
                    onClick={() => {
                      // Show reminder if there are unsaved changes
                      if (hasUnsavedChanges && activeLayoutId) {
                        const shouldSwitch = window.confirm(
                          'You have unsaved changes. Do you want to switch layouts without saving?\n\nPress OK to switch without saving, or Cancel to stay.'
                        );
                        if (!shouldSwitch) {
                          return;
                        }
                      }

                      // Check if we should close terminals on layout switch
                      const closeTerminalsOnSwitch = useSettingsStore.getState().closeTerminalsOnLayoutSwitch;

                      if (closeTerminalsOnSwitch && wsRef?.current) {
                        // Close all active terminals via WebSocket
                        agents.forEach((agent) => {
                          wsRef.current?.send(
                            JSON.stringify({
                              type: "close",
                              terminalId: agent.id,
                            })
                          );
                        });
                      } else {
                        // Keep terminals offline - turn them off but don't close
                        agents.forEach((agent) => {
                          const existingTerminal = Array.from(terminalsMap.values()).find(
                            (t) => t.agentId === agent.id,
                          );
                          if (existingTerminal) {
                            const updateTerminal = useCanvasStore.getState().updateTerminal;
                            updateTerminal(existingTerminal.id, {
                              isOn: false,
                              lastAgentId: agent.id,
                            });
                          }
                        });
                      }

                      // Now load the new layout
                      loadLayout(layout.id, {
                        onBackgroundChange: onBackgroundChange
                      });
                      setHasUnsavedChanges(false);
                    }}
                    title="Load layout"
                  >
                    📂
                  </button>
                )}
                <button
                  className="layout-action-btn edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(layout.id, layout.name);
                  }}
                  title="Rename layout"
                  style={{
                    background: editingLayoutId === layout.id
                      ? 'rgba(76, 175, 80, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    borderColor: editingLayoutId === layout.id
                      ? 'rgba(76, 175, 80, 0.5)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  ✏️
                </button>
                {/* Show save button for active layout */}
                {activeLayoutId === layout.id && (
                  <button
                    className="layout-action-btn save"
                    onClick={() => handleManualSave(layout.name, layout.id)}
                    title="Save layout"
                    style={{
                      background: hasUnsavedChanges ? 'rgba(251, 191, 36, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                      border: hasUnsavedChanges ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(76, 175, 80, 0.5)',
                      color: hasUnsavedChanges ? '#fbbf24' : '#4CAF50'
                    }}
                  >
                    💾
                  </button>
                )}
                <button
                  className="layout-action"
                  onClick={() => handleExportLayout(layout.id)}
                  title="Export layout"
                >
                  <Download size={14} />
                </button>
                <button
                  className="layout-action"
                  onClick={() => {
                    if (window.confirm(`Delete layout "${layout.name}"?`)) {
                      deleteLayout(layout.id);
                      if (activeLayoutId === layout.id) {
                        setHasUnsavedChanges(false);
                      }
                    }
                  }}
                  title="Delete layout"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Import/Export/Reset buttons - Stacked for narrow widths */}
      <div className="layout-footer">
        <button
          className="layout-footer-btn import"
          onClick={() => setShowImportModal(true)}
          title="Import layout from file"
        >
          <Upload size={14} />
          <span>Import Layout</span>
        </button>

        <button
          className="layout-footer-btn export"
          onClick={() => setShowExportDirModal(true)}
          title={`Export directory: ${exportDirectory}`}
        >
          <span className="export-label">
            <span className="export-icon">📁</span>
            <span className="export-text">Export Path</span>
          </span>
          <span className="export-path">{shortenPath(exportDirectory, 2)}</span>
        </button>

        <button
          className="layout-footer-btn reset"
          onClick={() => {
            if (window.confirm(
              'Are you sure you want to reset ALL saved data?\n\n' +
              'This will:\n' +
              '• Clear all saved layouts\n' +
              '• Reset all settings to defaults\n' +
              '• Remove all saved state\n' +
              '• Require a page refresh\n\n' +
              'This action cannot be undone!'
            )) {
              // Clear all localStorage data
              localStorage.clear();
              window.location.reload();
            }
          }}
          title="Reset all saved data"
        >
          <RotateCcw size={14} />
          <span>Reset All Data</span>
        </button>
      </div>

      {/* Save reminder */}
      {hasUnsavedChanges && (
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(251, 191, 36, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              background: "#fbbf24",
              borderRadius: "50%",
              animation: "pulse 2s ease infinite",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            Unsaved changes - Press Ctrl+S to save all
          </span>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Import Layout</h3>
            <input
              type="text"
              placeholder="Enter file path..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImportFromFile(e.currentTarget.value);
                }
              }}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowImportModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Directory Modal - DirectorySelector renders its own portal */}
      {showExportDirModal && (
        <DirectorySelector
          currentPath={exportDirectory}
          onSelect={(path) => {
            setExportDirectory(path);
            localStorage.setItem('layout-export-directory', path);
            setShowExportDirModal(false);
          }}
          onClose={() => setShowExportDirModal(false)}
          isOpen={true}
        />
      )}
    </div>
  );
};