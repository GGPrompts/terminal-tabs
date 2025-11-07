import React from "react";
import "./MemoryMonitor.css";

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  activeConnections: number;
  terminals: number;
}

interface MemoryMonitorProps {
  memoryStats: MemoryStats;
}

export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({ memoryStats }) => {

  const usagePercent = memoryStats.heapTotal > 0
    ? Math.round((memoryStats.heapUsed / memoryStats.heapTotal) * 100)
    : 0;

  const getMemoryColor = (percent: number) => {
    if (percent < 75) return "#22c55e"; // Green - V8 heap usage below 75% is healthy
    if (percent < 90) return "#eab308"; // Yellow - Getting full but normal
    return "#ef4444"; // Red - Actually concerning, heap might grow
  };

  return (
    <div className="memory-monitor" data-tooltip={`Backend Memory\nHeap: ${memoryStats.heapUsed}MB / ${memoryStats.heapTotal}MB\nRSS: ${memoryStats.rss}MB\nConnections: ${memoryStats.activeConnections}\nTerminals: ${memoryStats.terminals}`}>
      {/* Memory Bar */}
      <div className="memory-bar-container">
        <div
          className="memory-bar-fill"
          style={{
            width: `${usagePercent}%`,
            backgroundColor: getMemoryColor(usagePercent),
          }}
        />
      </div>

      {/* Memory Text */}
      <div className="memory-text">
        <span className="memory-value">{memoryStats.heapUsed}MB</span>
        <span className="memory-separator">/</span>
        <span className="memory-total">{memoryStats.heapTotal}MB</span>
      </div>
    </div>
  );
};
