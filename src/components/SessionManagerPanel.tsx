import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Draggable from 'react-draggable';
import { useCanvasStore } from '../stores/canvasStore';
import { useLockableComponent } from '../hooks/useLockableComponent';
import './SessionManagerPanel.css';

interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
  created: string;
  workingDir: string | null;
  gitBranch: string | null;
  aiTool: string | null;
  opustratorManaged: boolean;
  claudeState: ClaudeState | null;
  paneCommand: string | null;
}

interface ClaudeState {
  status: string;
  currentTool: string | null;
  lastUpdated: string;
}

interface GroupedSessions {
  opustrator: TmuxSession[];
  claudeCode: TmuxSession[];
  external: TmuxSession[];
}

interface SessionManagerPanelProps {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  canvasZoom?: number;
  onClose: () => void;
  onFocus: () => void;
  onAttachSession: (sessionName: string) => void;
  onDetachSession: (sessionName: string) => void;
  activeAgents: Array<{ id: string; sessionId?: string; sessionName?: string }>;
}

const HEADER_HEIGHT = 60; // App header height

export const SessionManagerPanel: React.FC<SessionManagerPanelProps> = ({
  id,
  position,
  size,
  zIndex,
  canvasZoom = 1,
  onClose,
  onFocus,
  onAttachSession,
  onDetachSession,
  activeAgents,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const {
    isSelected,
    selectItem,
    updateSessionManagerState,
    updateSessionManagerPosition,
    updateSessionManagerSize,
    bringSessionManagerToFront,
    sessionManagerPanel,
  } = useCanvasStore();

  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions>({
    opustrator: [],
    claudeCode: [],
    external: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState({
    opustrator: true,
    claudeCode: false,  // Collapsed by default to save space
    external: false,    // Collapsed by default to save space
  });

  // Load persisted state from store
  const [currentPosition, setCurrentPosition] = useState(sessionManagerPanel?.position || position);
  const [currentSize, setCurrentSize] = useState(sessionManagerPanel?.size || size);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Use the lockable component hook
  const { isLocked, lockedZoom, viewportPosition, handleLockToggle, renderPlaceholder } = useLockableComponent({
    id,
    nodeRef,
    initialLocked: sessionManagerPanel?.isLocked || false,
    initialLockedZoom: sessionManagerPanel?.lockedZoom || 1,
    initialViewportPosition: sessionManagerPanel?.viewportPosition || { x: 100, y: 100 },
    initialCanvasPosition: currentPosition,
    initialSize: currentSize,
    currentPosition: currentPosition,  // Pass current position for accurate placeholder
    currentSize: currentSize,          // Pass current size for accurate placeholder
    canvasZoom,
    canvasOffset: { x: 0, y: 0 },
    onLockChange: (locked) => {
      updateSessionManagerState({ isLocked: locked });
    },
    updateStore: (id, updates) => {
      updateSessionManagerState(updates);
    },
    // Placeholder configuration
    placeholderVariant: 'session-manager',
    placeholderName: 'tmux Session Manager',
  });
  const resizeStartMouse = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/tmux/sessions/detailed');
      const result = await response.json();

      if (result.success) {
        setSessions(result.data.sessions);
        setGroupedSessions(result.data.grouped);
        setError(null);
      } else {
        setError('Failed to fetch sessions');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('[SessionManagerPanel] Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Kill session
  const handleKillSession = async (sessionName: string) => {
    if (!confirm(`Are you sure you want to kill session "${sessionName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tmux/sessions/${encodeURIComponent(sessionName)}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        // Refresh sessions
        fetchSessions();
      } else {
        alert(`Failed to kill session: ${result.error}`);
      }
    } catch (err) {
      alert('Error killing session');
      console.error('[SessionManagerPanel] Error killing session:', err);
    }
  };

  // Show preview
  const handleShowPreview = async (sessionName: string) => {
    setSelectedSession(sessionName);
    setShowPreview(true);

    try {
      const response = await fetch(
        `/api/tmux/sessions/${encodeURIComponent(sessionName)}/preview?lines=50`
      );
      const result = await response.json();

      if (result.success) {
        setPreviewContent(result.data.content);
      } else {
        setPreviewContent(`Error: ${result.error}`);
      }
    } catch (err) {
      setPreviewContent('Error fetching preview');
      console.error('[SessionManagerPanel] Error fetching preview:', err);
    }
  };

  // Get status icon
  const getStatusIcon = (session: TmuxSession): string => {
    if (!session.aiTool) {
      return session.attached ? '●' : '○';
    }

    if (session.claudeState) {
      const { status } = session.claudeState;

      // Check if stale
      if (session.claudeState.lastUpdated) {
        const age = Date.now() - new Date(session.claudeState.lastUpdated).getTime();
        if (age > 60000) {
          return '⚪';
        }
      }

      switch (status) {
        case 'idle':
          return '🟢';
        case 'processing':
          return '🟡';
        case 'tool_use':
          return '🔧';
        case 'working':
          return '⚙️';
        case 'awaiting_input':
          return '⏸️';
        default:
          return '⚪';
      }
    }

    return '🤖';
  };

  // Get status text
  const getStatusText = (session: TmuxSession): string => {
    const parts: string[] = [];

    // Always show attached/detached status first
    parts.push(session.attached ? 'Attached' : 'Detached');

    // Add Claude state info if available
    if (session.claudeState && session.claudeState.status !== 'unknown') {
      parts.push(session.claudeState.status);
      if (session.claudeState.currentTool) {
        parts.push(`Tool: ${session.claudeState.currentTool}`);
      }
    }

    return parts.join(' | ');
  };

  // Toggle group
  const toggleGroup = (group: keyof typeof expandedGroups) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Wrapper for lock toggle from hook
  const handleLockToggleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleLockToggle();
  }, [handleLockToggle]);

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartMouse.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { ...currentSize };
    bringSessionManagerToFront();
    onFocus();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Adjust deltas by canvasZoom for canvas items, but not for locked items
      const deltaX = isLocked
        ? (e.clientX - resizeStartMouse.current.x)
        : (e.clientX - resizeStartMouse.current.x) / (canvasZoom || 1);
      const deltaY = isLocked
        ? (e.clientY - resizeStartMouse.current.y)
        : (e.clientY - resizeStartMouse.current.y) / (canvasZoom || 1);

      const newWidth = Math.max(400, resizeStartSize.current.width + deltaX);
      const newHeight = Math.max(300, resizeStartSize.current.height + deltaY);

      setCurrentSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Save final size to store
      updateSessionManagerSize(currentSize);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, canvasZoom, isLocked, updateSessionManagerSize, currentSize]);

  // Render session item
  // Check if a session is attached to an active frontend terminal
  const isSessionAttached = (sessionName: string) => {
    return activeAgents.some(agent =>
      agent.sessionId === sessionName || agent.sessionName === sessionName
    );
  };

  const renderSession = (session: TmuxSession) => {
    const statusIcon = getStatusIcon(session);
    const statusText = getStatusText(session);
    const isAttached = isSessionAttached(session.name);

    return (
      <div key={session.name} className="session-item">
        <div className="session-header">
          <span className="session-icon">{statusIcon}</span>
          <span className="session-name">{session.name}</span>
          {session.aiTool && <span className="session-badge">{session.aiTool}</span>}
          {isAttached && <span className="session-badge" style={{ background: '#10b981' }}>Active</span>}
        </div>

        {session.workingDir && (
          <div className="session-detail">
            📁 {session.workingDir}
            {session.gitBranch && <span className="git-branch">{session.gitBranch}</span>}
          </div>
        )}

        <div className="session-status">
          {statusText} | {session.windows} window{session.windows > 1 ? 's' : ''}
        </div>

        <div className="session-actions">
          {isAttached ? (
            <button
              className="session-btn session-btn-warning"
              onClick={() => onDetachSession(session.name)}
              title="Detach from this session (power off terminal)"
            >
              Detach
            </button>
          ) : (
            <button
              className="session-btn session-btn-primary"
              onClick={() => onAttachSession(session.name)}
              title="Attach to this session"
            >
              Attach
            </button>
          )}
          <button
            className="session-btn session-btn-secondary"
            onClick={() => handleShowPreview(session.name)}
            title="Preview session output"
          >
            Preview
          </button>
          <button
            className="session-btn session-btn-danger"
            onClick={() => handleKillSession(session.name)}
            title="Kill this session"
          >
            Kill
          </button>
        </div>
      </div>
    );
  };

  // Render group
  const renderGroup = (
    title: string,
    icon: string,
    sessions: TmuxSession[],
    groupKey: keyof typeof expandedGroups
  ) => {
    const isExpanded = expandedGroups[groupKey];

    return (
      <div className="session-group">
        <div className="session-group-header" onClick={() => toggleGroup(groupKey)}>
          <span className="session-group-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="session-group-title">
            {icon} {title} ({sessions.length})
          </span>
        </div>
        {isExpanded && (
          <div className="session-group-content">
            {sessions.length === 0 ? (
              <div className="session-empty">No sessions</div>
            ) : (
              sessions.map(renderSession)
            )}
          </div>
        )}
      </div>
    );
  };

  // Common JSX for panel content
  const panelContent = (
    <div
      ref={nodeRef}
      className={`session-manager-panel ${isLocked ? 'locked' : ''}`}
      data-session-manager-id={id}
      style={{
        width: currentSize.width,
        height: currentSize.height,
        zIndex,
        ...(isLocked && {
          position: 'fixed',
          left: `${viewportPosition.x}px`,
          top: `${viewportPosition.y}px`,
          transform: `scale(${lockedZoom})`,
          transformOrigin: 'top left',
        })
      }}
      onClick={() => {
        if (isSelected(id)) return;
        selectItem(id);
        bringSessionManagerToFront();
        onFocus();
      }}
      onMouseDown={(e) => {
        // Only stop propagation when locked or when NOT clicking on header
        const target = e.target as HTMLElement;
        const isClickingHeader = target.closest('.session-manager-header');

        if (isLocked) {
          // When locked, always stop propagation
          if (!isClickingHeader) {
            e.stopPropagation();
          }
        } else {
          // When unlocked, only stop if NOT on header (let Draggable handle header)
          if (!isClickingHeader) {
            e.stopPropagation();
          }
        }
      }}
    >
      {/* Header */}
      <div
        className="session-manager-header"
        onMouseDown={(e) => {
          // Only stop propagation when locked (portal mode)
          // When unlocked, let Draggable handle the event
          if (isLocked) {
            e.stopPropagation();
          }
          bringSessionManagerToFront();
          onFocus();
        }}
      >
        <div className="session-manager-title">
          <span className="session-manager-icon">📊</span>
          <span>tmux Session Manager</span>
        </div>
        <div className="session-manager-actions">
          <button
            className="session-manager-btn"
            onClick={handleLockToggleClick}
            title={isLocked ? "Unlock from viewport" : "Lock to viewport"}
            style={{ opacity: isLocked ? 1 : 0.7 }}
          >
            {isLocked ? '🔒' : '🔓'}
          </button>
          <button
            className="session-manager-btn"
            onClick={fetchSessions}
            title="Refresh sessions"
          >
            🔄
          </button>
          <button className="session-manager-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="session-manager-content"
        onWheel={(e) => {
          // Check if this panel is selected
          const panelIsSelected = isSelected(id);

          const target = e.currentTarget as HTMLElement;
          const hasVerticalScroll = target.scrollHeight > target.clientHeight;
          const isAtTop = target.scrollTop === 0;
          const isAtBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 1;
          const isScrollingUp = e.deltaY < 0;

          // If not selected, prevent panel scroll and let canvas zoom
          if (!panelIsSelected) {
            e.preventDefault(); // Prevent panel from scrolling
            return; // Let canvas handle zoom
          }

          // Allow zoom if content isn't scrollable or at boundaries
          if (!hasVerticalScroll || (isAtTop && isScrollingUp) || (isAtBottom && !isScrollingUp)) {
            e.preventDefault(); // Prevent panel from scrolling
            return; // Let canvas zoom
          }

          // We're scrolling content - stop propagation to prevent canvas zoom
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          const panelIsSelected = isSelected(id);
          if (!panelIsSelected) return;
          e.stopPropagation();
        }}
      >
        {loading ? (
          <div className="session-loading">Loading sessions...</div>
        ) : error ? (
          <div className="session-error">{error}</div>
        ) : (
          <>
            {renderGroup('Opustrator Sessions', '🔄', groupedSessions.opustrator, 'opustrator')}
            {renderGroup('Claude Code Sessions', '🤖', groupedSessions.claudeCode, 'claudeCode')}
            {renderGroup('External Sessions', '📟', groupedSessions.external, 'external')}

            <div className="session-summary">
              Total: {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="session-manager-resize-handle"
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 50%, rgba(255, 215, 0, 0.3) 50%)',
          borderBottomRightRadius: '14px',
          zIndex: 10,
        }}
      />

      {/* Preview Modal */}
      {showPreview && (
        <div className="session-preview-modal" onClick={() => setShowPreview(false)}>
          <div className="session-preview-content" onClick={e => e.stopPropagation()}>
            <div className="session-preview-header">
              <span>Preview: {selectedSession}</span>
              <button onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <pre className="session-preview-text">{previewContent}</pre>
          </div>
        </div>
      )}
    </div>
  );

  // Render placeholder on canvas when locked
  const placeholder = renderPlaceholder();

  // Render locked panel with portal
  if (isLocked) {
    return (
      <>
        {placeholder}
        {createPortal(panelContent, document.body)}
      </>
    );
  }

  // Regular draggable panel on canvas
  return (
    <Draggable
      nodeRef={nodeRef}
      scale={canvasZoom}
      bounds="parent"
      handle=".session-manager-header"
      disabled={isResizing}
      onStart={() => {
        setIsDragging(true);
        bringSessionManagerToFront();
        onFocus();
      }}
      onStop={(e, data) => {
        setIsDragging(false);
        const newPos = { x: data.x, y: data.y };
        setCurrentPosition(newPos);
        updateSessionManagerPosition(newPos);
      }}
      position={currentPosition}
    >
      {panelContent}
    </Draggable>
  );
};
