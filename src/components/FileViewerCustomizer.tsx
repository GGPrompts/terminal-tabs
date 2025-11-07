import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FileViewerTheme } from "./FileViewerThemeSelector";
import "./FileViewerCustomizer.css";

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

interface FileViewerCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  currentOpacity: number;
  onOpacityChange: (opacity: number) => void;
  currentTheme: string;
  onThemeChange: (theme: FileViewerTheme) => void;
  currentFontFamily?: string;
  onFontFamilyChange?: (fontFamily: string) => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export const FileViewerCustomizer: React.FC<FileViewerCustomizerProps> = ({
  isOpen,
  onClose,
  currentOpacity,
  onOpacityChange,
  currentTheme,
  onThemeChange,
  currentFontFamily = 'monospace',
  onFontFamilyChange,
  buttonRef,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(currentOpacity);
  const [fontFamily, setFontFamily] = useState(currentFontFamily);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use capture phase to handle before bubbling
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen || !buttonRef.current) return null;

  // Calculate position based on button location
  const rect = buttonRef.current.getBoundingClientRect();
  const dropdownStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 8,
    right: window.innerWidth - rect.right,
    zIndex: 100010, // Above terminals (100000) but reasonable
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicks from bubbling to canvas
  };

  return ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      className="file-viewer-customizer"
      style={dropdownStyle}
      onClick={handleDropdownClick}
      onMouseDown={handleDropdownClick}>
      <div className="customizer-header">Customize Appearance</div>

      {/* Transparency Slider */}
      <div className="customizer-section">
        <label className="customizer-label">
          <span>Transparency</span>
          <span className="transparency-value">
            {Math.round((1 - opacity) * 100)}%
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => {
            const newOpacity = parseFloat(e.target.value);
            setOpacity(newOpacity);
            onOpacityChange(newOpacity);
          }}
          className="transparency-slider"
        />
      </div>

      {/* Font Family Selector */}
      {onFontFamilyChange && (
        <div className="customizer-section">
          <label className="customizer-label">
            <span>Font Family</span>
          </label>
          <select
            value={fontFamily}
            onChange={(e) => {
              const newFont = e.target.value;
              setFontFamily(newFont);
              onFontFamilyChange(newFont);
            }}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "4px",
              color: "inherit",
              fontFamily: fontFamily,
              fontSize: "13px",
            }}
          >
            <option value="monospace" style={{ fontFamily: "monospace" }}>System Monospace</option>
            <option value="'Fira Code', monospace" style={{ fontFamily: "'Fira Code', monospace" }}>Fira Code</option>
            <option value="'JetBrains Mono', monospace" style={{ fontFamily: "'JetBrains Mono', monospace" }}>JetBrains Mono</option>
            <option value="'Cascadia Code', monospace" style={{ fontFamily: "'Cascadia Code', monospace" }}>Cascadia Code</option>
            <option value="'Source Code Pro', monospace" style={{ fontFamily: "'Source Code Pro', monospace" }}>Source Code Pro</option>
            <option value="'Consolas', monospace" style={{ fontFamily: "'Consolas', monospace" }}>Consolas</option>
            <option value="'Monaco', monospace" style={{ fontFamily: "'Monaco', monospace" }}>Monaco</option>
            <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
            <option value="'FiraCode Nerd Font', monospace" style={{ fontFamily: "'FiraCode Nerd Font', monospace" }}>FiraCode Nerd Font</option>
            <option value="'JetBrainsMono Nerd Font', monospace" style={{ fontFamily: "'JetBrainsMono Nerd Font', monospace" }}>JetBrains Mono NF</option>
            <option value="'Hack Nerd Font', monospace" style={{ fontFamily: "'Hack Nerd Font', monospace" }}>Hack Nerd Font</option>
          </select>
        </div>
      )}

      {/* Theme Selector */}
      <div className="customizer-section">
        <div className="customizer-label">Theme</div>
        <div className="theme-grid">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className={`theme-option ${theme.id === currentTheme ? 'selected' : ''}`}
              onClick={() => onThemeChange(theme)}
              title={theme.name}
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
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const useFileViewerTheme = (themeId: string = 'default'): FileViewerTheme => {
  return themes.find(t => t.id === themeId) || themes[0];
};