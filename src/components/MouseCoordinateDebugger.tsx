import React, { useState, useEffect, useRef } from 'react';

interface MouseDebugInfo {
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  offsetX: number;
  offsetY: number;
  elementX: number;
  elementY: number;
  zoom: number;
  transformedX?: number;
  transformedY?: number;
}

export const MouseCoordinateDebugger: React.FC<{ canvasZoom: number }> = ({ canvasZoom }) => {
  const [mouseInfo, setMouseInfo] = useState<MouseDebugInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const debugRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Check if we're over a terminal
      const target = e.target as HTMLElement;
      const terminalContainer = target.closest('.terminal-body, .terminal-container');

      if (terminalContainer) {
        const rect = terminalContainer.getBoundingClientRect();

        // Calculate relative position
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;

        // Calculate what the terminal should see (inverse transform)
        const transformedX = relativeX / canvasZoom;
        const transformedY = relativeY / canvasZoom;

        setMouseInfo({
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          offsetX: e.offsetX,
          offsetY: e.offsetY,
          elementX: relativeX,
          elementY: relativeY,
          zoom: canvasZoom,
          transformedX: Math.round(transformedX),
          transformedY: Math.round(transformedY)
        });
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle debugger with Ctrl+Shift+M
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [canvasZoom]);

  if (!isVisible || !mouseInfo) return null;

  return (
    <div
      ref={debugRef}
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#00ff00',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 100000,
        minWidth: '300px',
        border: '1px solid #00ff00',
        boxShadow: '0 4px 12px rgba(0, 255, 0, 0.3)'
      }}
    >
      <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', color: '#00ff00' }}>
        🖱️ Mouse Coordinate Debugger
      </div>

      <div style={{ marginBottom: '8px', color: '#ffff00' }}>
        <strong>Canvas Zoom: {(canvasZoom * 100).toFixed(0)}%</strong>
      </div>

      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
        <div style={{ color: '#00ffff' }}>Browser Coordinates:</div>
        <div>Client: ({mouseInfo.clientX}, {mouseInfo.clientY})</div>
        <div>Page: ({mouseInfo.pageX}, {mouseInfo.pageY})</div>
        <div>Screen: ({mouseInfo.screenX}, {mouseInfo.screenY})</div>
        <div>Offset: ({mouseInfo.offsetX}, {mouseInfo.offsetY})</div>
      </div>

      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
        <div style={{ color: '#00ffff' }}>Relative to Terminal:</div>
        <div>Element: ({mouseInfo.elementX.toFixed(0)}, {mouseInfo.elementY.toFixed(0)})</div>
        <div style={{ color: '#ffff00' }}>
          Transformed: ({mouseInfo.transformedX}, {mouseInfo.transformedY})
        </div>
      </div>

      <div style={{ fontSize: '10px', color: '#888', marginTop: '10px' }}>
        Compare with TUI app coordinates<br/>
        Toggle: Ctrl+Shift+M
      </div>
    </div>
  );
};