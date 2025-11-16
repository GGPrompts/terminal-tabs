import React from 'react'
import './HotkeysHelpModal.css'

interface Props {
  show: boolean
  onClose: () => void
}

export function HotkeysHelpModal({ show, onClose }: Props) {
  if (!show) return null

  return (
    <div className="hotkeys-modal">
      <div className="hotkeys-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <div className="hotkeys-header-actions">
          <span className="pinned-indicator" title="Sidebar stays open while working">📌</span>
          <button onClick={onClose} title="Close sidebar">✕</button>
        </div>
      </div>

      <div className="hotkeys-content">
        <section>
          <h3>Tab Management</h3>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>T</kbd>
            <span>Spawn new terminal</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>W</kbd>
            <span>Close active tab</span>
          </div>
          <div className="hotkey-row">
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>
            <span>Reopen last closed tab</span>
          </div>
        </section>

        <section>
          <h3>Tab Navigation</h3>
          <div className="hotkey-row hotkey-tip">
            <span className="tip-icon">💡</span>
            <span>Hold Alt to see tab numbers</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>Tab</kbd>
            <span>Next tab</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd>
            <span>Previous tab</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>]</kbd>
            <span>Next tab (alternative)</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>[</kbd>
            <span>Previous tab (alternative)</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>1</kbd>-<kbd>9</kbd>
            <span>Jump to tab 1-9</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>0</kbd>
            <span>Jump to last tab</span>
          </div>
        </section>

        <section>
          <h3>Splits & Panes</h3>
          <div className="hotkey-row hotkey-tip">
            <span className="tip-icon">💡</span>
            <span>Drag 2 tabs together to create splits</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>H</kbd>
            <span>Split horizontal (tmux)</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>V</kbd>
            <span>Split vertical (tmux)</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>U</kbd>
            <span>Swap pane up</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>D</kbd>
            <span>Swap pane down</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>M</kbd>
            <span>Mark pane</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>S</kbd>
            <span>Swap with marked pane</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>R</kbd>
            <span>Respawn pane</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>X</kbd>
            <span>Kill pane</span>
          </div>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>Z</kbd>
            <span>Zoom toggle</span>
          </div>
        </section>

        <section>
          <h3>Pane Navigation</h3>
          <div className="hotkey-row">
            <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd>/<kbd>←</kbd>/<kbd>→</kbd>
            <span>Navigate between panes</span>
          </div>
        </section>
      </div>
    </div>
  )
}
