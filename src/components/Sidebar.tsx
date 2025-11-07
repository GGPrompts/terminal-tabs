import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import "./Sidebar.css";
import { Agent, TERMINAL_TYPES, AGENT_TYPES, UTILITY_TYPES } from "../App";
import { CardData } from "./DraggableCard";
import { LayoutManager } from "./LayoutManager";
import { EnhancedFileViewer } from "./EnhancedFileViewer";
import { DirectorySelector } from "./DirectorySelector";
import { useTerminalsMap, useCanvasStore } from "../stores/canvasStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useUIStore } from "../stores/useUIStore";
import { useTerminalSpawn } from "../hooks/useTerminalSpawn";
import { TerminalTemplateViewer } from "./TerminalTemplateViewer";

interface SidebarProps {
  isOpen: boolean;
  onSpawn: (config: any) => void;
  agents: Agent[];
  onCloseAgent: (id: string) => void;
  onCreateCard?: (cardData?: Partial<CardData>) => void;
  cards?: CardData[];
  onPanToTerminal?: (terminalId: string, isNewSpawn?: boolean) => void;
  onPanToCard?: (cardId: string) => void;
  wsRef?: React.MutableRefObject<WebSocket | null>;
}

// Helper to format paths with ~ for home directory
const formatPath = (path: string): string => {
  const homeDir = '/home/matt';
  if (path === homeDir) return '~';
  if (path.startsWith(homeDir + '/')) {
    return '~' + path.slice(homeDir.length);
  }
  return path;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onSpawn,
  agents,
  onCloseAgent,
  onCreateCard,
  cards = [],
  onPanToTerminal,
  onPanToCard,
  wsRef,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [originalWidth, setOriginalWidth] = useState(360); // Width before file viewing
  const [viewingWidth, setViewingWidth] = useState(() => {
    // Load preferred viewing width from localStorage or default to 800
    const saved = localStorage.getItem('sidebar-viewing-width');
    return saved ? parseInt(saved, 10) : 800;
  });
  const [isViewingFile, setIsViewingFile] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const panToTerminalRef = useRef<SidebarProps['onPanToTerminal']>(onPanToTerminal);
  const agentsRef = useRef(agents);

  useEffect(() => {
    panToTerminalRef.current = onPanToTerminal;
  }, [onPanToTerminal]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // Save viewing width preference when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-viewing-width', viewingWidth.toString());
  }, [viewingWidth]);

  // Use persisted UI state
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const activeTab = useUIStore((state) => state.sidebarTab) as
    | "activity"
    | "files"
    | "cards";
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const setActiveTab = useUIStore((state) => state.setSidebarTab);
  const [selectedDirectory, setSelectedDirectory] = useState(
    "/home/matt/workspace",
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const { spawnFromTemplate } = useTerminalSpawn(wsRef);

  // Helper to spawn terminal and center on it after a delay
  const spawnAndCenter = async (templatePath: string) => {
    const terminalName = await spawnFromTemplate(templatePath, {
      workingDir: selectedDirectory  // Pass the selected launch directory
    });

    if (terminalName) {
      const targetName = terminalName.toLowerCase();

      const attemptPan = (attempt: number) => {
        const panFn = panToTerminalRef.current;
        if (!panFn) return;

        const currentAgents = agentsRef.current;
        const match = currentAgents.find(agent => agent.name?.toLowerCase() === targetName);

        if (match) {
          panFn(match.id, true);
          setTimeout(() => panToTerminalRef.current?.(match.id, true), 1000);
          return;
        }

        if (attempt < 5) {
          setTimeout(() => attemptPan(attempt + 1), 200);
        }
      };

      setTimeout(() => attemptPan(0), 400);
    }

    return terminalName;
  };

  // Handle file viewing width changes
  const handleFileViewOpen = useCallback(() => {
    if (!isViewingFile) {
      setOriginalWidth(sidebarWidth);
      setIsViewingFile(true);
      // First time viewing - expand to max, otherwise use last viewing width
      const targetWidth = viewingWidth || 800;
      setSidebarWidth(targetWidth);
    }
  }, [isViewingFile, sidebarWidth, viewingWidth]);

  const handleFileViewClose = useCallback(() => {
    if (isViewingFile) {
      // Save the current width as the preferred viewing width for next time
      setViewingWidth(sidebarWidth);
      setIsViewingFile(false);
      // Restore original width
      setSidebarWidth(originalWidth);
    }
  }, [isViewingFile, sidebarWidth, originalWidth]);

  // Handle sidebar resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to canvas
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      e.preventDefault();
      e.stopPropagation(); // Prevent canvas from receiving mouse events during resize

      const newWidth = e.clientX;
      if (newWidth >= 280 && newWidth <= 1200) {  // Increased from 800 to 1200 for ultrawide screens
        setSidebarWidth(newWidth);
        // If resizing while viewing a file, update the viewing width preference
        if (isViewingFile) {
          setViewingWidth(newWidth);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(false);
      // Clean up cursor styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, true); // Use capture phase
      document.addEventListener('mouseup', handleMouseUp, true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      if (!isResizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [isResizing, isViewingFile, setViewingWidth]);
  const [showDirSelector, setShowDirSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    terminalType: "claude-code",
    platform: "local",
    workingDir: "/home/matt/workspace",
  });

  // Get offline terminals from Zustand store
  const terminalsMap = useTerminalsMap();
  const addWidget = useCanvasStore((s) => s.addWidget);
  const cardCategories = useCanvasStore((s) => s.cardCategories);
  const updateCardCategory = useCanvasStore((s) => s.updateCardCategory);
  const removeTerminal = useCanvasStore((s) => s.removeTerminal);
  const offlineTerminals = useMemo(
    () => {
      // Get all offline terminals from the store
      const offline = Array.from(terminalsMap.values()).filter((t) => !t.isOn);

      // Filter out any offline terminals that are already connected to an online agent
      // This prevents duplicates when a terminal has reconnected but the store hasn't updated yet
      const onlineAgentIds = new Set(agents.map(a => a.id));
      const onlineNames = new Set(agents.map(a => a.name));

      const filtered = offline.filter(t => {
        // If this offline terminal's lastAgentId matches any online agent, skip it
        if (t.lastAgentId && onlineAgentIds.has(t.lastAgentId)) {
          return false;
        }
        // If this offline terminal's agentId matches any online agent, skip it
        if (t.agentId && onlineAgentIds.has(t.agentId)) {
          return false;
        }
        // Check if there's an online terminal with the exact same name
        if (onlineNames.has(t.name)) {
          return false;
        }
        // Also check if the offline terminal name is a substring of any online terminal
        // This handles cases where online terminal got extra OPUST tags appended
        const hasOnlineVersion = agents.some(a => {
          // If online name starts with offline name, they're the same terminal
          return a.name.startsWith(t.name) || t.name.startsWith(a.name);
        });
        if (hasOnlineVersion) {
          return false;
        }
        return true;
      });

      return filtered;
    },
    [terminalsMap, agents],
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [categoryEditName, setCategoryEditName] = useState("");
  const [categoryEditColor, setCategoryEditColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const workingDirectory = useSettingsStore((s) => s.workingDirectory);

  useEffect(() => {
    // Initialize from settings store
    if (workingDirectory && typeof workingDirectory === "string") {
      setSelectedDirectory(workingDirectory);
      setFormData((fd) => ({ ...fd, workingDir: workingDirectory }));
    }
  }, [workingDirectory]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please enter a name for the agent");
      return;
    }

    const terminalInfo = TERMINAL_TYPES.find(
      (t) => t.value === formData.terminalType,
    );

    onSpawn({
      ...formData,
      name: formData.name.trim(),
      color: terminalInfo?.color,
      icon: terminalInfo?.icon,
    });

    // Reset form
    setFormData({ ...formData, name: "" });
  };


  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${sidebarOpen ? "open" : "closed"}`}
      style={{
        width: `${sidebarWidth}px`,
        transition: isResizing ? 'none' : 'width 0.3s ease',
      }}
    >
      {/* Resize handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: '-3px',
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          background: 'transparent',
          zIndex: 100001,
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '2px',
            top: 0,
            bottom: 0,
            width: '2px',
            background: isResizing ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        />
      </div>

      <div className="sidebar-header">
          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
              onClick={() => setActiveTab("activity")}
              title="Activity & Layouts"
            >
              📊
            </button>
            <button
              className={`tab-btn ${activeTab === "files" ? "active" : ""}`}
              onClick={() => setActiveTab("files")}
              title="File Explorer"
            >
              📁
            </button>
            <button
              className={`tab-btn ${activeTab === "cards" ? "active" : ""}`}
              onClick={() => setActiveTab("cards")}
              title="Cards & Notes"
            >
              🗒️
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          {activeTab === "activity" && (
            <div className="sidebar-section" style={{ padding: "12px" }}>
              <h2 className="section-title">📊 Activity Overview</h2>

              {/* Terminals Section - Active and Offline */}
              <div style={{ marginBottom: "20px" }}>
                <h3 className="subsection-title" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#93c5fd",
                }}>
                  <span>⚡</span>
                  <span>Terminals</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", opacity: 0.7 }}>
                    {agents.length + offlineTerminals.length}
                  </span>
                </h3>
                <div style={{ paddingLeft: "8px" }}>
                  {agents.length === 0 && offlineTerminals.length === 0 ? (
                    <div className="empty-message" style={{ fontSize: "12px", color: "#64748b" }}>
                      No terminals
                    </div>
                  ) : (
                    <>
                      {/* Active/Online Terminals */}
                      {agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="activity-item"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 8px",
                            marginBottom: "4px",
                            borderRadius: "4px",
                            background: "rgba(59, 130, 246, 0.05)",
                            border: "1px solid rgba(59, 130, 246, 0.1)",
                            cursor: "pointer",
                            fontSize: "12px",
                            transition: "all 0.2s",
                          }}
                          onClick={(e) => {
                            if (!(e.target as HTMLElement).closest('button')) {
                              onPanToTerminal?.(agent.id);
                            }
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                            e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                            e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.1)";
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>{agent.icon || "⚡"}</span>
                          <span style={{ flex: 1, color: "#e2e8f0" }}>{agent.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (wsRef?.current?.readyState === WebSocket.OPEN) {
                                wsRef.current.send(
                                  JSON.stringify({
                                    type: 'close',
                                    terminalId: agent.id,
                                  }),
                                );
                              }
                            }}
                            title="Close terminal"
                            style={{
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "3px",
                              padding: "1px 5px",
                              marginRight: "4px",
                              fontSize: "11px",
                              cursor: "pointer",
                              color: "#ef4444",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                            }}
                          >
                            ✕
                          </button>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#22c55e",
                            padding: "2px 6px",
                            background: "rgba(34, 197, 94, 0.15)",
                            borderRadius: "3px",
                          }}>
                            online
                          </span>
                        </div>
                      ))}

                      {/* Offline Terminals */}
                      {offlineTerminals.map((terminal) => {
                        const terminalInfo = TERMINAL_TYPES.find(
                          (t) => t.value === terminal.terminalType,
                        );
                        // Map TUI tool names to their icons
                        const tuiIcons: Record<string, string> = {
                          "file-manager": "📁",
                          mc: "📁",
                          lazygit: "🔀",
                          bottom: "📊",
                          calcure: "📅",
                          lnav: "📜",
                          aichat: "🤖",
                          micro: "📝",
                          spotify: "🎵",
                          "htop-btop": "📊",
                        };
                        const icon =
                          terminal.terminalType === "tui-tool" && terminal.startCommand
                            ? tuiIcons[terminal.startCommand.split(" ")[0]] || "🔧"
                            : terminalInfo?.icon || "💻";

                        return (
                          <div
                            key={terminal.id}
                            className="activity-item"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "6px 8px",
                              marginBottom: "4px",
                              borderRadius: "4px",
                              background: "rgba(100, 116, 139, 0.05)",
                              border: "1px solid rgba(100, 116, 139, 0.1)",
                              cursor: "pointer",
                              fontSize: "12px",
                              transition: "all 0.2s",
                              opacity: 0.7,
                            }}
                            onClick={(e) => {
                              if (!(e.target as HTMLElement).closest('button')) {
                                onPanToTerminal?.(terminal.id);
                              }
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(100, 116, 139, 0.1)";
                              e.currentTarget.style.borderColor = "rgba(100, 116, 139, 0.2)";
                              e.currentTarget.style.opacity = "1";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(100, 116, 139, 0.05)";
                              e.currentTarget.style.borderColor = "rgba(100, 116, 139, 0.1)";
                              e.currentTarget.style.opacity = "0.7";
                            }}
                          >
                            <span style={{ fontSize: "14px" }}>{icon}</span>
                            <span style={{ flex: 1, color: "#94a3b8" }}>{terminal.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Delete the offline terminal
                                removeTerminal(terminal.id);
                              }}
                              title="Delete terminal"
                              style={{
                                background: "rgba(239, 68, 68, 0.2)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "3px",
                                padding: "1px 5px",
                                marginRight: "4px",
                                fontSize: "11px",
                                cursor: "pointer",
                                color: "#ef4444",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                              }}
                            >
                              ✕
                            </button>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: 500,
                              color: "#ef4444",
                              padding: "2px 6px",
                              background: "rgba(239, 68, 68, 0.15)",
                              borderRadius: "3px",
                            }}>
                              offline
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              {/* Open Files Section */}
              <div style={{ marginBottom: "20px" }}>
                <h3 className="subsection-title" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#86efac",
                }}>
                  <span>📁</span>
                  <span>Open Files</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", opacity: 0.7 }}>
                    {cards.filter(c => c.backContent && !c.content?.startsWith("data:image")).length}
                  </span>
                </h3>
                <div style={{ paddingLeft: "8px" }}>
                  {cards.filter(c => c.backContent && !c.content?.startsWith("data:image")).length === 0 ? (
                    <div className="empty-message" style={{ fontSize: "12px", color: "#64748b" }}>
                      No files open
                    </div>
                  ) : (
                    cards.filter(c => c.backContent && !c.content?.startsWith("data:image")).map((card) => (
                      <div
                        key={card.id}
                        className="activity-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          marginBottom: "4px",
                          borderRadius: "4px",
                          background: "rgba(34, 197, 94, 0.05)",
                          border: "1px solid rgba(34, 197, 94, 0.1)",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s",
                        }}
                        onClick={() => onPanToCard?.(card.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(34, 197, 94, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(34, 197, 94, 0.05)";
                          e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.1)";
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>📄</span>
                        <span style={{ flex: 1, color: "#e2e8f0" }}>{card.title}</span>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>
                          {card.backContent?.split('/').pop()?.split('.').pop()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Notes Section */}
              <div style={{ marginBottom: "20px" }}>
                <h3 className="subsection-title" style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#fde047",
                }}>
                  <span>📝</span>
                  <span>Quick Notes</span>
                  <span style={{ marginLeft: "auto", fontSize: "11px", opacity: 0.7 }}>
                    {cards.filter(c => !c.backContent || c.content?.startsWith("data:image")).length}
                  </span>
                </h3>
                <div style={{ paddingLeft: "8px" }}>
                  {cards.filter(c => !c.backContent || c.content?.startsWith("data:image")).length === 0 ? (
                    <div className="empty-message" style={{ fontSize: "12px", color: "#64748b" }}>
                      No notes created
                    </div>
                  ) : (
                    cards.filter(c => !c.backContent || c.content?.startsWith("data:image")).map((card) => (
                      <div
                        key={card.id}
                        className="activity-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 8px",
                          marginBottom: "4px",
                          borderRadius: "4px",
                          background: "rgba(251, 191, 36, 0.05)",
                          border: "1px solid rgba(251, 191, 36, 0.1)",
                          cursor: "pointer",
                          fontSize: "12px",
                          transition: "all 0.2s",
                        }}
                        onClick={() => onPanToCard?.(card.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(251, 191, 36, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(251, 191, 36, 0.05)";
                          e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.1)";
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>🗒️</span>
                        <span style={{ flex: 1, color: "#e2e8f0" }}>{card.title}</span>
                        <span style={{
                          fontSize: "10px",
                          color: "#64748b",
                          padding: "1px 4px",
                          background: "rgba(255, 255, 255, 0.05)",
                          borderRadius: "2px",
                        }}>
                          {card.variant}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Layout Management Section */}
              <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "16px" }}>
                <LayoutManager
                  agents={agents}
                  wsRef={wsRef}
                />
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div
              className="sidebar-section"
              style={{
                padding: 0,
                height: "calc(100% - 10px)",
                overflow: "hidden",
                position: "relative"
              }}
            >
              {selectedTemplate ? (
                <TerminalTemplateViewer
                  templatePath={selectedTemplate}
                  wsRef={wsRef}
                  onClose={() => setSelectedTemplate(null)}
                />
              ) : (
                <EnhancedFileViewer
                  wsRef={wsRef}
                  onFileSelect={async (path, content, isImage) => {
                    // Only create cards when content is explicitly provided
                    // (from "Send to Canvas" action, not from left-click viewing)
                    if (!content && !isImage) {
                      // No content = just a path reference, don't create cards
                      return;
                    }

                    if (isImage && content) {
                    // Add image card with base64 data
                    onCreateCard?.({
                      title: path,
                      content: content, // Base64 data URI
                      backContent: path, // Store path in backContent
                      variant: "info",
                    });
                  } else {
                    // Check if it's a markdown file
                    const ext = path.split(".").pop()?.toLowerCase();
                    const isMarkdownFile = ext === "md" || ext === "markdown";

                    if (isMarkdownFile) {
                      // If content is already provided, use it directly
                      if (content) {
                        // Content already fetched by EnhancedFileViewer
                        onCreateCard?.({
                          title: path.split("/").pop() || "Markdown",
                          content: content,
                          backContent: path, // Store the file path
                          variant: "info",
                          editable: true,
                          isMarkdown: true, // Flag this as markdown
                        });
                      } else {
                        // Fetch the markdown content if not provided
                        try {
                          const response = await fetch(
                            `/api/files/content?${new URLSearchParams({ path })}`,
                          );
                          if (response.ok) {
                            const data = await response.json();
                            // Add markdown card with proper content
                            onCreateCard?.({
                              title: path.split("/").pop() || "Markdown",
                              content: data.content,
                              backContent: path, // Store the file path
                              variant: "info",
                              editable: true,
                              isMarkdown: true, // Flag this as markdown
                            });
                          }
                        } catch (error) {
                          console.error("Failed to fetch markdown file:", error);
                        }
                      }
                    } else {
                      // Add file viewer card for other files
                      // If content is provided for non-markdown files, include it
                      onCreateCard?.({
                        title: path.split("/").pop() || path,
                        content: content || "",
                        backContent: path, // Store the file path in backContent
                        variant: "info",
                      });
                    }
                  }
                }}
              />
              )}
            </div>
          )}

          {/* Directory selector modal */}
          {showDirSelector && (
            <DirectorySelector
              isOpen={showDirSelector}
              currentPath={selectedDirectory}
              onSelect={(path) => {
                setSelectedDirectory(path);
                setFormData((fd) => ({ ...fd, workingDir: path }));
                try {
                  updateSettings({ workingDirectory: path });
                } catch {}
              }}
              onClose={() => setShowDirSelector(false)}
            />
          )}



          {activeTab === "cards" && (
            <div className="sidebar-section">
              <h2 className="section-title">📝 Cards & Quick Notes</h2>

              <div className="card-creator">
                <h3 className="subsection-title">Quick Cards</h3>
                <div className="card-variants">
                  {cardCategories.map((category) => (
                    <button
                      key={category.id}
                      className={`card-variant-btn card-variant-${category.variant}`}
                      onClick={() => {
                        // Clear any existing timeout
                        if (clickTimeout) {
                          clearTimeout(clickTimeout);
                          setClickTimeout(null);
                          // This was a double-click - edit the category
                          setEditingCategoryId(category.id);
                          setCategoryEditName(category.name);
                        } else {
                          // Set a timeout for single click
                          const timeout = setTimeout(() => {
                            // Single click - create a card
                            onCreateCard?.({
                              title: `New ${category.name} Note`,
                              content: "",
                              variant: category.variant,
                              category: category.id,
                              editable: true,
                            });
                            setClickTimeout(null);
                          }, 250); // 250ms delay to detect double-click
                          setClickTimeout(timeout);
                        }
                      }}
                      title={`Create ${category.name} Card (double-click to rename)`}
                    >
                      <span
                        className="color-dot"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showColorPicker === category.id) {
                            setShowColorPicker(null);
                          } else {
                            setShowColorPicker(category.id);
                            setCategoryEditColor(category.color);
                          }
                        }}
                        title="Click to change color"
                        style={{
                          background: category.color.includes("gradient")
                            ? category.color
                            : undefined,
                          backgroundColor: !category.color.includes("gradient")
                            ? category.color
                            : undefined,
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        {showColorPicker === category.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '25px',
                              left: '0',
                              zIndex: 1000,
                              background: 'rgba(30, 30, 30, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '8px',
                              padding: '10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px',
                              minWidth: '200px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="color"
                              value={categoryEditColor.includes('gradient') ? '#6b7280' : categoryEditColor}
                              onChange={(e) => {
                                const newColor = e.target.value;
                                setCategoryEditColor(newColor);
                                updateCardCategory(category.id, { color: newColor });
                              }}
                              style={{
                                width: '100%',
                                height: '30px',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            />
                            <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
                              Preset Colors:
                            </div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {[
                                '#6b7280', // gray
                                '#3b82f6', // blue
                                '#10b981', // green
                                '#f59e0b', // orange
                                '#ef4444', // red
                                '#06b6d4', // cyan
                                '#8b5cf6', // purple
                                '#ec4899', // pink
                                '#14b8a6', // teal
                                '#f97316', // amber
                              ].map(color => (
                                <button
                                  key={color}
                                  onClick={() => {
                                    setCategoryEditColor(color);
                                    updateCardCategory(category.id, { color });
                                  }}
                                  style={{
                                    width: '25px',
                                    height: '25px',
                                    background: color,
                                    border: categoryEditColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                  }}
                                />
                              ))}
                            </div>
                            {category.variant === 'glow' && (
                              <button
                                onClick={() => {
                                  const gradient = 'linear-gradient(135deg, #667eea, #764ba2)';
                                  setCategoryEditColor(gradient);
                                  updateCardCategory(category.id, { color: gradient });
                                }}
                                style={{
                                  marginTop: '5px',
                                  padding: '5px',
                                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                }}
                              >
                                Use Gradient
                              </button>
                            )}
                          </div>
                        )}
                      </span>
                      {editingCategoryId === category.id ? (
                        <input
                          type="text"
                          value={categoryEditName}
                          onChange={(e) => setCategoryEditName(e.target.value)}
                          onBlur={() => {
                            if (categoryEditName.trim()) {
                              updateCardCategory(category.id, {
                                name: categoryEditName.trim(),
                              });
                            }
                            setEditingCategoryId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (categoryEditName.trim()) {
                                updateCardCategory(category.id, {
                                  name: categoryEditName.trim(),
                                });
                              }
                              setEditingCategoryId(null);
                            } else if (e.key === "Escape") {
                              setEditingCategoryId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "4px",
                            color: "#fff",
                            padding: "2px 6px",
                            width: "80px",
                            fontSize: "12px",
                          }}
                          autoFocus
                        />
                      ) : (
                        category.name
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: "10px", width: "100%" }}
                  onClick={() =>
                    onCreateCard?.({
                      title: "Quick Note",
                      content: "",
                      variant: "purple",
                      editable: true,
                    })
                  }
                >
                  + Quick Note
                </button>
              </div>

              <div className="cards-list" style={{ marginTop: "20px" }}>
                <h3 className="subsection-title">
                  Active Cards ({cards.length})
                </h3>
                {cards.length === 0 ? (
                  <p className="empty-message">No cards created yet</p>
                ) : (
                  <div className="cards-list-items">
                    {cards.map((card) => (
                      <div key={card.id} className="card-list-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="card-list-indicator"
                          style={{
                            background:
                              card.variant === "glow"
                                ? "linear-gradient(135deg, #667eea, #764ba2)"
                                : card.variant === "prompt"
                                  ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                                  : card.variant === "primary"
                                    ? "#3b82f6"
                                    : card.variant === "success"
                                      ? "#10b981"
                                      : card.variant === "warning"
                                        ? "#f59e0b"
                                        : card.variant === "danger"
                                          ? "#ef4444"
                                          : card.variant === "info"
                                            ? "#06b6d4"
                                            : card.variant === "purple"
                                              ? "#8b5cf6"
                                              : "#6b7280",
                          }}
                        ></span>
                        <span className="card-list-title" style={{ flex: 1 }}>{card.title}</span>
                        <button
                          className="agent-item-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPanToCard?.(card.id);
                          }}
                          title="Focus card on canvas"
                          style={{
                            background: "rgba(59, 130, 246, 0.2)",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            fontSize: "11px",
                            cursor: "pointer",
                            color: "#93c5fd",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                          }}
                        >
                          ⊹
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="version-info">
            <span>Opustrator v3.0.0</span>
            <span className="subtitle">Simplified & Explicit</span>
          </div>
        </div>
      </aside>
  );
};
