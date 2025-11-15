import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';

interface UseTerminalInstanceOptions {
  containerId: string;
  onData?: (data: string) => void;
  theme?: {
    background?: string;
    foreground?: string;
    cursor?: string;
    [key: string]: string | undefined;
  };
  fontSize?: number;
  fontFamily?: string;
}

export function useTerminalInstance(options: UseTerminalInstanceOptions) {
  const {
    containerId,
    onData,
    theme,
    fontSize = 14,
    fontFamily = 'Menlo, Monaco, "Courier New", monospace'
  } = options;

  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const canvasAddonRef = useRef<CanvasAddon | null>(null);
  const [ready, setReady] = useState(false);

  // Use refs for callbacks to prevent recreating terminal
  const onDataRef = useRef(onData);
  useEffect(() => { onDataRef.current = onData; }, [onData]);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[useTerminalInstance] Container #${containerId} not found`);
      return;
    }

    // Create terminal instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      theme: theme || {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#00ff00',
      },
      allowProposedApi: true,
    });

    // Load fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // CRITICAL: Open terminal FIRST before loading Canvas addon
    // This prevents dimension errors
    term.open(container);

    // Fit terminal to container immediately after opening
    fitAddon.fit();

    // Use Canvas addon for consistency (more stable than WebGL)
    // Load AFTER opening to prevent dimension access errors
    try {
      const canvasAddon = new CanvasAddon();
      canvasAddonRef.current = canvasAddon;
      term.loadAddon(canvasAddon);
      console.log('[useTerminalInstance] Canvas addon loaded');
    } catch (err) {
      console.warn('[useTerminalInstance] Canvas addon failed, using default renderer', err);
    }

    // Fit again after canvas addon is loaded
    fitAddon.fit();

    // Set up data handler using ref to prevent recreating terminal
    const dataHandler = term.onData((data) => {
      onDataRef.current?.(data);
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    setReady(true);

    console.log('[useTerminalInstance] Terminal initialized:', {
      cols: term.cols,
      rows: term.rows,
      containerId
    });

    // Auto-fit after a short delay to ensure container has proper dimensions
    const fitTimers: NodeJS.Timeout[] = [];
    fitTimers.push(setTimeout(() => fitAddon.fit(), 50));
    fitTimers.push(setTimeout(() => fitAddon.fit(), 150));
    fitTimers.push(setTimeout(() => fitAddon.fit(), 300));

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Watch for container size changes using ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      // Clear all fit timers
      fitTimers.forEach(timer => clearTimeout(timer));

      // Disconnect resize observer
      resizeObserver.disconnect();

      window.removeEventListener('resize', handleResize);
      dataHandler.dispose();
      canvasAddonRef.current?.dispose();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      canvasAddonRef.current = null;
      setReady(false);
    };
  }, [containerId, fontSize, fontFamily]);

  const write = useCallback((data: string) => {
    if (termRef.current) {
      termRef.current.write(data);
    }
  }, []);

  const writeln = useCallback((data: string) => {
    if (termRef.current) {
      termRef.current.writeln(data);
    }
  }, []);

  const clear = useCallback(() => {
    if (termRef.current) {
      termRef.current.clear();
    }
  }, []);

  const fit = useCallback(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
      return {
        cols: termRef.current?.cols || 0,
        rows: termRef.current?.rows || 0
      };
    }
    return { cols: 0, rows: 0 };
  }, []);

  const focus = useCallback(() => {
    if (termRef.current) {
      termRef.current.focus();
    }
  }, []);

  return {
    term: termRef.current,
    ready,
    write,
    writeln,
    clear,
    fit,
    focus,
    dimensions: {
      cols: termRef.current?.cols || 0,
      rows: termRef.current?.rows || 0
    }
  };
}
