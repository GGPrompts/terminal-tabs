import { useEffect } from "react";
import { useCanvasStore } from "../stores/canvasStore";
import { Agent } from "../App";

/**
 * Hook to sync React state terminals with Zustand store
 * This provides a migration path from current implementation
 */
export const useTerminalSync = (agents: Agent[]) => {
  const { terminals, addTerminal, updateTerminal, removeTerminal } =
    useCanvasStore();

  useEffect(() => {
    // Sync agents to store
    agents.forEach((agent) => {
      const existingTerminal = terminals.get(agent.id);

      if (!existingTerminal) {
        // Add new terminal to store
        addTerminal({
          id: agent.id,
          name: agent.name,
          terminalType: agent.terminalType,
          position: agent.position || { x: 100, y: 100 },
          size: agent.size || { width: 800, height: 600 },
          isMaximized: false,
          isOn: true,
          agentId: agent.id,
          workingDir: agent.workingDir,
          sessionId: agent.sessionId,
        });
      } else {
        // Update existing terminal
        updateTerminal(agent.id, {
          position: agent.position,
          size: agent.size,
          isOn: true,
          agentId: agent.id,
        });
      }
    });

    // Remove terminals that no longer exist
    terminals.forEach((terminal, id) => {
      if (!agents.find((a) => a.id === id)) {
        removeTerminal(id);
      }
    });
  }, [agents]);

  return {
    terminals: Array.from(terminals.values()),
    terminalCount: terminals.size,
  };
};

/**
 * Hook to generate session data for Claude Code resumption
 */
export const useSessionExport = () => {
  const terminals = useCanvasStore((state) => state.terminals);

  const exportSessions = () => {
    const sessions = Array.from(terminals.values())
      .filter(
        (t) =>
          t.terminalType === "claude-code" || t.terminalType === "opencode",
      )
      .map((t) => ({
        id: t.sessionId || t.id,
        name: t.name,
        type: t.terminalType,
        workingDir: t.workingDir || "/workspace",
        lastActive: new Date(t.lastActiveAt).toISOString(),
        position: t.position,
        size: t.size,
        theme: t.theme,
      }));

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      sessions,
      metadata: {
        totalTerminals: terminals.size,
        aiTerminals: sessions.length,
      },
    };
  };

  const downloadSessions = () => {
    const data = exportSessions();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opustrator-sessions-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportSessions, downloadSessions };
};
