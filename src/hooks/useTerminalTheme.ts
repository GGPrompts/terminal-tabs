import { useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getThemeForTerminalType } from '../styles/terminal-themes';
import { refreshTerminalDisplay } from '../utils/terminalRefresh';

/**
 * Hook for applying terminal theme changes.
 *
 * Handles theme application with proper refitting and refresh logic
 * for both WebGL and canvas renderers. Includes special handling for TUI tools.
 *
 * @param xtermRef - Ref to the xterm instance
 * @param fitAddonRef - Ref to the FitAddon instance
 * @param wsRef - Ref to the WebSocket connection
 * @param agentId - Terminal agent ID
 * @param terminalType - Type of terminal (for WebGL detection)
 * @param isTUITool - Whether this is a TUI tool requiring special handling
 * @param debouncedResize - Debounced resize handler function
 * @returns Function to apply a theme change
 */
export function useTerminalTheme(
  xtermRef: React.RefObject<XTerm | null>,
  fitAddonRef: React.RefObject<FitAddon | null>,
  wsRef: React.MutableRefObject<WebSocket | null>,
  agentId: string,
  terminalType: string,
  isTUITool: boolean,
  debouncedResize: (terminalId: string, cols: number, rows: number) => void
) {
  const applyTheme = useCallback((themeName: string) => {
    // Apply new theme to existing terminal
    if (xtermRef.current && fitAddonRef.current) {
      const newTheme = getThemeForTerminalType(themeName);
      xtermRef.current.options.theme = newTheme.xterm;

      // Use the resize trick for ALL terminals to force complete redraw
      // This is the most reliable way to refresh the display after theme change
      setTimeout(() => {
        refreshTerminalDisplay(xtermRef.current, wsRef.current, agentId);
      }, 50);
    }
  }, [xtermRef, fitAddonRef, wsRef, agentId]);

  return applyTheme;
}
