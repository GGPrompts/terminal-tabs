import React, { useState, useEffect } from 'react'
import './SettingsModal.css'
import { backgroundGradients } from '../styles/terminal-backgrounds'

interface SpawnOption {
  label: string
  command: string
  terminalType: string
  icon: string
  description: string
  workingDir?: string
  defaultTheme?: string
  defaultBackground?: string // Background gradient key
  defaultTransparency?: number
  defaultFontFamily?: string
  defaultFontSize?: number
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

// Curated emoji icons for terminal spawn options
const ICON_OPTIONS = [
  '💻', '🖥️', '⌨️', '🖱️', // Computers & Peripherals
  '🤖', '🧠', '👾', '🎮', // AI & Tech
  '📁', '📂', '📄', '📝', // Files
  '⚡', '🔥', '💎', '⭐', // Energy & Quality
  '🚀', '🛸', '🌌', '🌠', // Space
  '🎨', '🎭', '🎪', '🎯', // Arts & Goals
  '🔧', '⚙️', '🔨', '🛠️', // Tools
  '🐚', '🐧', '🐍', '🦀', // Shell & Languages
  '📊', '📈', '📉', '💹', // Data & Charts
  '🔒', '🔓', '🔑', '🛡️', // Security
  '🌐', '🌍', '🗺️', '📡', // Network & World
  '⏱️', '⏰', '⌛', '⏳', // Time
]

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [spawnOptions, setSpawnOptions] = useState<SpawnOption[]>([])
  const [originalOptions, setOriginalOptions] = useState<SpawnOption[]>([]) // Track original state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<SpawnOption>({
    label: '',
    command: '',
    terminalType: 'bash',
    icon: '💻',
    description: '',
    workingDir: '~',
    defaultTheme: 'default',
    defaultBackground: 'dark-neutral',
    defaultTransparency: 100,
    defaultFontFamily: 'monospace',
    defaultFontSize: 14,
  })

  useEffect(() => {
    if (isOpen) {
      loadSpawnOptions()
    }
  }, [isOpen])

  // Close icon picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showIconPicker && !target.closest('.icon-picker-wrapper')) {
        setShowIconPicker(false)
      }
    }
    if (showIconPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showIconPicker])

  const loadSpawnOptions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/spawn-options')
      const result = await response.json()
      if (result.success) {
        setSpawnOptions(result.data)
        setOriginalOptions(JSON.parse(JSON.stringify(result.data))) // Deep copy for comparison
      } else {
        setError('Failed to load spawn options')
      }
    } catch (err) {
      setError('Network error: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return JSON.stringify(spawnOptions) !== JSON.stringify(originalOptions)
  }

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges()) {
      if (confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose()
      }
    } else {
      onClose()
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
    const option = spawnOptions[index]
    // Fill in global defaults for any undefined fields
    setFormData({
      ...option,
      defaultFontSize: option.defaultFontSize ?? 16, // Use global default if not set
      defaultFontFamily: option.defaultFontFamily ?? 'monospace',
      defaultTheme: option.defaultTheme ?? 'default',
      defaultBackground: option.defaultBackground ?? 'dark-neutral',
      defaultTransparency: option.defaultTransparency ?? 100,
    })
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
      defaultBackground: 'dark-neutral',
      defaultTransparency: 100,
      defaultFontFamily: 'monospace',
      defaultFontSize: 14,
    })
    setIsAdding(false)
    setEditingIndex(null)
    setShowIconPicker(false)
  }

  const handleIconSelect = (icon: string) => {
    setFormData({ ...formData, icon })
    setShowIconPicker(false)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Add a subtle opacity to the dragged element
    ;(e.target as HTMLElement).style.opacity = '0.5'
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.target as HTMLElement).style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault() // Allow drop
    e.dataTransfer.dropEffect = 'move'

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    const updated = [...spawnOptions]
    const draggedItem = updated[draggedIndex]

    // Remove from old position
    updated.splice(draggedIndex, 1)
    // Insert at new position
    updated.splice(dropIndex, 0, draggedItem)

    setSpawnOptions(updated)
    setDragOverIndex(null)
  }

  if (!isOpen) return null

  return (
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Spawn Options Manager</h2>
          <button className="close-btn" onClick={handleClose}>✕</button>
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
                  <div
                    key={index}
                    className={`option-item ${dragOverIndex === index ? 'drag-over' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="option-drag-handle" title="Drag to reorder">⋮⋮</div>
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
                <button className="cancel-btn" onClick={handleClose}>
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
                  <div className="icon-picker-wrapper">
                    <button
                      type="button"
                      className="icon-picker-trigger"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                    >
                      <span className="selected-icon">{formData.icon}</span>
                      <span className="picker-arrow">▼</span>
                    </button>
                    {showIconPicker && (
                      <div className="icon-picker-dropdown">
                        {ICON_OPTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            className={`icon-option ${formData.icon === icon ? 'selected' : ''}`}
                            onClick={() => handleIconSelect(icon)}
                            title={icon}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                  Text Color Theme
                  <select
                    value={formData.defaultTheme}
                    onChange={(e) => setFormData({ ...formData, defaultTheme: e.target.value })}
                  >
                    <option value="default">Default</option>
                    <option value="amber">Amber</option>
                    <option value="matrix">Matrix Green</option>
                    <option value="dracula">Dracula</option>
                    <option value="monokai">Monokai</option>
                    <option value="solarized-dark">Solarized Dark</option>
                    <option value="github-dark">GitHub Dark</option>
                    <option value="cyberpunk">Cyberpunk Neon</option>
                    <option value="holographic">Holographic</option>
                    <option value="vaporwave">Vaporwave</option>
                    <option value="retro">Retro Amber</option>
                    <option value="synthwave">Synthwave</option>
                    <option value="aurora">Aurora Borealis</option>
                  </select>
                </label>
                <label>
                  Background Gradient
                  <select
                    value={formData.defaultBackground}
                    onChange={(e) => setFormData({ ...formData, defaultBackground: e.target.value })}
                  >
                    {Object.entries(backgroundGradients).map(([key, bg]) => (
                      <option key={key} value={key}>
                        {bg.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
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
                    placeholder="16 (default)"
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
