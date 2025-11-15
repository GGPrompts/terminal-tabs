import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSimpleWebSocketOptions {
  url: string;
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
}

export function useSimpleWebSocket(options: UseSimpleWebSocketOptions) {
  const { url, onMessage, onOpen, onClose, onError } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Use refs for callbacks to prevent reconnections when they change
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      // CRITICAL: Set wsRef BEFORE attaching event handlers
      // This ensures send() can access the socket in onOpen callbacks
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected to', url);
        setConnected(true);
        setReconnectAttempt(0);
        // Small delay to ensure WebSocket is fully ready
        setTimeout(() => {
          onOpenRef.current?.();
        }, 50);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected from', url);
        setConnected(false);
        onCloseRef.current?.();

        // Attempt to reconnect after 2 seconds
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
        }, 2000);
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        onErrorRef.current?.(event);
      };

      ws.onmessage = (event) => {
        onMessageRef.current?.(event);
      };
    } catch (err) {
      console.error('[WebSocket] Failed to connect:', err);
    }
  }, [url]);

  useEffect(() => {
    // Only connect if we don't already have an active connection
    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
      connect();
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Reconnect on reconnectAttempt change
  useEffect(() => {
    if (reconnectAttempt > 0 && !connected) {
      console.log(`[WebSocket] Reconnect attempt #${reconnectAttempt}`);
      connect();
    }
  }, [reconnectAttempt, connected, connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }
  }, []);

  return {
    ws: wsRef.current,
    connected,
    send,
    disconnect
  };
}
