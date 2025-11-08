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
import { ThemeDropdown } from "./ThemeDropdown";
import { debounce } from "../utils/debounce";
import { useSettingsStore } from "../stores/useSettingsStore";

interface TerminalProps {
  agent: Agent;
  onClose: () => void;
  onCommand: (command: string) => void;
  wsRef: React.MutableRefObject<WebSocket | null>;
  embedded?: boolean; // when true, hide header/status and let parent provide chrome
  initialTheme?: string; // Initial theme to use
  initialOpacity?: number; // Initial opacity (0-1)
  initialFontSize?: number; // Initial font size
  initialFontFamily?: string; // Initial font family
  canvasZoom?: number; // Canvas zoom level for mouse coordinate correction
  // A key that changes when the portal host changes (e.g., 'dock' vs 'canvas')
  mountKey?: string;
  onTitleChange?: (title: string) => void; // Callback when xterm title changes
  isSelected?: boolean; // Whether this terminal is currently selected (for canvas zoom interaction)
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
      initialOpacity = 0.2,
      initialFontSize,
      initialFontFamily,
      canvasZoom = 1,
      mountKey,
      onTitleChange,
      isSelected = false,
    },
    ref,
  ) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const roRef = useRef<ResizeObserver | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showThemePicker, setShowThemePicker] = useState(false);
    // Check if this is PyRadio - it needs special theme handling
    const isPyRadio = agent.name?.toLowerCase().includes('pyradio') || (agent as any).toolName === 'pyradio';
    // Get global default theme if not provided
    const globalDefaultTheme = useSettingsStore.getState().terminalDefaultTheme;
    const [currentTheme, setCurrentTheme] = useState(
      initialTheme || globalDefaultTheme || agent.terminalType,
    );
    const [opacity, setOpacity] = useState(initialOpacity);
    const themeButtonRef = useRef<HTMLButtonElement>(null);

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
                      agent.name?.toLowerCase().includes('micro');

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
        // Disable scrollback since tmux already handles it
        // This prevents TUI apps from getting corrupted by xterm's scrollback buffer
        scrollback: 0,
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

      // Load WebGL addon for better performance. Avoid WebGL for interactive TUIs moved via portals
      // (e.g., MC in bash, gemini) to prevent context loss/flicker on reparent.
      // Also disable for TUI tools as WebGL doesn't render box-drawing characters properly
      const useWebGL = !["opencode", "bash", "gemini", "tui-tool"].includes(
        agent.terminalType,
      ) && !isTUITool;
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
      if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
        xterm.open(terminalRef.current);
      } else {
        // Try again after a short delay if element isn't ready
        const retryOpen = () => {
          if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
            xterm.open(terminalRef.current);
          } else {
            // Give up after a few retries
            console.warn('[Terminal] Element not ready for xterm.open after retries');
          }
        };
        setTimeout(retryOpen, 100);
      }

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

      // CRITICAL: Mouse coordinate transformation for canvas zoom
      // The key insight from diagnostics:
      // - Browser zoom changes the coordinate system (devicePixelRatio, viewport size)
      // - CSS transform only changes visual rendering (boundingRect ≠ offsetWidth)
      // - We need to transform using the visual-to-layout ratio, NOT just canvasZoom

      // Use WeakSet to track processed events (prevents infinite recursion)
      const processedEvents = new WeakSet<Event>();

      const mouseTransformHandler = (e: MouseEvent) => {
        if (!terminalRef.current) return;

        // Check if we've already processed this event (prevent infinite recursion)
        if (processedEvents.has(e)) {
          return;
        }

        // CRITICAL: For wheel events, only intercept if terminal is selected OR focused
        // This allows canvas zoom when hovering over unselected/unfocused terminals
        // But ensures wheel scrolling works reliably in TUI apps when terminal has focus
        if (e.type === 'wheel' && !isSelected) {
          // Check if the terminal or any of its children has focus
          const hasFocus = terminalRef.current.contains(document.activeElement);
          if (!hasFocus) {
            return; // Let event bubble to App's handleWheel for canvas zoom
          }
          // Terminal has focus (orange border) - intercept wheel for scrolling
        }

        // CRITICAL: Don't intercept mouse events during active drag operations
        // When dragging terminals, react-draggable tracks global mousemove events
        // Transforming these coordinates breaks dragging at non-100% zoom
        const terminalWrapper = terminalRef.current.closest('.draggable-terminal-wrapper');
        if (terminalWrapper && terminalWrapper.classList.contains('dragging')) {
          // A drag is in progress - let react-draggable handle the event
          return;
        }

        // Mark this event as processed
        processedEvents.add(e);

        const rect = terminalRef.current.getBoundingClientRect();
        const offsetWidth = terminalRef.current.offsetWidth;
        const offsetHeight = terminalRef.current.offsetHeight;

        // Calculate the ratio between visual size and layout size
        // This accounts for BOTH browser zoom AND canvas zoom
        const visualToLayoutRatioX = rect.width / offsetWidth;
        const visualToLayoutRatioY = rect.height / offsetHeight;

        // Only transform if there's a visual/layout mismatch (i.e., canvas is zoomed)
        if (Math.abs(visualToLayoutRatioX - 1) > 0.01 || Math.abs(visualToLayoutRatioY - 1) > 0.01) {
          e.stopImmediatePropagation(); // Prevent xterm from seeing original event

          // Get click position relative to terminal (in visual coordinates)
          const visualX = e.clientX - rect.left;
          const visualY = e.clientY - rect.top;

          // Transform to layout coordinates (what xterm expects)
          const layoutX = visualX / visualToLayoutRatioX;
          const layoutY = visualY / visualToLayoutRatioY;

          // Create new event with transformed coordinates
          // CRITICAL: Use WheelEvent for wheel events to preserve deltaY/deltaX
          const transformedEvent = e.type === 'wheel'
            ? new WheelEvent(e.type, {
                bubbles: e.bubbles,
                cancelable: e.cancelable,
                view: e.view,
                detail: e.detail,
                screenX: e.screenX,
                screenY: e.screenY,
                clientX: rect.left + layoutX,
                clientY: rect.top + layoutY,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
                button: e.button,
                buttons: e.buttons,
                relatedTarget: e.relatedTarget,
                deltaX: (e as WheelEvent).deltaX,
                deltaY: (e as WheelEvent).deltaY,
                deltaZ: (e as WheelEvent).deltaZ,
                deltaMode: (e as WheelEvent).deltaMode,
              })
            : new MouseEvent(e.type, {
                bubbles: e.bubbles,
                cancelable: e.cancelable,
                view: e.view,
                detail: e.detail,
                screenX: e.screenX,
                screenY: e.screenY,
                clientX: rect.left + layoutX,
                clientY: rect.top + layoutY,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey,
                button: e.button,
                buttons: e.buttons,
                relatedTarget: e.relatedTarget,
              });

          // Mark the transformed event as processed too
          processedEvents.add(transformedEvent);

          // Dispatch to the xterm viewport element, NOT the terminal wrapper
          // This prevents re-triggering our capture handler
          const xtermViewport = terminalRef.current.querySelector('.xterm-viewport, .xterm-screen');
          if (xtermViewport) {
            xtermViewport.dispatchEvent(transformedEvent);
          } else {
            // Fallback to terminal element if xterm not ready
            terminalRef.current.dispatchEvent(transformedEvent);
          }
        }
      };

      // Add mouse transform handler in capture phase (intercepts BEFORE xterm sees events)
      const mouseEventTypes = ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel'];
      try {
        mouseEventTypes.forEach(eventType => {
          terminalRef.current?.addEventListener(eventType, mouseTransformHandler as EventListener, { capture: true });
        });
      } catch {}

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
            // Only log in development, this is normal during initialization
            if (import.meta.env.DEV) {
              console.debug('[Terminal] Terminal still initializing, will retry fit');
            }
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

              // Send initial dimensions to backend
              if (
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN
              ) {
                wsRef.current.send(
                  JSON.stringify({
                    type: "resize",
                    terminalId: agent.id,
                    cols: xterm.cols,
                    rows: xterm.rows,
                  }),
                );
              }
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

      // Handle resize
      const handleResize = () => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();

          // Send resize dimensions to backend
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "resize",
                terminalId: agent.id,
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
              }),
            );

            // Special handling for PyRadio - send Ctrl+L to force refresh
            if (agent.name?.toLowerCase().includes('pyradio') ||
                (agent as any).toolName === 'pyradio') {
              setTimeout(() => {
                // Send Ctrl+L to refresh PyRadio display
                wsRef.current?.send(
                  JSON.stringify({
                    type: "command",
                    terminalId: agent.id,
                    command: "\x0C", // Ctrl+L character
                  }),
                );
              }, 100);
            }
          }
        }
      };

      window.addEventListener("resize", handleResize);
      // ResizeObserver for container size changes (drag/resize)
      if (terminalRef.current?.parentElement) {
        roRef.current = new ResizeObserver((entries) => {
          if (fitAddonRef.current && xtermRef.current) {
            // Get the actual dimensions from the resize entry
            const entry = entries[0];
            if (
              entry &&
              entry.contentRect.width > 0 &&
              entry.contentRect.height > 0
            ) {
              try {
                fitAddonRef.current.fit();
                // Use debounced resize handler
                debouncedResize(
                  agent.id,
                  xtermRef.current.cols,
                  xtermRef.current.rows,
                );
              } catch {}
            }
          }
        });
        roRef.current.observe(terminalRef.current.parentElement);
      }

      // Listen for font size changes (only apply if no initialFontSize is set)
      const handleFontSizeChange = (event: CustomEvent) => {
        // If this terminal has a specific font size, ignore global changes
        if (initialFontSize) return;

        const newSize = event.detail.fontSize;
        if (xterm && newSize) {
          xterm.options.fontSize = newSize;
          // Refit terminal after font size change
          setTimeout(() => {
            if (fitAddon) {
              fitAddon.fit();
            }
          }, 100);
        }
      };

      window.addEventListener(
        "terminalFontSizeChange",
        handleFontSizeChange as any,
      );

      // (Removed banner message per user request to avoid flicker during resize)

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener(
          "terminalFontSizeChange",
          handleFontSizeChange as any,
        );

        // Remove mouse transform handlers
        if (terminalRef.current) {
          mouseEventTypes.forEach(eventType => {
            terminalRef.current?.removeEventListener(eventType, mouseTransformHandler as EventListener, { capture: true });
          });
        }

        // Remove focus event listeners
        if (terminalRef.current) {
          terminalRef.current.removeEventListener("mousedown", focusHandler);
          terminalRef.current.removeEventListener("click", focusHandler);
          terminalRef.current.removeEventListener("touchstart", focusHandler);
        }

        // Dispose of the data handler
        dataHandler.dispose();

        try {
          roRef.current?.disconnect();
        } catch {}
        roRef.current = null;
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

    // Hot Refresh Recovery: Force a fit after mount to handle HMR scenarios
    // During hot refresh, the xterm instance might exist but not be properly rendered
    useEffect(() => {
      if (!xtermRef.current || !fitAddonRef.current) return;

      // Wait for DOM to settle after hot refresh
      const timer = setTimeout(() => {
        try {
          const parent = terminalRef.current?.parentElement;
          if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
            fitAddonRef.current?.fit();
            xtermRef.current?.refresh(0, xtermRef.current.rows - 1);

            // Send resize to backend
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && xtermRef.current) {
              wsRef.current.send(
                JSON.stringify({
                  type: "resize",
                  terminalId: agent.id,
                  cols: xtermRef.current.cols,
                  rows: xtermRef.current.rows,
                }),
              );
            }
          }
        } catch (err) {
          console.debug('[Terminal] Hot refresh fit error:', err);
        }
      }, 100);

      return () => clearTimeout(timer);
    }, []); // Empty deps - only run once after mount

    /**
     * ✅ SOLVED: Terminal mouse accuracy at non-100% zoom
     *
     * Solution: Event interception with visual-to-layout ratio transformation
     * - Intercepts mouse events in capture phase (before xterm sees them)
     * - Calculates ratio: rect.width / offsetWidth (accounts for both browser & canvas zoom)
     * - Transforms visual coordinates to layout coordinates
     * - Dispatches corrected events to .xterm-viewport element
     *
     * Implementation: Lines ~333-428 (mouseTransformHandler)
     * Documentation: docs/MOUSE_COORDINATE_FIX.md
     * Status: Tested at 25%-300% zoom, works with browser zoom + canvas zoom
     */

    // Canvas zoom is handled by parent transform - no font size adjustment needed
    // Font size stays constant, visual zoom comes from canvas scale()

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

      // Listen for container resize events dispatched by wrapper to refit columns precisely
      const handleContainerResized = (e: CustomEvent) => {
        if (e.detail.id === agent.id && fitAddonRef.current) {
          // Small timeout allows DOM layout to settle
          requestAnimationFrame(() => {
            try {
              fitAddonRef.current!.fit();
              const cols = xtermRef.current?.cols || 0;
              const rows = xtermRef.current?.rows || 0;

              // After a fit, send exact cols/rows to backend so PTY wraps correctly
              if (
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN &&
                xtermRef.current
              ) {
                wsRef.current.send(
                  JSON.stringify({
                    type: "resize",
                    terminalId: agent.id,
                    cols: xtermRef.current.cols,
                    rows: xtermRef.current.rows,
                  }),
                );
              }
            } catch (err) {
              console.error('[Terminal] Resize error:', err);
            }
          });
        }
      };
      window.addEventListener(
        "terminal-container-resized",
        handleContainerResized as EventListener,
      );

      return () => {
        window.removeEventListener(
          "terminal-output",
          handleTerminalOutput as EventListener,
        );
        window.removeEventListener(
          "terminal-container-resized",
          handleContainerResized as EventListener,
        );
      };
    }, [agent.id]); // Only depend on agent.id, not the ref itself

    // Re-attach ResizeObserver and force a re-fit when the portal host changes (dock <-> canvas)
    useEffect(() => {
      // Only run if the terminal is initialized
      if (!terminalRef.current || !xtermRef.current || !fitAddonRef.current)
        return;

      // Re-attach ResizeObserver to the new parent element
      try {
        roRef.current?.disconnect();
      } catch {}
      roRef.current = null;
      const parent = terminalRef.current?.parentElement;
      if (parent) {
        try {
          roRef.current = new ResizeObserver(() => {
            try {
              fitAddonRef.current?.fit();
              if (xtermRef.current) {
                // Use debounced resize handler
                debouncedResize(
                  agent.id,
                  xtermRef.current.cols,
                  xtermRef.current.rows,
                );
              }
            } catch {}
          });
          roRef.current.observe(parent);
        } catch {}
      }

      // After reparenting, ensure container has size before fit/focus
      let attempts = 0;
      const tryFit = () => {
        attempts++;
        const parentEl = terminalRef.current?.parentElement;
        const ready =
          !!parentEl && parentEl.clientWidth > 0 && parentEl.clientHeight > 0;
        if (!ready && attempts < 10) {
          return setTimeout(tryFit, 40);
        }
        try {
          fitAddonRef.current?.fit();
          xtermRef.current?.refresh(0, xtermRef.current.rows - 1);
          // Always restore focus after a reparent so typing works
          xtermRef.current?.focus();
          const ta = terminalRef.current?.querySelector(
            ".xterm-helper-textarea",
          ) as HTMLTextAreaElement | null;
          ta?.focus();
          if (
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            xtermRef.current
          ) {
            wsRef.current.send(
              JSON.stringify({
                type: "resize",
                terminalId: agent.id,
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
              }),
            );
          }
        } catch {}
      };
      setTimeout(tryFit, 50);
    }, [mountKey, agent.id]);

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

      // Apply new theme to existing terminal
      if (xtermRef.current && fitAddonRef.current) {
        const newTheme = getThemeForTerminalType(themeName);
        xtermRef.current.options.theme = newTheme.xterm;

        // For WebGL terminals, be more conservative with refitting
        const usesWebGL = !["opencode", "bash", "gemini"].includes(
          agent.terminalType,
        );

        if (usesWebGL) {
          // For WebGL terminals, just do a simple refresh and single refit
          // Increased delay to ensure theme is fully applied before refresh
          setTimeout(() => {
            if (xtermRef.current && fitAddonRef.current) {
              // Refresh the terminal content
              xtermRef.current.refresh(0, xtermRef.current.rows - 1);

              // Single refit after a longer delay to let WebGL settle
              setTimeout(() => {
                if (fitAddonRef.current && xtermRef.current) {
                  // For TUI apps, do a "real" resize to force complete redraw
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
                    // For non-TUI, just fit and send resize with Ctrl+L
                    fitAddonRef.current.fit();
                    debouncedResize(
                      agent.id,
                      xtermRef.current.cols,
                      xtermRef.current.rows,
                    );
                  }
                }
              }, 200);
            }
          }, 150);
        } else {
          // For non-WebGL terminals, use the more aggressive refitting
          // Increased initial delay to ensure theme is fully applied
          setTimeout(() => {
            if (xtermRef.current && fitAddonRef.current) {
              // Strategy 1: Fit the terminal
              fitAddonRef.current.fit();

              // Strategy 2: Force a full refresh
              xtermRef.current.refresh(0, xtermRef.current.rows - 1);

              // Strategy 3: Trigger resize event
              const resizeEvent = new Event("resize");
              window.dispatchEvent(resizeEvent);

              // Strategy 4: Additional refit after animation starts
              setTimeout(() => {
                if (xtermRef.current && fitAddonRef.current) {
                  // Scroll to bottom to ensure content is visible
                  xtermRef.current.scrollToBottom();
                  fitAddonRef.current.fit();
                  xtermRef.current.refresh(0, xtermRef.current.rows - 1);
                }
              }, 100);

              // Strategy 5: Final refit after CSS animations settle
              setTimeout(() => {
                if (xtermRef.current && fitAddonRef.current) {
                  // For TUI apps, do a "real" resize to force complete redraw
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
                    // For non-TUI, fit and use debounced resize with Ctrl+L (fixes stuck terminals)
                    fitAddonRef.current.fit();
                    xtermRef.current.refresh(0, xtermRef.current.rows - 1);
                    debouncedResize(
                      agent.id,
                      xtermRef.current.cols,
                      xtermRef.current.rows,
                    );
                  }
                }
              }, 300);
            }
          }, 10);
        }
      }
    };

    // Expose theme and opacity update methods via ref
    React.useImperativeHandle(ref, () => ({
      updateTheme: (themeName: string) => {
        handleThemeChange(themeName);
      },
      updateOpacity: (newOpacity: number) => {
        setOpacity(newOpacity);
      },
      updateFontSize: (newFontSize: number) => {
        if (xtermRef.current) {
          xtermRef.current.options.fontSize = newFontSize;
          // Don't update global font size if this terminal has a specific size
          if (!initialFontSize) {
            useSettingsStore.getState().updateSettings({ terminalDefaultFontSize: newFontSize });
          }
          // Refit terminal after font size change and send new dimensions to backend
          setTimeout(() => {
            if (fitAddonRef.current && xtermRef.current) {
              fitAddonRef.current.fit();

              // Use the debounced resize handler to send new dimensions to backend PTY
              // This prevents corrupted text when font size changes
              debouncedResize(
                agent.id,
                xtermRef.current.cols,
                xtermRef.current.rows,
              );
            }
          }, 100);
        }
      },
      updateFontFamily: (newFontFamily: string) => {
        if (xtermRef.current && fitAddonRef.current) {
          xtermRef.current.options.fontFamily = newFontFamily;

          // Refresh and refit terminal after font family change
          setTimeout(() => {
            if (xtermRef.current && fitAddonRef.current) {
              // Refresh the terminal content to redraw with new font
              xtermRef.current.refresh(0, xtermRef.current.rows - 1);

              // Refit to adjust dimensions
              fitAddonRef.current.fit();

              // Send new dimensions to backend PTY
              debouncedResize(
                agent.id,
                xtermRef.current.cols,
                xtermRef.current.rows,
              );
            }
          }, 100);
        }
      },
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
    }));

    return (
      <div
        className={`terminal-container glass terminal-${agent.terminalType} ${themeClassName} ${embedded ? "embedded" : ""} ${isMaximized ? "maximized" : ""} ${isTUITool ? "terminal-tui-tool" : ""} ${isPyRadio ? "terminal-pyradio" : ""}`}
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
              {canvasZoom && Math.abs(canvasZoom - 1) > 0.01 && (
                <span
                  className="terminal-zoom-warning"
                  title="Terminal mouse clicks work best at 100% zoom. Press Ctrl+0 to reset zoom."
                  style={{
                    color: '#fbbf24',
                    marginLeft: '8px',
                    fontSize: '0.9em',
                    opacity: 0.8
                  }}
                >
                  ⚠️ {Math.round(canvasZoom * 100)}%
                </span>
              )}
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
