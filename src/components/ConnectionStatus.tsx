import React from "react";
import "./ConnectionStatus.css";

interface ConnectionStatusProps {
  status: "connected" | "disconnected" | "connecting";
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
}) => {
  return (
    <div className={`connection-status ${status}`}>
      <span className="status-dot" />
      <span className="status-text">
        {status === "connected" && "Connected"}
        {status === "connecting" && "Connecting..."}
        {status === "disconnected" && "Disconnected"}
      </span>
    </div>
  );
};
