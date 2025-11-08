import React, { useState, useEffect } from 'react'
import './SettingsModal.css'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  defaultTheme?: string
  defaultTransparency?: number
  defaultFontFamily?: string
  defaultFontSize?: number
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<SpawnOption>({
    label: '',
    command: '',
    terminalType: 'bash',
    icon: '💻',
    description: '',
    workingDir: '~',
    defaultTheme: 'default',
    defaultTransparency: 100,
    defaultFontFamily: 'monospace',
    defaultFontSize: 14,
  })

  useEffect(() => {
    if (isOpen) {
      loadSpawnOptions()
    }
  }, [isOpen])

  const loadSpawnOptions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/spawn-options')
      const result = await response.json()
      if (result.success) {
        setSpawnOptions(result.data)
      } else {
        setError('Failed to load spawn options')
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSpawnOptions = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/spawn-options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spawnOptions }),
      })
      const result = await response.json()
      if (result.success) {
        onSave()
        onClose()
      } else {
        setError('Failed to save: ' + result.message)
      }
    } catch (err) {
      setError('Save error: ' + (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddOption = () => {
    if (!formData.label || !formData.command) {
      alert('Label and Command are required')
      return
    }
    setSpawnOptions([...spawnOptions, formData])
    resetForm()
  }

  const handleUpdateOption = () => {
    if (editingIndex === null) return
    if (!formData.label || !formData.command) {
      alert('Label and Command are required')
      return
    }
    const updated = [...spawnOptions]
    updated[editingIndex] = formData
    setSpawnOptions(updated)
    resetForm()
  }

  const handleEditOption = (index: number) => {
    setFormData(spawnOptions[index])
    setEditingIndex(index)
    setIsAdding(true)
  }

  const handleDeleteOption = (index: number) => {
    if (confirm('Delete this spawn option?')) {
      setSpawnOptions(spawnOptions.filter((_, i) => i !== index))
    }
  }

  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= spawnOptions.length) return

    const updated = [...spawnOptions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setSpawnOptions(updated)
  }

  const resetForm = () => {
    setFormData({
      label: '',
      command: '',
      terminalType: 'bash',
      icon: '💻',
      description: '',
      workingDir: '~',
      defaultTheme: 'default',
      defaultTransparency: 100,
      defaultFontFamily: 'monospace',
      defaultFontSize: 14,
    })
    setIsAdding(false)
    setEditingIndex(null)
  }

  if (!isOpen) return null

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Spawn Options Manager</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="settings-body">
          {isLoading ? (
            <div className="loading">Loading...</div>
          ) : !isAdding ? (
            <>
              <div className="options-list-header">
                <h3>Spawn Options ({spawnOptions.length})</h3>
                <button className="add-btn" onClick={() => setIsAdding(true)}>
                  + Add New
                </button>
              </div>

              <div className="options-list">
                {spawnOptions.map((option, index) => (
                  <div key={index} className="option-item">
                    <div className="option-main">
                      <span className="option-icon">{option.icon}</span>
                      <div className="option-details">
                        <div className="option-label">
                          {option.label}
                          {index === 0 && <span className="default-badge">DEFAULT</span>}
                        </div>
                        <div className="option-meta">
                          {option.command || 'bash'} • {option.terminalType}
                          {option.workingDir && ` • ${option.workingDir}`}
                        </div>
                      </div>
                    </div>
                    <div className="option-actions">
                      <button
                        className="move-btn"
                        onClick={() => moveOption(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="move-btn"
                        onClick={() => moveOption(index, 'down')}
                        disabled={index === spawnOptions.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="edit-btn"
                        onClick={() => handleEditOption(index)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteOption(index)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="settings-footer">
                <button className="cancel-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={saveSpawnOptions}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="option-form">
              <h3>{editingIndex !== null ? 'Edit Option' : 'New Spawn Option'}</h3>

              <div className="form-row">
                <label>
                  Label *
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Claude Code"
                  />
                </label>
                <label>
                  Icon
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🤖"
                    maxLength={2}
                  />
                </label>
              </div>

              <label>
                Command *
                <input
                  type="text"
                  value={formData.command}
                  onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                  placeholder="e.g., claude, bash, lazygit"
                />
              </label>

              <div className="form-row">
                <label>
                  Terminal Type
                  <select
                    value={formData.terminalType}
                    onChange={(e) => setFormData({ ...formData, terminalType: e.target.value })}
                  >
                    <option value="bash">bash</option>
                    <option value="claude-code">claude-code</option>
                    <option value="opencode">opencode</option>
                    <option value="codex">codex</option>
                    <option value="gemini">gemini</option>
                    <option value="tui-tool">tui-tool</option>
                  </select>
                </label>
                <label>
                  Working Directory
                  <input
                    type="text"
                    value={formData.workingDir}
                    onChange={(e) => setFormData({ ...formData, workingDir: e.target.value })}
                    placeholder="~/projects"
                  />
                </label>
              </div>

              <label>
                Description
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                />
              </label>

              <div className="form-row">
                <label>
                  Theme
                  <select
                    value={formData.defaultTheme}
                    onChange={(e) => setFormData({ ...formData, defaultTheme: e.target.value })}
                  >
                    <option value="default">Default</option>
                    <option value="amber">Amber</option>
                    <option value="matrix">Matrix</option>
                    <option value="dracula">Dracula</option>
                    <option value="monokai">Monokai</option>
                    <option value="solarized-dark">Solarized Dark</option>
                    <option value="github-dark">GitHub Dark</option>
                  </select>
                </label>
                <label>
                  Transparency
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.defaultTransparency}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultTransparency: parseInt(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Font Family
                  <select
                    value={formData.defaultFontFamily}
                    onChange={(e) => setFormData({ ...formData, defaultFontFamily: e.target.value })}
                  >
                    <option value="monospace">Monospace (Default)</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="'Fira Code', monospace">Fira Code</option>
                    <option value="'Source Code Pro', monospace">Source Code Pro</option>
                    <option value="'Menlo', monospace">Menlo</option>
                    <option value="'Consolas', monospace">Consolas</option>
                    <option value="'Monaco', monospace">Monaco</option>
                  </select>
                </label>
                <label>
                  Font Size (px)
                  <input
                    type="number"
                    min="10"
                    max="24"
                    value={formData.defaultFontSize}
                    onChange={(e) =>
                      setFormData({ ...formData, defaultFontSize: parseInt(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  className="save-btn"
                  onClick={editingIndex !== null ? handleUpdateOption : handleAddOption}
                >
                  {editingIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
