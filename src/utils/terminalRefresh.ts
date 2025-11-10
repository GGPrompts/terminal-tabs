import { Terminal as XTerm } from '@xterm/xterm';

/**
 * Refreshes terminal display using the "resize trick" to force complete redraw.
 *
 * This is the most reliable way to fix stuck/corrupted terminals, especially
 * TUI tools like TFE, LazyGit, htop that don't properly respond to refresh signals.
 *
 * How it works:
 * 1. Refresh the terminal content
 * 2. Resize xterm down by 1 column
 * 3. Send resize signal to PTY (triggers SIGWINCH)
 * 4. Wait 100ms
 * 5. Resize back to original size
 * 6. Send final resize signal to PTY
 *
 * This forces the TUI tool to completely redraw its interface.
 *
 * @param xtermRef - Ref to the xterm instance
 * @param wsRef - Ref to the WebSocket connection
 * @param agentId - Terminal agent ID
 */
export function refreshTerminalDisplay(
  xtermRef: XTerm | null,
  wsRef: WebSocket | null,
  agentId: string
): void {
  if (!xtermRef || !wsRef || wsRef.readyState !== WebSocket.OPEN) {
    console.warn('[terminalRefresh] Cannot refresh - missing terminal or WebSocket');
    return;
  }

  // First refresh the content
  xtermRef.refresh(0, xtermRef.rows - 1);

  // Then do the resize trick to force complete redraw
  setTimeout(() => {
    if (!xtermRef || !wsRef || wsRef.readyState !== WebSocket.OPEN) {
      return;
    }

    const currentCols = xtermRef.cols;
    const currentRows = xtermRef.rows;

    // Resize xterm itself to trigger complete redraw
    xtermRef.resize(currentCols - 1, currentRows);

    // Send resize to PTY (triggers SIGWINCH)
    wsRef.send(
      JSON.stringify({
        type: 'resize',
        terminalId: agentId,
        cols: currentCols - 1,
        rows: currentRows,
      })
    );

    // Wait a moment, then resize back to correct size
    setTimeout(() => {
      if (!xtermRef || !wsRef || wsRef.readyState !== WebSocket.OPEN) {
        return;
      }

      xtermRef.resize(currentCols, currentRows);
      wsRef.send(
        JSON.stringify({
          type: 'resize',
          terminalId: agentId,
          cols: currentCols,
          rows: currentRows,
        })
      );
    }, 100);
  }, 50);
}
