import React from 'react';
import Draggable from 'react-draggable';
import { getTerminalIcon } from '../utils/terminalIcons';
import './LockedPlaceholder.css';

interface LockedPlaceholderProps {
  id: string;
  variant: 'terminal' | 'card' | 'file-viewer' | 'session-manager';
  position: { x: number; y: number };
  size: { width: number; height: number };
  canvasZoom: number;
  name?: string;
  terminalType?: string;
  icon?: string;
  onUnlock?: () => void;  // Handler to unlock and return to canvas
}

export const LockedPlaceholder: React.FC<LockedPlaceholderProps> = ({
  id,
  variant,
  position,
  size,
  canvasZoom,
  name = 'Component',
  terminalType,
  icon,
  onUnlock
}) => {
  const nodeRef = React.useRef<HTMLDivElement>(null);

  // Determine icon based on variant
  const displayIcon = icon || {
    'terminal': getTerminalIcon(terminalType || 'bash', name),
    'card': '📝',
    'file-viewer': '📄',
    'session-manager': '📊'
  }[variant];

  // Terminal variant uses OfflineTerminalCard-like styling
  if (variant === 'terminal') {
    return (
      <Draggable
        nodeRef={nodeRef}
        position={position}
        scale={canvasZoom}
        bounds="parent"
        disabled={true}
      >
        <div
          ref={nodeRef}
          className="locked-placeholder locked-placeholder-terminal"
          data-placeholder-id={id}
          style={{
            position: 'absolute',
            width: size.width,
            height: size.height,
            pointerEvents: 'none', // Don't block canvas interactions
          }}
        >
          <div
            className="locked-placeholder-container-terminal"
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent', // Fully transparent background
              border: '2px dashed rgba(251, 191, 36, 0.5)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden', // Prevent content from expanding container
            }}
          >
              <div
                className="locked-placeholder-header"
                style={{
                  padding: '8px 12px',
                  background: 'transparent', // Fully transparent
                  borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '8px 8px 0 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', opacity: 0.6 }}>
                    {displayIcon}
                  </span>
                  <span style={{
                    color: '#888',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    {name}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: '#fbbf24',
                    padding: '2px 6px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    borderRadius: '4px',
                  }}>
                    🔒 Locked
                  </span>
                </div>
                {onUnlock && (
                  <button
                    onClick={onUnlock}
                    style={{
                      pointerEvents: 'auto',  // Enable clicks on this button
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#fbbf24',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.3)';
                    }}
                    title="Unlock and return to canvas"
                  >
                    🔓 Unlock
                  </button>
                )}
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
                  {displayIcon}
                </div>

                <h3 style={{
                  color: '#aaa',
                  fontSize: '18px',
                  fontWeight: 500,
                  marginBottom: '8px',
                }}>
                  {name}
                </h3>

                <p style={{
                  color: '#fbbf24',
                  fontSize: '13px',
                  marginBottom: '12px',
                }}>
                  🔒 Locked to viewport
                </p>

                <p style={{
                  fontSize: '11px',
                  color: '#555',
                  fontFamily: 'monospace',
                }}>
                  This terminal is pinned to your screen
                </p>
              </div>
          </div>
        </div>
      </Draggable>
    );
  }

  // Card, file-viewer, and session-manager variants use simple dotted outline
  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      scale={canvasZoom}
      bounds="parent"
      disabled={true}
    >
      <div
        ref={nodeRef}
        className={`locked-placeholder locked-placeholder-${variant}`}
        data-placeholder-id={id}
        style={{
          position: 'absolute',
          width: size.width,
          height: size.height,
          pointerEvents: 'none', // Don't block canvas interactions
          border: '2px dashed rgba(251, 191, 36, 0.5)',
          borderRadius: '8px',
          background: 'transparent', // Fully transparent background
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        <div style={{
          fontSize: '48px',
          marginBottom: '12px',
          opacity: 0.5,
        }}>
          {displayIcon}
        </div>
        <div style={{
          fontSize: '16px',
          color: '#fbbf24',
          fontWeight: 500,
          marginBottom: '4px',
        }}>
          🔒 {name}
        </div>
        <div style={{
          fontSize: '12px',
          color: '#888',
          marginBottom: '12px',
        }}>
          (Locked to viewport)
        </div>
        {onUnlock && (
          <button
            onClick={onUnlock}
            style={{
              pointerEvents: 'auto',  // Enable clicks on this button
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '4px',
              padding: '6px 12px',
              color: '#fbbf24',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.3)';
            }}
            title="Unlock and return to canvas"
          >
            🔓 Unlock
          </button>
        )}
      </div>
    </Draggable>
  );
};
