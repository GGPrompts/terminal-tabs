// Global WebSocket activity tracker
class WebSocketActivityTracker {
  private listeners: Set<(type: "inbound" | "outbound") => void> = new Set();
  private intercepted: WeakSet<WebSocket> = new WeakSet();

  subscribe(listener: (type: "inbound" | "outbound") => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(type: "inbound" | "outbound") {
    // Debug log - commented out to reduce console spam
    this.listeners.forEach((listener) => listener(type));
  }

  interceptWebSocket(ws: WebSocket) {
    // Don't intercept the same WebSocket twice
    if (this.intercepted.has(ws)) return;
    this.intercepted.add(ws);

    // Store original send
    const originalSend = ws.send.bind(ws);

    // Override send to track outbound
    ws.send = function (
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ) {
      originalSend.call(this, data);
      wsActivityTracker.notify("outbound");
    };

    // Listen for incoming messages
    ws.addEventListener("message", () => {
      this.notify("inbound");
    });
  }
}

// Global singleton instance
export const wsActivityTracker = new WebSocketActivityTracker();

// Also intercept WebSocket constructor globally to auto-track all WebSockets
const OriginalWebSocket = window.WebSocket;
window.WebSocket = class extends OriginalWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);

    // Auto-intercept after a small delay to ensure connection is established
    setTimeout(() => {
      wsActivityTracker.interceptWebSocket(this);
    }, 0);
  }
} as any;
