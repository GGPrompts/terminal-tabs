import React, { useEffect, useRef } from 'react';
import './TabContextMenu.css';

interface TabContextMenuProps {
  x: number;
  y: number;
  terminalId: string;
  terminalName: string;
  agentId: string | null;
  sessionName?: string;
  onClose: () => void;
  onSplitVertical: () => void;
  onSplitHorizontal: () => void;
  onRename: () => void;
  onRefreshName: () => void;
  onPopOut: () => void;
  onCloseTab: () => void;
}

export function TabContextMenu({
  x,
  y,
  terminalId,
  terminalName,
  agentId,
  sessionName,
  onClose,
  onSplitVertical,
  onSplitHorizontal,
  onRename,
  onRefreshName,
  onPopOut,
  onCloseTab,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // If menu goes off right edge, move it left
      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // If menu goes off bottom edge, move it up
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleMenuClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      style={{ left: x, top: y }}
    >
      <div className="context-menu-header">
        {terminalName}
      </div>

      <div className="context-menu-item" onClick={() => handleMenuClick(onSplitVertical)}>
        <span className="menu-icon">⊞</span>
        <span>Split Vertical</span>
      </div>

      <div className="context-menu-item" onClick={() => handleMenuClick(onSplitHorizontal)}>
        <span className="menu-icon">⊟</span>
        <span>Split Horizontal</span>
      </div>

      <div className="context-menu-separator" />

      <div className="context-menu-item" onClick={() => handleMenuClick(onRename)}>
        <span className="menu-icon">✏️</span>
        <span>Rename Tab</span>
      </div>

      {sessionName && (
        <div className="context-menu-item" onClick={() => handleMenuClick(onRefreshName)}>
          <span className="menu-icon">🔄</span>
          <span>Refresh Name from Tmux</span>
        </div>
      )}

      <div className="context-menu-separator" />

      <div className="context-menu-item" onClick={() => handleMenuClick(onPopOut)}>
        <span className="menu-icon">↗</span>
        <span>Pop Out to New Window</span>
      </div>

      <div className="context-menu-item danger" onClick={() => handleMenuClick(onCloseTab)}>
        <span className="menu-icon">✕</span>
        <span>Close Tab</span>
      </div>
    </div>
  );
}
