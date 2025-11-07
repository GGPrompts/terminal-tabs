import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './FileViewerThemeSelector.css';

export interface FileViewerTheme {
  id: string;
  name: string;
  background: string;
  headerFrom: string;
  headerTo: string;
  border: string;
  textColor: string;
}

const themes: FileViewerTheme[] = [
  {
    id: 'default',
    name: 'Default',
    background: 'rgba(20, 20, 30, 0.95)',
    headerFrom: 'rgba(30, 30, 40, 0.6)',
    headerTo: 'rgba(40, 40, 55, 0.6)',
    border: 'rgba(255, 200, 87, 0.3)',
    textColor: '#e0e0e0',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    background: 'linear-gradient(135deg, #000000 0%, #111111 50%, #1a1a1a 100%)',
    headerFrom: 'rgba(0, 0, 0, 0.7)',
    headerTo: 'rgba(20, 20, 20, 0.7)',
    border: 'rgba(255, 255, 255, 0.1)',
    textColor: '#ffffff',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    headerFrom: 'rgba(15, 23, 42, 0.6)',
    headerTo: 'rgba(30, 41, 59, 0.6)',
    border: 'rgba(148, 163, 184, 0.2)',
    textColor: '#e2e8f0',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: 'linear-gradient(135deg, #0a0f1f 0%, #0f1a3a 30%, #1e3a6a 70%, #1e40af 100%)',
    headerFrom: 'rgba(10, 15, 31, 0.7)',
    headerTo: 'rgba(30, 58, 138, 0.6)',
    border: 'rgba(59, 130, 246, 0.2)',
    textColor: '#e0f2fe',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: 'linear-gradient(135deg, #0a0f0a 0%, #0f1f0f 30%, #14532d 70%, #166534 100%)',
    headerFrom: 'rgba(10, 15, 10, 0.7)',
    headerTo: 'rgba(20, 83, 45, 0.6)',
    border: 'rgba(34, 197, 94, 0.2)',
    textColor: '#dcfce7',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #2a0f0a 30%, #7c2d12 70%, #ea580c 100%)',
    headerFrom: 'rgba(26, 10, 10, 0.7)',
    headerTo: 'rgba(124, 45, 18, 0.6)',
    border: 'rgba(249, 115, 22, 0.2)',
    textColor: '#fef3c7',
  },
  {
    id: 'purple',
    name: 'Purple Haze',
    background: 'linear-gradient(135deg, #0f0a1a 0%, #1a0f2a 30%, #381c57 70%, #6b21a8 100%)',
    headerFrom: 'rgba(15, 10, 26, 0.7)',
    headerTo: 'rgba(56, 28, 87, 0.6)',
    border: 'rgba(139, 92, 246, 0.2)',
    textColor: '#f3e8ff',
  },
];

interface FileViewerThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (theme: FileViewerTheme) => void;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export const FileViewerThemeSelector: React.FC<FileViewerThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
  buttonRef,
}) => {
  const [isOpen, setIsOpen] = useState(true); // Start open when component mounts
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef?.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use capture phase to handle before bubbling
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [isOpen, buttonRef]);

  const handleThemeSelect = (theme: FileViewerTheme) => {
    onThemeChange(theme);
    setIsOpen(false);
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicks from bubbling to canvas
  };

  if (!isOpen || !buttonRef?.current) return null;

  const rect = buttonRef.current.getBoundingClientRect();

  return createPortal(
    <div
      ref={dropdownRef}
      className="file-viewer-theme-dropdown"
      style={{
        position: 'fixed',
        top: `${rect.bottom + 5}px`,
        left: `${rect.left}px`,
        zIndex: 100010, // Above terminals (100000) but reasonable
      }}
      onClick={handleDropdownClick}
      onMouseDown={handleDropdownClick}
    >
      <div className="theme-dropdown-header">Choose Theme</div>
      {themes.map((theme) => (
        <div
          key={theme.id}
          className={`theme-option ${theme.id === currentTheme ? 'selected' : ''}`}
          onClick={() => handleThemeSelect(theme)}
        >
          <div
            className="theme-preview"
            style={{
              background: theme.background,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              className="theme-preview-header"
              style={{
                background: `linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
              }}
            />
          </div>
          <span className="theme-name">{theme.name}</span>
          {theme.id === currentTheme && <span className="theme-check">✓</span>}
        </div>
      ))}
    </div>,
    document.body
  );
};

export const useFileViewerTheme = (themeId: string = 'default'): FileViewerTheme => {
  return themes.find(t => t.id === themeId) || themes[0];
};

export default FileViewerThemeSelector;