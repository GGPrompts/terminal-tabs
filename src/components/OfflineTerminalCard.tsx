import React, { useState, useRef, useCallback, useEffect } from 'react';
import Draggable, { DraggableEvent, DraggableData } from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import { useCanvasStore, TerminalState } from '../stores/canvasStore';
import { getTerminalIcon } from '../utils/terminalIcons';
import './DraggableTerminal.css';

interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
  workingDir?: string;
  gitBranch?: string;
  aiTool?: string;
  paneCommand?: string;
}

interface OfflineTerminalCardProps {
  terminal: TerminalState;
  onSpawn: (terminal: TerminalState) => void;
  canvasZoom: number;
  onFocus: () => void;
  zIndex: number;
}

export const OfflineTerminalCard: React.FC<OfflineTerminalCardProps> = ({
  terminal,
  onSpawn,
  canvasZoom,
  onFocus,
  zIndex
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(terminal.position || { x: 100, y: 100 });
  const [size, setSize] = useState(terminal.size || { width: 600, height: 400 });
  const [isHovered, setIsHovered] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<TmuxSessionInfo | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const updateTerminal = useCanvasStore(s => s.updateTerminal);
  const removeTerminal = useCanvasStore(s => s.removeTerminal);

  // Fetch tmux session info if this terminal has a sessionId/sessionName
  useEffect(() => {
    const fetchSessionInfo = async () => {
      const sessionName = terminal.sessionId || terminal.sessionName;
      if (!sessionName) return;

      setIsLoadingSession(true);
      try {
        const response = await fetch(`/api/tmux/sessions/${encodeURIComponent(sessionName)}`);
        if (response.ok) {
          const data = await response.json();
          setSessionInfo(data.data);
        } else if (response.status === 404) {
          // Session was killed - clear session info
          console.log('[OfflineTerminalCard] Session not found, was killed:', sessionName);
          setSessionInfo(null);
        }
      } catch (error) {
        console.error('Failed to fetch session info:', error);
        // On error, clear session info to avoid showing stale data
        setSessionInfo(null);
      } finally {
        setIsLoadingSession(false);
      }
    };

    fetchSessionInfo();
    // Refresh every 3 seconds while card is visible
    const interval = setInterval(fetchSessionInfo, 3000);
    return () => clearInterval(interval);
  }, [terminal.sessionId, terminal.sessionName]);

  const handleDragStop = useCallback((_e: DraggableEvent, data: DraggableData) => {
    const newPos = { x: data.x, y: data.y };
    setPosition(newPos);
    updateTerminal(terminal.id, { position: newPos });
  }, [terminal.id, updateTerminal]);

  const handleResizeStop = useCallback((_e: any, data: any) => {
    const newSize = { width: data.size.width, height: data.size.height };
    setSize(newSize);
    updateTerminal(terminal.id, { size: newSize });
  }, [terminal.id, updateTerminal]);

  const handleSpawn = useCallback(() => {
    onSpawn(terminal);
  }, [terminal, onSpawn]);

  const handleDelete = useCallback(() => {
    removeTerminal(terminal.id);
  }, [terminal.id, removeTerminal]);

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={position}
      onStop={handleDragStop}
      scale={canvasZoom}
      bounds="parent"
      handle=".offline-terminal-header"
    >
      <div
        ref={nodeRef}
        className="offline-terminal-wrapper"
        style={{
          position: 'absolute',
          zIndex,
        }}
        onClick={onFocus}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <ResizableBox
          width={size.width}
          height={size.height}
          onResizeStop={handleResizeStop}
          minConstraints={[300, 200]}
          maxConstraints={[1200, 800]}
          resizeHandles={['se']}
        >
          <div
            className="offline-terminal-container"
            style={{
              width: '100%',
              height: '100%',
              background: `rgba(20, 20, 30, ${terminal.transparency || 0.85})`,
              border: terminal.embedded ? '2px solid rgba(251, 191, 36, 0.5)' : '2px dashed rgba(100, 100, 120, 0.5)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s',
              backdropFilter: 'blur(10px)',
              boxShadow: isHovered ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              className="offline-terminal-header terminal-drag-handle"
              style={{
                padding: '8px 12px',
                background: 'rgba(30, 30, 40, 0.8)',
                borderBottom: '1px solid rgba(100, 100, 120, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'move',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', opacity: 0.6 }}>
                  {getTerminalIcon(terminal.terminalType, terminal.name)}
                </span>
                <span style={{
                  color: '#888',
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  {terminal.name} (Offline)
                </span>
                <span style={{
                  fontSize: '11px',
                  color: '#666',
                  padding: '2px 6px',
                  background: 'rgba(50, 50, 60, 0.5)',
                  borderRadius: '4px',
                }}>
                  {terminal.terminalType}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="window-control-btn"
                  onClick={handleDelete}
                  title="Remove offline terminal"
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(255, 50, 50, 0.2)',
                    border: '1px solid rgba(255, 50, 50, 0.4)',
                    borderRadius: '4px',
                    color: '#ff6b6b',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '20px',
                opacity: 0.3,
                filter: 'grayscale(50%)',
              }}>
                {getTerminalIcon(terminal.terminalType, terminal.name)}
              </div>

              <h3 style={{
                color: '#aaa',
                fontSize: '18px',
                fontWeight: 500,
                marginBottom: '8px',
              }}>
                {terminal.name}
              </h3>

              <p style={{
                color: terminal.embedded ? '#fbbf24' : '#666',
                fontSize: '13px',
                marginBottom: '12px',
              }}>
                {terminal.embedded ? '🔗 Connected to Command Dispatcher' :
                 (terminal.sessionId || terminal.sessionName) ? 'Detached from tmux session' : 'Terminal is powered off'}
              </p>

              {/* Show tmux session info if available */}
              {sessionInfo && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#aaa',
                  textAlign: 'left',
                  width: '90%',
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: 500, color: '#ddd' }}>
                    📺 Tmux Session Info
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontFamily: 'monospace' }}>
                      <span style={{ color: '#888' }}>Session:</span> {sessionInfo.name}
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Windows:</span> {sessionInfo.windows}
                    </div>
                    {sessionInfo.workingDir && (
                      <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        <span style={{ color: '#888' }}>Dir:</span> {sessionInfo.workingDir}
                      </div>
                    )}
                    {sessionInfo.gitBranch && (
                      <div>
                        <span style={{ color: '#888' }}>Branch:</span> 🌿 {sessionInfo.gitBranch}
                      </div>
                    )}
                    {sessionInfo.paneCommand && (
                      <div style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        <span style={{ color: '#888' }}>Running:</span> {sessionInfo.paneCommand}
                      </div>
                    )}
                    <div>
                      <span style={{ color: '#888' }}>Status:</span> {sessionInfo.attached ? '🔗 Attached' : '💤 Detached'}
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback to working dir if no session info */}
              {!sessionInfo && terminal.workingDir && (
                <div style={{
                  fontSize: '11px',
                  color: '#555',
                  marginBottom: '16px',
                  fontFamily: 'monospace',
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  📂 {terminal.workingDir}
                </div>
              )}

              <button
                onClick={handleSpawn}
                style={{
                  padding: '10px 24px',
                  background: (terminal.sessionId || terminal.sessionName) ?
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)' :  // Green for attach
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',   // Purple for power on
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: (terminal.sessionId || terminal.sessionName) ?
                    '0 4px 12px rgba(16, 185, 129, 0.4)' :
                    '0 4px 12px rgba(102, 126, 234, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = (terminal.sessionId || terminal.sessionName) ?
                    '0 6px 20px rgba(16, 185, 129, 0.6)' :
                    '0 6px 20px rgba(102, 126, 234, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = (terminal.sessionId || terminal.sessionName) ?
                    '0 4px 12px rgba(16, 185, 129, 0.4)' :
                    '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
              >
                {(terminal.sessionId || terminal.sessionName) ? '🔗 Attach to Session' : '⚡ Power On'}
              </button>

              {(terminal.sessionId || terminal.sessionName) && (
                <p style={{
                  fontSize: '10px',
                  color: '#444',
                  marginTop: '12px',
                  fontFamily: 'monospace',
                }}>
                  {isLoadingSession ? 'Loading session info...' : `Session: ${(terminal.sessionId || terminal.sessionName || '').slice(0, 12)}...`}
                </p>
              )}
            </div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
};