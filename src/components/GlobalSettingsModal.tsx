import React, { useState } from "react";
import { X, Settings, Terminal, Zap, RefreshCw, Layout, Palette, FileText } from "lucide-react";
import { useSettingsStore, terminalThemes, backgroundThemes, staticGradients } from "../stores/useSettingsStore";
import { FileViewerTheme } from "./FileViewerThemeSelector";
import "./GlobalSettingsModal.css";
import "./FileViewerCustomizer.css"; // Import theme grid styles

// File viewer themes (same as FileViewerCustomizer)
const fileViewerThemes: FileViewerTheme[] = [
  {
    id: 'default',
    name: 'Default',
    background: 'rgba(20, 20, 30, 0.95)',
    headerFrom: 'rgba(30, 30, 40, 0.6)',
    headerTo: 'rgba(40, 40, 55, 0.6)',
    border: 'rgba(255, 200, 87, 0.3)',
    textColor: '#e0e0e0',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    background: 'linear-gradient(135deg, #000000 0%, #111111 50%, #1a1a1a 100%)',
    headerFrom: 'rgba(0, 0, 0, 0.7)',
    headerTo: 'rgba(20, 20, 20, 0.7)',
    border: 'rgba(255, 255, 255, 0.1)',
    textColor: '#ffffff',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    headerFrom: 'rgba(15, 23, 42, 0.6)',
    headerTo: 'rgba(30, 41, 59, 0.6)',
    border: 'rgba(148, 163, 184, 0.2)',
    textColor: '#e2e8f0',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: 'linear-gradient(135deg, #0a0f1f 0%, #0f1a3a 30%, #1e3a6a 70%, #1e40af 100%)',
    headerFrom: 'rgba(10, 15, 31, 0.7)',
    headerTo: 'rgba(30, 58, 138, 0.6)',
    border: 'rgba(59, 130, 246, 0.2)',
    textColor: '#e0f2fe',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: 'linear-gradient(135deg, #0a0f0a 0%, #0f1f0f 30%, #14532d 70%, #166534 100%)',
    headerFrom: 'rgba(10, 15, 10, 0.7)',
    headerTo: 'rgba(20, 83, 45, 0.6)',
    border: 'rgba(34, 197, 94, 0.2)',
    textColor: '#dcfce7',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #2a0f0a 30%, #7c2d12 70%, #ea580c 100%)',
    headerFrom: 'rgba(26, 10, 10, 0.7)',
    headerTo: 'rgba(124, 45, 18, 0.6)',
    border: 'rgba(249, 115, 22, 0.2)',
    textColor: '#fef3c7',
  },
  {
    id: 'purple',
    name: 'Purple Haze',
    background: 'linear-gradient(135deg, #0f0a1a 0%, #1a0f2a 30%, #381c57 70%, #6b21a8 100%)',
    headerFrom: 'rgba(15, 10, 26, 0.7)',
    headerTo: 'rgba(56, 28, 87, 0.6)',
    border: 'rgba(139, 92, 246, 0.2)',
    textColor: '#f3e8ff',
  },
];

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    terminalDefaultFontSize,
    terminalDefaultTransparency,
    terminalDefaultTheme,
    terminalDefaultFontFamily,
    fileViewerDefaultFontSize,
    fileViewerDefaultTransparency,
    fileViewerDefaultTheme,
    fileViewerDefaultFontFamily,
    defaultTerminalSize,
    defaultCardSize,
    defaultFileViewerSize,
    fileTreeMaxDepth,
    fileTreeLazyLoad,
    fileTreeSearchMaxDepth,
    wasdBaseSpeed,
    forceZoomTo100OnSpawn,
    closeTerminalsOnLayoutSwitch,
    backgroundTheme,
    canvasTexture,
    canvasTextureIntensity,
    minimapOpacity,
    idleTimeout,
    staticGradient,
    updateSettings,
  } = useSettingsStore();

  const [editingSpawnCommands, setEditingSpawnCommands] = useState(false);
  const [spawnCommandsContent, setSpawnCommandsContent] = useState('');
  const [spawnCommandsLoading, setSpawnCommandsLoading] = useState(false);
  const [spawnCommandsSaving, setSpawnCommandsSaving] = useState(false);
  const [spawnCommandsError, setSpawnCommandsError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEditSpawnCommands = async () => {
    setEditingSpawnCommands(true);
    setSpawnCommandsLoading(true);
    setSpawnCommandsError(null);

    try {
      // Cache-bust to ensure latest spawn-options.json is loaded
      const response = await fetch(`/spawn-options.json?t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to load spawn options');
      const text = await response.text();
      setSpawnCommandsContent(text);
    } catch (err) {
      setSpawnCommandsError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setSpawnCommandsLoading(false);
    }
  };

  const handleSaveSpawnCommands = async () => {
    setSpawnCommandsSaving(true);
    setSpawnCommandsError(null);

    try {
      // Validate JSON first
      JSON.parse(spawnCommandsContent);

      const response = await fetch('/api/files/write-spawn-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: spawnCommandsContent }),
      });

      if (!response.ok) throw new Error('Failed to save spawn options');

      setEditingSpawnCommands(false);
    } catch (err) {
      setSpawnCommandsError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSpawnCommandsSaving(false);
    }
  };

  const handleCancelSpawnCommands = () => {
    setEditingSpawnCommands(false);
    setSpawnCommandsContent('');
    setSpawnCommandsError(null);
  };

  const handleSave = () => {
    onClose();
  };

  return (
    <div
      className="settings-modal-overlay"
      onMouseDown={(e) => {
        // Only close if clicking directly on overlay, not when dragging inside modal
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="settings-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-header">
          <h2>
            <Settings size={20} />
            Global Settings
          </h2>
          <button className="settings-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-content">
          {/* Terminal Behavior Section */}
          <div className="settings-section">
            <h3>
              <Terminal size={16} />
              Terminal Behavior
            </h3>

            {/* Spawn Commands Editor */}
            {!editingSpawnCommands ? (
              <div className="setting-item" style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <button
                  onClick={handleEditSpawnCommands}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #4a9eff 0%, #3d7dd4 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 500,
                  }}
                >
                  <FileText size={14} />
                  Edit Spawn Commands
                </button>
                <span className="setting-description">
                  Customize right-click spawn menu options (spawn-options.json)
                </span>
              </div>
            ) : (
              <div className="setting-item" style={{ marginBottom: '20px' }}>
                <label style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                  Editing spawn-options.json
                </label>
                {spawnCommandsLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#60a5fa' }}>
                    Loading...
                  </div>
                ) : (
                  <>
                    <textarea
                      value={spawnCommandsContent}
                      onChange={(e) => setSpawnCommandsContent(e.target.value)}
                      style={{
                        width: '100%',
                        height: '400px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        padding: '12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        resize: 'vertical',
                      }}
                      spellCheck={false}
                    />
                    {spawnCommandsError && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        borderRadius: '4px',
                        color: '#fca5a5',
                        fontSize: '12px',
                      }}>
                        {spawnCommandsError}
                      </div>
                    )}
                    <div style={{
                      marginTop: '12px',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                    }}>
                      <button
                        onClick={handleCancelSpawnCommands}
                        style={{
                          padding: '6px 14px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSpawnCommands}
                        disabled={spawnCommandsSaving}
                        style={{
                          padding: '6px 14px',
                          background: spawnCommandsSaving ? 'rgba(34, 197, 94, 0.3)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '12px',
                          cursor: spawnCommandsSaving ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {spawnCommandsSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="setting-item">
              <label>Default font size</label>
              <input
                type="range"
                min="10"
                max="24"
                step="1"
                value={terminalDefaultFontSize}
                onChange={(e) =>
                  updateSettings({ terminalDefaultFontSize: parseInt(e.target.value) })
                }
              />
              <span className="setting-value">{terminalDefaultFontSize}px</span>
            </div>

            <div className="setting-item">
              <label>Default transparency</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round((1 - terminalDefaultTransparency) * 100)}
                onChange={(e) =>
                  updateSettings({ terminalDefaultTransparency: 1 - (parseInt(e.target.value) / 100) })
                }
              />
              <span className="setting-value">{Math.round((1 - terminalDefaultTransparency) * 100)}%</span>
              <span className="setting-description">
                Background transparency for new terminals
              </span>
            </div>

            <div className="setting-item">
              <label>Default theme</label>
              <select
                value={terminalDefaultTheme}
                onChange={(e) =>
                  updateSettings({ terminalDefaultTheme: e.target.value as any })
                }
                style={{
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  minWidth: "150px"
                }}
              >
                {terminalThemes.map(theme => (
                  <option key={theme.value} value={theme.value}>
                    {theme.label}
                  </option>
                ))}
              </select>
              <span className="setting-description">
                Default color theme for new terminals
              </span>
            </div>

            <div className="setting-item">
              <label>Default font family</label>
              <select
                value={terminalDefaultFontFamily}
                onChange={(e) =>
                  updateSettings({ terminalDefaultFontFamily: e.target.value })
                }
                style={{
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  minWidth: "200px",
                  fontFamily: terminalDefaultFontFamily
                }}
              >
                <option value="monospace" style={{ fontFamily: "monospace" }}>System Monospace</option>
                <option value="'Fira Code', monospace" style={{ fontFamily: "'Fira Code', monospace" }}>Fira Code</option>
                <option value="'JetBrains Mono', monospace" style={{ fontFamily: "'JetBrains Mono', monospace" }}>JetBrains Mono</option>
                <option value="'Cascadia Code', monospace" style={{ fontFamily: "'Cascadia Code', monospace" }}>Cascadia Code</option>
                <option value="'Source Code Pro', monospace" style={{ fontFamily: "'Source Code Pro', monospace" }}>Source Code Pro</option>
                <option value="'Consolas', monospace" style={{ fontFamily: "'Consolas', monospace" }}>Consolas</option>
                <option value="'Monaco', monospace" style={{ fontFamily: "'Monaco', monospace" }}>Monaco</option>
                <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                <option value="'FiraCode Nerd Font', monospace" style={{ fontFamily: "'FiraCode Nerd Font', monospace" }}>FiraCode Nerd Font</option>
                <option value="'JetBrainsMono Nerd Font', monospace" style={{ fontFamily: "'JetBrainsMono Nerd Font', monospace" }}>JetBrains Mono NF</option>
                <option value="'Hack Nerd Font', monospace" style={{ fontFamily: "'Hack Nerd Font', monospace" }}>Hack Nerd Font</option>
              </select>
              <span className="setting-description">
                Font family for terminal text (requires font installed)
              </span>
            </div>

            <div className="setting-item">
              <label>Default terminal size</label>
              <div className="size-inputs">
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>W</span>
                <input
                  type="number"
                  value={defaultTerminalSize.width}
                  onChange={(e) =>
                    updateSettings({
                      defaultTerminalSize: {
                        ...defaultTerminalSize,
                        width: parseInt(e.target.value) || 600,
                      },
                    })
                  }
                  min="200"
                  max="1200"
                />
                <span>×</span>
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>H</span>
                <input
                  type="number"
                  value={defaultTerminalSize.height}
                  onChange={(e) =>
                    updateSettings({
                      defaultTerminalSize: {
                        ...defaultTerminalSize,
                        height: parseInt(e.target.value) || 400,
                      },
                    })
                  }
                  min="150"
                  max="900"
                />
              </div>
            </div>
          </div>

          {/* File Viewer Section */}
          <div className="settings-section">
            <h3>
              <FileText size={16} />
              File Viewer Defaults
            </h3>

            <div className="setting-item">
              <label>Default font size</label>
              <input
                type="range"
                min="10"
                max="24"
                step="1"
                value={fileViewerDefaultFontSize}
                onChange={(e) =>
                  updateSettings({ fileViewerDefaultFontSize: parseInt(e.target.value) })
                }
              />
              <span className="setting-value">{fileViewerDefaultFontSize}px</span>
            </div>

            <div className="setting-item">
              <label>Default transparency</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round((1 - fileViewerDefaultTransparency) * 100)}
                onChange={(e) =>
                  updateSettings({ fileViewerDefaultTransparency: 1 - (parseInt(e.target.value) / 100) })
                }
              />
              <span className="setting-value">{Math.round((1 - fileViewerDefaultTransparency) * 100)}%</span>
              <span className="setting-description">
                Background transparency for new file viewers
              </span>
            </div>

            <div className="setting-item">
              <label>Default theme</label>
              <div className="theme-grid">
                {fileViewerThemes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`theme-option ${theme.id === fileViewerDefaultTheme ? 'selected' : ''}`}
                    onClick={() => updateSettings({ fileViewerDefaultTheme: theme.id })}
                    title={theme.name}
                  >
                    <div
                      className="theme-preview"
                      style={{
                        background: theme.background,
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <div
                        className="theme-preview-header"
                        style={{
                          background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
                        }}
                      />
                    </div>
                    <span className="theme-name">{theme.name}</span>
                  </div>
                ))}
              </div>
              <span className="setting-description">
                Default theme for new file viewers
              </span>
            </div>

            <div className="setting-item">
              <label>Default font family</label>
              <select
                value={fileViewerDefaultFontFamily}
                onChange={(e) =>
                  updateSettings({ fileViewerDefaultFontFamily: e.target.value })
                }
                style={{
                  padding: "4px 8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  minWidth: "200px",
                  fontFamily: fileViewerDefaultFontFamily
                }}
              >
                <option value="monospace" style={{ fontFamily: "monospace" }}>System Monospace</option>
                <option value="'Fira Code', monospace" style={{ fontFamily: "'Fira Code', monospace" }}>Fira Code</option>
                <option value="'JetBrains Mono', monospace" style={{ fontFamily: "'JetBrains Mono', monospace" }}>JetBrains Mono</option>
                <option value="'Cascadia Code', monospace" style={{ fontFamily: "'Cascadia Code', monospace" }}>Cascadia Code</option>
                <option value="'Source Code Pro', monospace" style={{ fontFamily: "'Source Code Pro', monospace" }}>Source Code Pro</option>
                <option value="'Consolas', monospace" style={{ fontFamily: "'Consolas', monospace" }}>Consolas</option>
                <option value="'Monaco', monospace" style={{ fontFamily: "'Monaco', monospace" }}>Monaco</option>
                <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                <option value="'FiraCode Nerd Font', monospace" style={{ fontFamily: "'FiraCode Nerd Font', monospace" }}>FiraCode Nerd Font</option>
                <option value="'JetBrainsMono Nerd Font', monospace" style={{ fontFamily: "'JetBrainsMono Nerd Font', monospace" }}>JetBrains Mono NF</option>
                <option value="'Hack Nerd Font', monospace" style={{ fontFamily: "'Hack Nerd Font', monospace" }}>Hack Nerd Font</option>
              </select>
              <span className="setting-description">
                Font family for file viewer text (requires font installed)
              </span>
            </div>

            <div className="setting-item">
              <label>Default file viewer size</label>
              <div className="size-inputs">
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>W</span>
                <input
                  type="number"
                  value={defaultFileViewerSize.width}
                  onChange={(e) =>
                    updateSettings({
                      defaultFileViewerSize: {
                        ...defaultFileViewerSize,
                        width: parseInt(e.target.value) || 800,
                      },
                    })
                  }
                  min="300"
                  max="1200"
                />
                <span>×</span>
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>H</span>
                <input
                  type="number"
                  value={defaultFileViewerSize.height}
                  onChange={(e) =>
                    updateSettings({
                      defaultFileViewerSize: {
                        ...defaultFileViewerSize,
                        height: parseInt(e.target.value) || 650,
                      },
                    })
                  }
                  min="200"
                  max="900"
                />
              </div>
            </div>
          </div>

          {/* FileTree Section */}
          <div className="settings-section">
            <h3>
              <FileText size={16} />
              File Tree Settings
            </h3>

            <div className="setting-item">
              <label>Maximum tree depth</label>
              <input
                type="range"
                min="2"
                max="12"
                step="1"
                value={fileTreeMaxDepth}
                onChange={(e) =>
                  updateSettings({ fileTreeMaxDepth: parseInt(e.target.value) })
                }
              />
              <span className="setting-value">{fileTreeMaxDepth}</span>
              <span className="setting-description">
                How deep to load folders in the file tree (lower = better performance)
              </span>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={fileTreeLazyLoad}
                  onChange={(e) =>
                    updateSettings({ fileTreeLazyLoad: e.target.checked })
                  }
                />
                Enable lazy loading
              </label>
              <span className="setting-description">
                Load folder contents only when expanded (improves performance)
              </span>
            </div>

            <div className="setting-item">
              <label>Search max depth</label>
              <input
                type="range"
                min="5"
                max="15"
                step="1"
                value={fileTreeSearchMaxDepth}
                onChange={(e) =>
                  updateSettings({ fileTreeSearchMaxDepth: parseInt(e.target.value) })
                }
              />
              <span className="setting-value">{fileTreeSearchMaxDepth}</span>
              <span className="setting-description">
                Maximum depth when searching files
              </span>
            </div>
          </div>

          {/* Canvas & Appearance Section */}
          <div className="settings-section">
            <h3>
              <Palette size={16} />
              Canvas Appearance
            </h3>

            <div className="setting-item">
              <label>Background Theme</label>
              <select
                value={backgroundTheme}
                onChange={(e) => updateSettings({ backgroundTheme: e.target.value as any })}
                style={{
                  padding: "6px 10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  width: "100%",
                  maxWidth: "250px"
                }}
              >
                {backgroundThemes.map(theme => (
                  <option key={theme.value} value={theme.value}>
                    {theme.label}
                  </option>
                ))}
              </select>
              <span className="setting-description">
                Animated background effect for the canvas
              </span>
            </div>

            <div className="setting-item">
              <label>Static Background Gradient</label>
              <select
                value={staticGradient}
                onChange={(e) => updateSettings({ staticGradient: e.target.value })}
                style={{
                  padding: "6px 10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  width: "100%",
                  maxWidth: "250px"
                }}
              >
                {staticGradients.map(gradient => (
                  <option key={gradient.value} value={gradient.value}>
                    {gradient.label}
                  </option>
                ))}
              </select>
              <span className="setting-description">
                Used when background is "None" or paused during idle (empty canvas)
              </span>
            </div>

            <div className="setting-item">
              <label>Canvas Texture</label>
              <select
                value={canvasTexture}
                onChange={(e) => updateSettings({ canvasTexture: e.target.value })}
                style={{
                  padding: "6px 10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  width: "100%",
                  maxWidth: "250px"
                }}
              >
                <option value="none">None</option>
                <option value="grid">Grid</option>
                <option value="dots">Dots</option>
                <option value="lines">Diagonal Lines</option>
                <option value="hexagon">Hexagon</option>
                <option value="circuit">Circuit Board</option>
                <option value="noise">Noise/Grain</option>
                <option value="topo">Topography</option>
                <option value="graph">Graph Paper</option>
              </select>
              <span className="setting-description">
                Subtle texture overlay for better drag feedback
              </span>
            </div>

            <div className="setting-item">
              <label>Texture Intensity</label>
              <select
                value={canvasTextureIntensity}
                onChange={(e) => updateSettings({ canvasTextureIntensity: e.target.value })}
                style={{
                  padding: "6px 10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "4px",
                  color: "inherit",
                  width: "100%",
                  maxWidth: "150px"
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <span className="setting-description">
                Visibility of the canvas texture
              </span>
            </div>

            <div className="setting-item">
              <label>Minimap Opacity</label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={Math.round(minimapOpacity * 100)}
                onChange={(e) =>
                  updateSettings({ minimapOpacity: parseInt(e.target.value) / 100 })
                }
              />
              <span className="setting-value">{Math.round(minimapOpacity * 100)}%</span>
              <span className="setting-description">
                Adjust the transparency of the minimap
              </span>
            </div>

            <div className="setting-item">
              <label>Background Idle Timeout</label>
              <input
                type="range"
                min="2"
                max="30"
                step="1"
                value={idleTimeout / 1000}
                onChange={(e) =>
                  updateSettings({ idleTimeout: parseInt(e.target.value) * 1000 })
                }
              />
              <span className="setting-value">{idleTimeout / 1000}s</span>
              <span className="setting-description">
                Pause animated background after this many seconds of inactivity (empty canvas only)
              </span>
            </div>
          </div>

          {/* Canvas Navigation Section */}
          <div className="settings-section">
            <h3>
              <Layout size={16} />
              Canvas Navigation
            </h3>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={forceZoomTo100OnSpawn}
                  onChange={(e) =>
                    updateSettings({ forceZoomTo100OnSpawn: e.target.checked })
                  }
                />
                Reset zoom to 100% on spawn
              </label>
              <span className="setting-description">
                Automatically reset canvas zoom when spawning terminals
              </span>
            </div>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={closeTerminalsOnLayoutSwitch}
                  onChange={(e) =>
                    updateSettings({ closeTerminalsOnLayoutSwitch: e.target.checked })
                  }
                />
                Close terminals on layout switch
              </label>
              <span className="setting-description">
                Close running terminals when switching layouts (unchecked = keep offline)
              </span>
            </div>

            <div className="setting-item">
              <label>WASD navigation speed</label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={wasdBaseSpeed}
                onChange={(e) =>
                  updateSettings({ wasdBaseSpeed: parseInt(e.target.value) })
                }
              />
              <span className="setting-value">{wasdBaseSpeed}</span>
            </div>

            <div className="setting-item">
              <label>Default card size</label>
              <div className="size-inputs">
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>W</span>
                <input
                  type="number"
                  value={defaultCardSize.width}
                  onChange={(e) =>
                    updateSettings({
                      defaultCardSize: {
                        ...defaultCardSize,
                        width: parseInt(e.target.value) || 300,
                      },
                    })
                  }
                  min="200"
                  max="600"
                />
                <span>×</span>
                <span style={{ marginRight: '4px', fontSize: '12px', opacity: 0.7 }}>H</span>
                <input
                  type="number"
                  value={defaultCardSize.height}
                  onChange={(e) =>
                    updateSettings({
                      defaultCardSize: {
                        ...defaultCardSize,
                        height: parseInt(e.target.value) || 200,
                      },
                    })
                  }
                  min="150"
                  max="600"
                />
              </div>
            </div>
          </div>

        </div>

        <div className="settings-modal-footer">
          <button className="settings-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-save-btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};