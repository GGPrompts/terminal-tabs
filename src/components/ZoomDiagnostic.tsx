import React, { useEffect, useRef, useState } from 'react';

interface ZoomDiagnosticProps {
  canvasZoom: number;
  canvasRef: React.RefObject<HTMLDivElement>;
}

/**
 * Diagnostic tool to compare Browser Zoom vs Canvas CSS Transform Zoom
 *
 * Usage:
 * 1. Add to App.tsx: <ZoomDiagnostic canvasZoom={canvasZoom} canvasRef={canvasRef} />
 * 2. Open console
 * 3. Try Ctrl+MouseWheel (browser zoom) - see what changes
 * 4. Try canvas zoom buttons - see what changes
 * 5. Compare the differences
 */
export const ZoomDiagnostic: React.FC<ZoomDiagnosticProps> = ({ canvasZoom, canvasRef }) => {
  const [devicePixelRatio, setDevicePixelRatio] = useState(window.devicePixelRatio);
  const testDivRef = useRef<HTMLDivElement>(null);
  const previousSnapshot = useRef<any>(null);

  const captureSnapshot = (trigger: string) => {
    const canvas = canvasRef.current;
    const testDiv = testDivRef.current;

    const snapshot = {
      trigger,
      timestamp: Date.now(),

      // Window properties
      window: {
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        screenX: window.screenX,
        screenY: window.screenY,
      },

      // Document properties
      document: {
        documentElement_clientWidth: document.documentElement.clientWidth,
        documentElement_clientHeight: document.documentElement.clientHeight,
        documentElement_scrollWidth: document.documentElement.scrollWidth,
        documentElement_scrollHeight: document.documentElement.scrollHeight,
        body_clientWidth: document.body.clientWidth,
        body_clientHeight: document.body.clientHeight,
      },

      // Canvas properties (if exists)
      canvas: canvas ? {
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        scrollWidth: canvas.scrollWidth,
        scrollHeight: canvas.scrollHeight,
        boundingRect: canvas.getBoundingClientRect(),
        computedTransform: window.getComputedStyle(canvas).transform,
        computedWidth: window.getComputedStyle(canvas).width,
        computedHeight: window.getComputedStyle(canvas).height,
      } : null,

      // Test div properties (fixed 100x100px div)
      testDiv: testDiv ? {
        offsetWidth: testDiv.offsetWidth,
        offsetHeight: testDiv.offsetHeight,
        clientWidth: testDiv.clientWidth,
        clientHeight: testDiv.clientHeight,
        boundingRect: testDiv.getBoundingClientRect(),
        computedWidth: window.getComputedStyle(testDiv).width,
        computedHeight: window.getComputedStyle(testDiv).height,
      } : null,

      // Canvas zoom state
      canvasZoom: canvasZoom,
    };

    console.group(`🔍 Zoom Diagnostic: ${trigger}`);
    console.log('Full Snapshot:', snapshot);

    if (previousSnapshot.current) {
      console.group('📊 Changes from Previous');

      // Window changes
      if (snapshot.window.devicePixelRatio !== previousSnapshot.current.window.devicePixelRatio) {
        console.log('🎯 devicePixelRatio changed:',
          previousSnapshot.current.window.devicePixelRatio, '→', snapshot.window.devicePixelRatio);
      }
      if (snapshot.window.innerWidth !== previousSnapshot.current.window.innerWidth) {
        console.log('📏 innerWidth changed:',
          previousSnapshot.current.window.innerWidth, '→', snapshot.window.innerWidth);
      }
      if (snapshot.window.innerHeight !== previousSnapshot.current.window.innerHeight) {
        console.log('📏 innerHeight changed:',
          previousSnapshot.current.window.innerHeight, '→', snapshot.window.innerHeight);
      }

      // Document changes
      if (snapshot.document.documentElement_clientWidth !== previousSnapshot.current.document.documentElement_clientWidth) {
        console.log('📄 documentElement.clientWidth changed:',
          previousSnapshot.current.document.documentElement_clientWidth, '→', snapshot.document.documentElement_clientWidth);
      }

      // Canvas changes
      if (snapshot.canvas && previousSnapshot.current.canvas) {
        if (JSON.stringify(snapshot.canvas.boundingRect) !== JSON.stringify(previousSnapshot.current.canvas.boundingRect)) {
          console.log('🎨 Canvas boundingRect changed:',
            previousSnapshot.current.canvas.boundingRect, '→', snapshot.canvas.boundingRect);
        }
        if (snapshot.canvas.offsetWidth !== previousSnapshot.current.canvas.offsetWidth) {
          console.log('🎨 Canvas offsetWidth changed:',
            previousSnapshot.current.canvas.offsetWidth, '→', snapshot.canvas.offsetWidth);
        }
      }

      // Canvas zoom changes
      if (snapshot.canvasZoom !== previousSnapshot.current.canvasZoom) {
        console.log('🔧 canvasZoom changed:',
          previousSnapshot.current.canvasZoom, '→', snapshot.canvasZoom);
      }

      console.groupEnd();
    }

    console.groupEnd();
    previousSnapshot.current = snapshot;
  };

  // Monitor browser zoom (devicePixelRatio changes)
  useEffect(() => {
    const handleResize = () => {
      if (window.devicePixelRatio !== devicePixelRatio) {
        setDevicePixelRatio(window.devicePixelRatio);
        captureSnapshot('Browser Zoom (Ctrl+MouseWheel)');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [devicePixelRatio]);

  // Monitor canvas zoom changes
  useEffect(() => {
    captureSnapshot('Canvas Zoom Changed');
  }, [canvasZoom]);

  // Initial snapshot
  useEffect(() => {
    setTimeout(() => captureSnapshot('Initial Load'), 100);
  }, []);

  // Create a test mouse event listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) { // 1% of mouse moves
        console.log('🖱️ Mouse Coordinates:', {
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          screenX: e.screenX,
          screenY: e.screenY,
          offsetX: e.offsetX,
          offsetY: e.offsetY,
          devicePixelRatio: window.devicePixelRatio,
          canvasZoom: canvasZoom,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [canvasZoom]);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#0f0',
      padding: '10px',
      borderRadius: '5px',
      fontFamily: 'monospace',
      fontSize: '11px',
      zIndex: 999999,
      minWidth: '250px',
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#ff0' }}>
        🔬 Zoom Diagnostic
      </div>
      <div>Browser DPR: {window.devicePixelRatio.toFixed(2)}</div>
      <div>Canvas Zoom: {(canvasZoom * 100).toFixed(0)}%</div>
      <div>Viewport: {window.innerWidth} × {window.innerHeight}</div>
      <div style={{ marginTop: '10px', fontSize: '9px', color: '#888' }}>
        Check console for detailed logs
      </div>

      {/* Hidden test div - fixed 100x100px to measure how zoom affects it */}
      <div
        ref={testDivRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          width: '100px',
          height: '100px',
          background: 'red',
        }}
      />
    </div>
  );
};
