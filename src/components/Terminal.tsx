import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";
import { Agent, TERMINAL_TYPES } from "../types";
import {
  getThemeForTerminalType,
  getTerminalClassName,
  terminalThemes,
} from "../styles/terminal-themes";
import { getBackgroundCSS } from "../styles/terminal-backgrounds";
import { ThemeDropdown } from "./ThemeDropdown";
import { debounce } from "../utils/debounce";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useTerminalTheme } from "../hooks/useTerminalTheme";
import { useTerminalResize } from "../hooks/useTerminalResize";
import { useTerminalFont } from "../hooks/useTerminalFont";

interface TerminalProps {
  agent: Agent;
  onClose: () => void;
  onCommand: (command: string) => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
  embedded?: boolean; // when true, hide header/status and let parent provide chrome
  initialTheme?: string; // Initial theme to use
  initialBackground?: string; // Initial background gradient key
  initialOpacity?: number; // Initial opacity (0-1)
  initialFontSize?: number; // Initial font size
  initialFontFamily?: string; // Initial font family
  // A key that changes when the portal host changes (e.g., 'dock' vs 'canvas')
  mountKey?: string;
  onTitleChange?: (title: string) => void; // Callback when xterm title changes
  isSelected?: boolean; // Whether this terminal is currently active (for tab switching refresh)
}

export const Terminal = React.forwardRef<any, TerminalProps>(
  (
    {
      agent,
      onClose,
      onCommand,
      wsRef,
      embedded = false,
      initialTheme,
      initialBackground = 'dark-neutral',
      initialOpacity = 0.2,
      initialFontSize,
      initialFontFamily,
      mountKey,
      onTitleChange,
      isSelected = false,
    },
    ref,
  ) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);
    // Check if this is PyRadio - it needs special theme handling
    const isPyRadio = agent.name?.toLowerCase().includes('pyradio') || (agent as any).toolName === 'pyradio';
    // Get global default theme if not provided
    const globalDefaultTheme = useSettingsStore.getState().terminalDefaultTheme;
    const [currentTheme, setCurrentTheme] = useState(
      initialTheme || globalDefaultTheme || agent.terminalType,
    );
    const [currentBackground, setCurrentBackground] = useState(initialBackground);
    const [opacity, setOpacity] = useState(initialOpacity);
    const themeButtonRef = useRef<HTMLButtonElement>(null);

    // Get tmux setting to conditionally enable scrollback/scrollbar
    const useTmux = useSettingsStore((state) => state.useTmux);

    const terminalInfo = TERMINAL_TYPES.find(
      (t) => t.value === agent.terminalType,
    );

    // Track previous dimensions to avoid unnecessary resize events
    const prevDimensionsRef = useRef({ cols: 0, rows: 0 });

    // Check if this is a TUI tool that needs special handling
    const isTUITool = agent.terminalType === 'tui-tool' ||
                      agent.name?.toLowerCase().includes('pyradio') ||
                      agent.name?.toLowerCase().includes('lazygit') ||
                      agent.name?.toLowerCase().includes('bottom') ||
                      agent.name?.toLowerCase().includes('micro') ||
                      agent.name?.toLowerCase().includes('tfe') ||
                      agent.toolName?.toLowerCase().includes('tfe');

    // Create debounced resize handler that only sends if dimensions actually changed
    // Use shorter debounce for TUI tools to prevent rendering issues
    const debouncedResize = useMemo(
      () =>
        debounce((terminalId: string, cols: number, rows: number) => {
          // Only send if dimensions actually changed
          if (
            cols !== prevDimensionsRef.current.cols ||
            rows !== prevDimensionsRef.current.rows
          ) {
            prevDimensionsRef.current = { cols, rows };

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "resize",
                  terminalId,
                  cols,
                  rows,
                }),
              );

              // For TUI tools, send a screen refresh command after resize
              if (isTUITool) {
                setTimeout(() => {
                  // Send Ctrl+L to refresh the screen for ncurses applications
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: "command",
                        terminalId,
                        command: "\x0C", // Ctrl+L (form feed) to refresh screen
                      }),
                    );
                  }
                }, 50); // Small delay to let resize complete first
              }
            }
          }
        }, isTUITool ? 20 : 200), // 200ms for normal terminals, 20ms for TUI tools
      [isTUITool],
    );

    // Use custom hooks for theme, resize, and font management
    const applyTheme = useTerminalTheme(
      xtermRef,
      fitAddonRef,
      wsRef,
      agent.id,
      agent.terminalType,
      isTUITool,
      debouncedResize
    );
    const { handleResize } = useTerminalResize(
      terminalRef,
      xtermRef,
      fitAddonRef,
      wsRef,
      agent.id,
      agent.name,
      debouncedResize,
      mountKey
    );
    const { updateFontSize, updateFontFamily } = useTerminalFont(
      xtermRef,
      fitAddonRef,
      agent.id,
      initialFontSize,
      debouncedResize
    );

    useEffect(() => {
      if (!terminalRef.current) return;
      // Prevent re-initialization if xterm already exists for this agent
      if (xtermRef.current) return;

      // Initialize xterm with themed glassmorphism-friendly colors
      // Get the appropriate theme based on terminal type or current selection
      // PyRadio needs proper color support but not forced white background
      const theme = isPyRadio ? {
        xterm: {
          background: '#1a1b26',  // Dark background that works with PyRadio's colors
          foreground: '#c0caf5',  // Light text
          cursor: '#c0caf5',
          cursorAccent: '#1a1b26',
          // Ensure proper ANSI colors for PyRadio's interface
          black: '#15161e',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#bb9af7',
          cyan: '#7dcfff',
          white: '#a9b1d6',
          brightBlack: '#414868',
          brightRed: '#f7768e',
          brightGreen: '#9ece6a',
          brightYellow: '#e0af68',
          brightBlue: '#7aa2f7',
          brightMagenta: '#bb9af7',
          brightCyan: '#7dcfff',
          brightWhite: '#c0caf5'
        },
        glowColor: '#7aa2f7'
      } : getThemeForTerminalType(currentTheme);

      // Get font size from settings store or default to 14
      const savedFontSize = initialFontSize || useSettingsStore.getState().terminalDefaultFontSize;
      const savedFontFamily = initialFontFamily || useSettingsStore.getState().terminalDefaultFontFamily;

      // Special settings for TUI tools to improve rendering
      const xtermOptions: any = {
        theme: theme.xterm,
        fontSize: savedFontSize,
        cursorBlink: true,
        allowProposedApi: true,
        // Disable local echo for Docker containers - let the PTY handle it
        cursorStyle: "block",
        // Conditional scrollback: tmux handles it (0), non-tmux needs it (10000)
        scrollback: useTmux ? 0 : 10000,
        convertEol: true,
      };

      // Additional optimizations for TUI tools
      if (isTUITool) {
        // Keep bold text rendering for better visibility
        xtermOptions.drawBoldTextInBrightColors = true;
        xtermOptions.minimumContrastRatio = 1; // Disable contrast adjustment
        xtermOptions.windowsMode = false; // Ensure UNIX-style line endings
        // Ensure proper rendering of box-drawing characters
        xtermOptions.rendererType = 'canvas'; // Force canvas renderer for better box drawing
      }

      const xterm = new XTerm(xtermOptions);

      // Apply font family and fixed metrics for box-drawing accuracy
      try {
        xterm.options.fontFamily = savedFontFamily || 'monospace';
        xterm.options.letterSpacing = 0;
        xterm.options.lineHeight = 1;
      } catch {}


      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      // Load Unicode11 addon for consistent emoji width (2 cells like Windows Terminal)
      const unicode11Addon = new Unicode11Addon();
      xterm.loadAddon(unicode11Addon);
      xterm.unicode.activeVersion = '11';

      // Listen for title changes from xterm (e.g., from MC, htop, etc.)
      if (onTitleChange) {
        xterm.onTitleChange((title) => {
          onTitleChange(title);
        });
      }

      // Disable WebGL for all terminals - canvas renderer handles transparency properly
      // WebGL renders ANSI black backgrounds as solid, breaking Claude Code UI transparency
      // Can re-enable if performance issues arise, but canvas works great for now
      const useWebGL = false;
      if (useWebGL) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
          });
          xterm.loadAddon(webglAddon);
        } catch (e) {
          // console.warn(
          //   "WebGL addon could not be loaded, falling back to canvas renderer",
          //   e,
          // );
        }
      }

      // Enable Shift+Ctrl+C/V for copy/paste (standard terminal shortcuts)
      // Let plain Ctrl+C/V pass through to terminal for TUI apps and tmux
      xterm.attachCustomKeyEventHandler((event) => {
        // Shift+Ctrl+C for copy (standard terminal emulator shortcut)
        if (event.ctrlKey && event.shiftKey && event.key === "C" && xterm.hasSelection()) {
          document.execCommand("copy");
          return false;
        }
        // Shift+Ctrl+V for paste (standard terminal emulator shortcut)
        if (event.ctrlKey && event.shiftKey && event.key === "V") {
          navigator.clipboard.readText().then((text) => {
            xterm.paste(text);
          });
          return false;
        }
        // Let all other keys (including plain Ctrl+C, Ctrl+V, Ctrl+B for tmux, etc.) pass through
        return true;
      });

      // Ensure element exists and has dimensions before opening
      // Bounded retry logic for popout windows where element may have 0x0 dimensions initially
      let retryCount = 0;
      const MAX_RETRIES = 10;
      const RETRY_DELAY = 50;

      const attemptOpen = () => {
        if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
          xterm.open(terminalRef.current);
          console.log(`[Terminal] xterm opened successfully for ${agent.name} (attempt ${retryCount + 1})`);
        } else if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`[Terminal] Element not ready (0x0 dimensions), retrying... (${retryCount}/${MAX_RETRIES})`);
          setTimeout(attemptOpen, RETRY_DELAY);
        } else {
          console.error(`[Terminal] ✗ Failed to open xterm after ${MAX_RETRIES} attempts - element has 0x0 dimensions`);
        }
      };

      attemptOpen();

      // Disable Windows autofill/autocomplete/password manager on the xterm helper textarea
      setTimeout(() => {
        const textarea = terminalRef.current?.querySelector(
          ".xterm-helper-textarea",
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.setAttribute("autocomplete", "off");
          textarea.setAttribute("autocorrect", "off");
          textarea.setAttribute("autocapitalize", "off");
          textarea.setAttribute("spellcheck", "false");
          textarea.setAttribute("data-form-type", "other");
          textarea.setAttribute("data-lpignore", "true");
          textarea.setAttribute("data-1p-ignore", "true");
          // Additional attributes to prevent Windows credential manager
          textarea.setAttribute("readonly", "readonly");
          textarea.removeAttribute("readonly");
          textarea.style.setProperty("ime-mode", "disabled", "important");
        }
      }, 100);

      // Initial auto-focus so keyboard works immediately (even when embedded)
      // Delay focus until terminal is opened
      setTimeout(() => {
        try {
          if (xtermRef.current) {
            xtermRef.current.focus();
          }
        } catch {}
      }, 150);

      // Add event listeners for focus handling (always hand focus to xterm on interaction)
      const focusHandler = (e: Event) => {
        if (
          terminalRef.current &&
          (e.target === terminalRef.current ||
            terminalRef.current.contains(e.target as Node))
        ) {
          try {
            xterm.focus();
            const textarea = terminalRef.current.querySelector(
              ".xterm-helper-textarea",
            ) as HTMLTextAreaElement | null;
            if (textarea) {
              textarea.focus();
              // Re-apply attributes in case they were removed
              textarea.setAttribute("autocomplete", "off");
              textarea.setAttribute("data-form-type", "other");
            }
          } catch {}
        }
      };

      try {
        terminalRef.current.addEventListener("mousedown", focusHandler);
        terminalRef.current.addEventListener("click", focusHandler);
        terminalRef.current.addEventListener("touchstart", focusHandler, {
          passive: true,
        });
      } catch {}

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Delay initial fit and send dimensions to backend
      // Using longer delay to ensure terminal is fully initialized for proper mouse support and scrollback
      setTimeout(() => {
        try {
          // Ensure terminal is opened before fitting
          if (!xtermRef.current || !fitAddonRef.current) {
            // Retry after a short delay
            setTimeout(() => {
              if (xtermRef.current && fitAddonRef.current && terminalRef.current?.parentElement) {
                const containerWidth = terminalRef.current.parentElement.clientWidth;
                const containerHeight = terminalRef.current.parentElement.clientHeight;
                if (containerWidth > 0 && containerHeight > 0) {
                  fitAddonRef.current.fit();
                }
              }
            }, 500);
            return;
          }
          // Calculate dimensions manually to ensure proper fit
          if (terminalRef.current && terminalRef.current.parentElement) {
            const containerWidth =
              terminalRef.current.parentElement.clientWidth;
            const containerHeight =
              terminalRef.current.parentElement.clientHeight;

            // Ensure container has valid dimensions before fitting
            if (containerWidth > 0 && containerHeight > 0) {
              fitAddon.fit();

              console.log(`[Terminal] Initial fit complete for ${agent.name}: ${xterm.cols}x${xterm.rows}, container: ${containerWidth}x${containerHeight}`);

              // Send initial dimensions to backend (with retry if WebSocket not ready)
              const sendResize = (retries = 0) => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  console.log(`[Terminal] Sending resize to backend: ${xterm.cols}x${xterm.rows} for ${agent.name} (agentId: ${agent.id})`);
                  wsRef.current.send(
                    JSON.stringify({
                      type: "resize",
                      terminalId: agent.id,
                      cols: xterm.cols,
                      rows: xterm.rows,
                    }),
                  );
                } else if (retries < 10) {
                  // Retry after 200ms if WebSocket not ready yet
                  console.log(`[Terminal] WebSocket not ready, will retry resize (attempt ${retries + 1}/10)`);
                  setTimeout(() => sendResize(retries + 1), 200);
                } else {
                  console.error(`[Terminal] Failed to send resize after 10 retries - WebSocket never became ready`);
                }
              };

              sendResize();
            }
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.debug('[Terminal] Initial fit error (normal during initialization):', err);
          }
        }
      }, 800); // Consistent delay for proper terminal initialization

      // Handle terminal input - send directly to backend via WebSocket
      // NOTE: We attach this immediately, but filter out data during "spawning" status
      // to prevent escape sequences from leaking to the shell before PTY is ready
      const dataHandler = xterm.onData((data) => {
        // Don't send data if terminal is still spawning (prevent escape sequence leak)
        if (agent.status === 'spawning') {
          console.debug('[Terminal] Ignoring input during spawn:', data.split('').map(c => c.charCodeAt(0).toString(16)).join(' '));
          return;
        }

        // Send all input directly to backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "command",
              terminalId: agent.id,
              command: data,
            }),
          );
        }
      });

      // (Removed banner message per user request to avoid flicker during resize)

      return () => {
        // Remove focus event listeners
        if (terminalRef.current) {
          terminalRef.current.removeEventListener("mousedown", focusHandler);
          terminalRef.current.removeEventListener("click", focusHandler);
          terminalRef.current.removeEventListener("touchstart", focusHandler);
        }

        // Dispose of the data handler
        dataHandler.dispose();

        // Clean up mouse event listeners if they exist
        if ((xterm as any).__mouseCleanup) {
          (xterm as any).__mouseCleanup();
          delete (xterm as any).__mouseCleanup;
        }
        xterm.dispose();
        // Critical: Reset refs so StrictMode remount can reinitialize
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, [agent.id, currentTheme]);

    // Handle WebSocket messages for this terminal
    useEffect(() => {
      const handleTerminalOutput = (event: CustomEvent) => {
        // Only process events for THIS specific terminal
        if (event.detail.terminalId !== agent.id) {
          // Debug: log when we skip an event - commented out to reduce console noise
          // if (agent.embedded) {
          // }
          return;
        }

        // Debug: log when we receive output - commented out to reduce console noise
        // if (agent.embedded) {
        // }

        // Check if xterm is available and not disposed
        const xterm = xtermRef.current;
        if (!xterm || (xterm as any)._core?._isDisposed) return;

        // Write the data
        xterm.write(event.detail.data);
      };

      // Listen for custom terminal-output events
      window.addEventListener(
        "terminal-output",
        handleTerminalOutput as EventListener,
      );

      return () => {
        window.removeEventListener(
          "terminal-output",
          handleTerminalOutput as EventListener,
        );
      };
    }, [agent.id]); // Only depend on agent.id, not the ref itself

    // Handle tab switching - refresh terminal when it becomes visible
    useEffect(() => {
      if (isSelected && xtermRef.current && fitAddonRef.current) {
        // Small delay to ensure display:block has taken effect
        setTimeout(() => {
          try {
            // Refresh the terminal display
            fitAddonRef.current?.fit();
            xtermRef.current?.refresh(0, xtermRef.current.rows - 1);
            // Restore focus
            xtermRef.current?.focus();
          } catch (error) {
            console.warn('[Terminal] Failed to refresh on tab switch:', error);
          }
        }, 50);
      }
    }, [isSelected]);

    // Get theme for CSS styling
    const theme = getThemeForTerminalType(currentTheme);
    const themeClassName = getTerminalClassName(currentTheme);

    // Handle theme change
    const handleThemeChange = (themeName: string) => {
      setCurrentTheme(themeName);
      setShowThemePicker(false);
      applyTheme(themeName);
    };

    // Expose theme and opacity update methods via ref
    React.useImperativeHandle(ref, () => ({
      updateTheme: (themeName: string) => {
        handleThemeChange(themeName);
        // After theme change completes, do a final cleanup to ensure canvas is properly rendered
        setTimeout(() => {
          if (xtermRef.current && fitAddonRef.current) {
            // Scroll to bottom to ensure content is visible
            xtermRef.current.scrollToBottom();
            // Final fit to ensure everything is sized correctly
            fitAddonRef.current.fit();
            // Send resize to backend to ensure PTY is in sync
            debouncedResize(agent.id, xtermRef.current.cols, xtermRef.current.rows);
          }
        }, 600);
      },
      updateBackground: (backgroundKey: string) => {
        setCurrentBackground(backgroundKey);
      },
      updateOpacity: (newOpacity: number) => {
        setOpacity(newOpacity);
      },
      updateFontSize,
      updateFontFamily,
      focus: () => {
        // Only focus if not embedded to avoid stealing focus from chat
        if (!embedded) {
          try {
            xtermRef.current?.focus();
          } catch {}
          try {
            // Also try focusing the hidden textarea to ensure keyboard events are captured
            const ta = terminalRef.current?.querySelector(
              ".xterm-helper-textarea",
            ) as HTMLTextAreaElement | null;
            ta?.focus();
          } catch {}
        }
      },
      clear: () => {
        try {
          xtermRef.current?.clear();
        } catch {}
      },
      reset: () => {
        try {
          xtermRef.current?.reset();
        } catch {}
      },
      refit: () => {
        if (fitAddonRef.current && xtermRef.current) {
          try {
            // Fit the terminal to its container
            fitAddonRef.current.fit();

            // Refresh the display
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);

            // For TUI apps, do a "real" xterm resize to force complete redraw
            if (isTUITool) {
              const currentCols = xtermRef.current.cols;
              const currentRows = xtermRef.current.rows;

              // Resize xterm itself to trigger complete redraw
              xtermRef.current.resize(currentCols - 1, currentRows);

              // Send resize to PTY
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: "resize",
                    terminalId: agent.id,
                    cols: currentCols - 1,
                    rows: currentRows,
                  }),
                );
              }

              // Wait a moment, then resize back to correct size
              setTimeout(() => {
                if (xtermRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  xtermRef.current.resize(currentCols, currentRows);
                  wsRef.current.send(
                    JSON.stringify({
                      type: "resize",
                      terminalId: agent.id,
                      cols: currentCols,
                      rows: currentRows,
                    }),
                  );
                }
              }, 100);
            } else {
              // For non-TUI, use debounced resize with Ctrl+L to fix stuck terminals
              debouncedResize(
                agent.id,
                xtermRef.current.cols,
                xtermRef.current.rows,
              );
            }
          } catch (err) {
            console.error('[Terminal] Refit error:', err);
          }
        }
      },
      sendKeys: (keys: string) => {
        if (xtermRef.current) {
          xtermRef.current.write(keys);
        }
      },
      getXtermInstance: () => {
        return xtermRef.current;
      },
    }));

    return (
      <div
        className={`terminal-container glass terminal-${agent.terminalType} ${themeClassName} ${embedded ? "embedded" : ""} ${isMaximized ? "maximized" : ""} ${isTUITool ? "terminal-tui-tool" : ""} ${isPyRadio ? "terminal-pyradio" : ""} ${useTmux ? "terminal-tmux" : "terminal-no-tmux"}`}
        style={
          {
            borderColor:
              agent.color || terminalInfo?.color || "rgba(255, 255, 255, 0.1)",
            borderWidth: "2px",
            "--glow-color": theme.glowColor || "#00ffff",
            "--terminal-opacity": opacity,
          } as React.CSSProperties
        }
      >
        {/* Dynamic background gradient layer */}
        <div
          className="terminal-background-layer"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: getBackgroundCSS(currentBackground),
            opacity: opacity,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
        {!embedded && (
          <div
            className="terminal-header"
            style={{
              background: `linear-gradient(135deg, ${terminalInfo?.color}33 0%, ${terminalInfo?.color}11 100%)`,
            }}
          >
            <div className="terminal-info">
              <span className="terminal-icon">{terminalInfo?.icon}</span>
              <span className="terminal-name">{agent.name}</span>
              <span className="terminal-type">({agent.terminalType})</span>
            </div>
            <div className="terminal-actions">
              <div className="theme-picker-container">
                <button
                  ref={themeButtonRef}
                  className="terminal-action-btn theme-btn"
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  title="Customize theme"
                >
                  🎨
                </button>
                {showThemePicker && (
                  <ThemeDropdown
                    isOpen={showThemePicker}
                    onClose={() => setShowThemePicker(false)}
                    currentTheme={currentTheme}
                    currentOpacity={opacity}
                    onThemeSelect={handleThemeChange}
                    onOpacityChange={setOpacity}
                    buttonRef={themeButtonRef}
                  />
                )}
                {false && (
                  <div className="theme-dropdown">
                    <div className="theme-dropdown-header">Select Theme</div>
                    {Object.entries(terminalThemes).map(([key, theme]) => (
                      <div
                        key={key}
                        className={`theme-option ${currentTheme === key ? "active" : ""}`}
                        onClick={() => handleThemeChange(key)}
                        onMouseEnter={() => {
                          // Preview theme on hover
                          if (xtermRef.current) {
                            xtermRef.current.options.theme = theme.xterm;
                          }
                        }}
                        onMouseLeave={() => {
                          // Restore current theme
                          if (xtermRef.current) {
                            const currentThemeObj =
                              getThemeForTerminalType(currentTheme);
                            xtermRef.current.options.theme =
                              currentThemeObj.xterm;
                          }
                        }}
                      >
                        <span className="theme-name">{theme.name}</span>
                        <div className="theme-preview">
                          <span style={{ color: theme.xterm.foreground }}>
                            ●
                          </span>
                          <span
                            style={{
                              color:
                                theme.xterm.green || theme.xterm.foreground,
                            }}
                          >
                            ●
                          </span>
                          <span
                            style={{
                              color: theme.xterm.blue || theme.xterm.foreground,
                            }}
                          >
                            ●
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="terminal-action-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restore" : "Maximize"}
              >
                {isMaximized ? "◱" : "◰"}
              </button>
              <button
                className="terminal-action-btn terminal-close"
                onClick={onClose}
                title="Close terminal"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div
          className="terminal-body"
          ref={terminalRef}
        />
        {!embedded && (
          <div className="terminal-status">
            <span className={`status-indicator ${agent.status}`} />
            <span className="status-text">{agent.status}</span>
            {agent.pid && (
              <span className="terminal-pid">PID: {agent.pid}</span>
            )}
          </div>
        )}
      </div>
    );
  },
);
