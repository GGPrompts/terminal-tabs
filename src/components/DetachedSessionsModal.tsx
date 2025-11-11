import React, { useState, useEffect } from 'react'
import './DetachedSessionsModal.css'
import { Terminal as StoredTerminal } from '../stores/simpleTerminalStore'

interface DetachedSessionsModalProps {
  isOpen: boolean
  onClose: () => void
  activeSessions: StoredTerminal[]  // NEW
  currentWindowId: string  // NEW
  detachedSessions: StoredTerminal[]
  orphanedSessions: string[]
  onReattach: (terminalIds: string[]) => void
  onKill: (terminalIds: string[]) => void
  onAdoptOrphans: (sessionNames: string[]) => void
  onKillOrphans: (sessionNames: string[]) => void
  onMoveToWindow: (terminalId: string) => void  // NEW
  onDetach: (terminalId: string) => void  // NEW
}

export function DetachedSessionsModal({
  isOpen,
  onClose,
  activeSessions,
  currentWindowId,
  detachedSessions,
  orphanedSessions,
  onReattach,
  onKill,
  onAdoptOrphans,
  onKillOrphans,
  onMoveToWindow,
  onDetach,
}: DetachedSessionsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [orphanSelectedIds, setOrphanSelectedIds] = useState<Set<string>>(new Set())

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Clear selections when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      setOrphanSelectedIds(new Set())  // NEW
    }
  }, [isOpen])

  if (!isOpen) return null

  // Format relative time (5 minutes ago, 2 hours ago)
  const getRelativeTime = (timestamp: number | undefined) => {
    if (!timestamp) return 'unknown'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleReattachSelected = () => {
    if (selectedIds.size > 0) {
      onReattach(Array.from(selectedIds))
      setSelectedIds(new Set())
    }
  }

  const handleKillSelected = () => {
    if (selectedIds.size > 0) {
      if (confirm(`Kill ${selectedIds.size} selected session(s)? This cannot be undone.`)) {
        onKill(Array.from(selectedIds))
        setSelectedIds(new Set())
      }
    }
  }

  const handleKillAll = () => {
    if (confirm(`Kill all ${detachedSessions.length} detached session(s)? This cannot be undone.`)) {
      onKill(detachedSessions.map(t => t.id))
      setSelectedIds(new Set())
    }
  }

  // NEW: Orphan handlers
  const toggleOrphanSelection = (sessionName: string) => {
    setOrphanSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(sessionName)) {
        next.delete(sessionName)
      } else {
        next.add(sessionName)
      }
      return next
    })
  }

  const handleAdoptSelected = () => {
    if (orphanSelectedIds.size > 0) {
      onAdoptOrphans(Array.from(orphanSelectedIds))
      setOrphanSelectedIds(new Set())
    }
  }

  const handleKillOrphansSelected = () => {
    if (orphanSelectedIds.size > 0) {
      if (confirm(`Kill ${orphanSelectedIds.size} selected orphan session(s)? This cannot be undone.`)) {
        onKillOrphans(Array.from(orphanSelectedIds))
        setOrphanSelectedIds(new Set())
      }
    }
  }

  const handleSelectAllOrphans = () => {
    setOrphanSelectedIds(new Set(orphanedSessions))
  }

  return (
    <div className="detached-modal-overlay" onClick={onClose}>
      <div className="detached-modal-content" onClick={e => e.stopPropagation()}>
        <div className="detached-modal-header">
          <h2>📂 Session Manager</h2>
          <button className="detached-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Active Sessions Group */}
        {activeSessions.length > 0 && (
          <div className="session-group active-group">
            <div className="session-group-header">
              <span>🟢 Active Sessions ({activeSessions.length})</span>
            </div>
            <div className="detached-sessions-list">
              {activeSessions.map(terminal => (
                <div
                  key={terminal.id}
                  className="detached-session-item active-session-item"
                >
                  <span className="detached-icon">{terminal.icon || '💻'}</span>
                  <div className="detached-session-info">
                    <div className="detached-name">{terminal.name}</div>
                    <div className="detached-details">
                      {terminal.sessionName} · {(terminal.windowId || 'main') === currentWindowId ? 'This window' : `Window: ${terminal.windowId}`}
                    </div>
                  </div>
                  <button
                    className="detached-action-btn detach-btn"
                    onClick={() => onDetach(terminal.id)}
                    title="Detach this session"
                  >
                    ⊟ Detach
                  </button>
                  <button
                    className="detached-action-btn kill-btn"
                    onClick={() => {
                      if (confirm(`Kill session "${terminal.name}"? This cannot be undone.`)) {
                        onKill([terminal.id])
                      }
                    }}
                    title="Kill this session"
                  >
                    ✕ Kill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detached Sessions Group */}
        <div className="session-group">
          <div className="session-group-header">
            <span>⏸️  Detached Sessions ({detachedSessions.length})</span>
          </div>
          <div className="detached-sessions-list">
          {detachedSessions.length === 0 ? (
            <div className="detached-empty-state">
              <div className="detached-empty-icon">💤</div>
              <div className="detached-empty-text">No detached sessions</div>
            </div>
          ) : (
            detachedSessions.map(terminal => (
              <div
                key={terminal.id}
                className={`detached-session-item ${selectedIds.has(terminal.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="detached-checkbox"
                  checked={selectedIds.has(terminal.id)}
                  onChange={() => toggleSelection(terminal.id)}
                />
                <span className="detached-icon">{terminal.icon || '💻'}</span>
                <div className="detached-session-info">
                  <div className="detached-name">{terminal.name}</div>
                  <div className="detached-details">
                    {terminal.sessionName} · {getRelativeTime(terminal.lastActiveTime || terminal.createdAt)}
                  </div>
                </div>
                <button
                  className="detached-action-btn reattach-btn"
                  onClick={() => onReattach([terminal.id])}
                  title="Reattach this session"
                >
                  Reattach
                </button>
                <button
                  className="detached-action-btn kill-btn"
                  onClick={() => {
                    if (confirm(`Kill session "${terminal.name}"? This cannot be undone.`)) {
                      onKill([terminal.id])
                    }
                  }}
                  title="Kill this session"
                >
                  Kill
                </button>
              </div>
            ))
          )}
          </div>

          {detachedSessions.length > 0 && (
            <div className="detached-modal-actions">
            <button
              className="detached-bulk-btn reattach-bulk-btn"
              disabled={selectedIds.size === 0}
              onClick={handleReattachSelected}
            >
              Reattach Selected ({selectedIds.size})
            </button>
            <button
              className="detached-bulk-btn kill-bulk-btn"
              disabled={selectedIds.size === 0}
              onClick={handleKillSelected}
            >
              Kill Selected ({selectedIds.size})
            </button>
            <button
              className="detached-bulk-btn kill-all-btn"
              onClick={handleKillAll}
            >
              Kill All ({detachedSessions.length})
            </button>
            <button
              className="detached-bulk-btn cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            </div>
          )}
        </div>

        {/* Orphaned Sessions Group */}
        {orphanedSessions.length > 0 && (
          <div className="session-group orphan-group">
            <div className="session-group-header">
              <span>🔴 Orphaned Sessions ({orphanedSessions.length})</span>
            </div>
            <div className="detached-sessions-list">
              {orphanedSessions.map(sessionName => (
                <div
                  key={sessionName}
                  className={`detached-session-item ${orphanSelectedIds.has(sessionName) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="detached-checkbox"
                    checked={orphanSelectedIds.has(sessionName)}
                    onChange={() => toggleOrphanSelection(sessionName)}
                  />
                  <span className="detached-icon">❓</span>
                  <div className="detached-session-info">
                    <div className="detached-name">{sessionName}</div>
                    <div className="detached-details">
                      Tmux session not in localStorage
                    </div>
                  </div>
                  <button
                    className="detached-action-btn adopt-btn"
                    onClick={() => onAdoptOrphans([sessionName])}
                    title="Adopt this session"
                  >
                    Adopt
                  </button>
                  <button
                    className="detached-action-btn kill-btn"
                    onClick={() => {
                      if (confirm(`Kill session "${sessionName}"? This cannot be undone.`)) {
                        onKillOrphans([sessionName])
                      }
                    }}
                    title="Kill this session"
                  >
                    Kill
                  </button>
                </div>
              ))}
            </div>

            <div className="detached-modal-actions">
              <button
                className="detached-bulk-btn"
                onClick={handleSelectAllOrphans}
              >
                ✓ Select All
              </button>
              <button
                className="detached-bulk-btn adopt-bulk-btn"
                disabled={orphanSelectedIds.size === 0}
                onClick={handleAdoptSelected}
              >
                🔄 Adopt Selected ({orphanSelectedIds.size})
              </button>
              <button
                className="detached-bulk-btn kill-bulk-btn"
                disabled={orphanSelectedIds.size === 0}
                onClick={handleKillOrphansSelected}
              >
                ✕ Kill Selected ({orphanSelectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
