import React, { useState, useEffect, useRef } from "react";
import { wsActivityTracker } from "../utils/websocketMonitor";
import "./WebSocketMonitor.css";

interface WebSocketMonitorProps {
  status: "connected" | "disconnected" | "connecting";
  ws?: WebSocket | null;
}

export const WebSocketMonitor: React.FC<WebSocketMonitorProps> = ({
  status,
  ws,
}) => {
  const [activityBars, setActivityBars] = useState<number[]>(
    Array(16).fill(10),
  );
  const animationRef = useRef<number>();
  const messageCountRef = useRef(0);
  const lastActivityRef = useRef(Date.now());

  // Subscribe to global WebSocket activity
  useEffect(() => {
    const unsubscribe = wsActivityTracker.subscribe((type) => {
      triggerActivity(type);
    });

    // Start animation loop
    startAnimation();

    return () => {
      unsubscribe();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const triggerActivity = (type: "inbound" | "outbound") => {
    messageCountRef.current++;
    lastActivityRef.current = Date.now();

    // Create a wave effect in the bars
    setActivityBars((prev) => {
      const newBars = [...prev];

      if (type === "inbound") {
        // Inbound: pulse from left to right
        for (let i = 0; i < newBars.length; i++) {
          const distance = i;
          const intensity = Math.max(0, 80 - distance * 10);
          // Set to intensity, don't add to existing
          if (intensity > newBars[i]) {
            newBars[i] = Math.min(90, intensity);
          }
        }
      } else {
        // Outbound: pulse from right to left
        for (let i = newBars.length - 1; i >= 0; i--) {
          const distance = newBars.length - 1 - i;
          const intensity = Math.max(0, 80 - distance * 10);
          // Set to intensity, don't add to existing
          if (intensity > newBars[i]) {
            newBars[i] = Math.min(90, intensity);
          }
        }
      }

      return newBars;
    });
  };

  const startAnimation = () => {
    let frameCount = 0;

    const animate = () => {
      frameCount++;

      // Only update every 2 frames for smoother animation
      if (frameCount % 2 === 0) {
        const now = Date.now();
        const timeSinceActivity = now - lastActivityRef.current;

        // Decay bars gradually
        setActivityBars((prev) =>
          prev.map((bar) => {
            // Much faster decay for better visual effect
            const decayRate = timeSinceActivity > 500 ? 0.7 : 0.85;
            const minHeight = 10;
            return Math.max(minHeight, bar * decayRate);
          }),
        );
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="websocket-monitor" data-tooltip="WebSocket activity">
      {/* Activity Bars */}
      <div className="activity-bars">
        {activityBars.map((height, index) => (
          <div
            key={index}
            className={`activity-bar ${status}`}
            style={{
              height: `${height}%`,
              animationDelay: `${index * 0.02}s`,
            }}
          />
        ))}
      </div>

      {/* Connection Status */}
      <div className={`connection-status ${status}`}>
        <span className="status-dot" />
        <span className="status-text">
          {status === "connected" && "Backend Connected"}
          {status === "connecting" && "Connecting..."}
          {status === "disconnected" && "Backend Disconnected"}
        </span>
      </div>
    </div>
  );
};
