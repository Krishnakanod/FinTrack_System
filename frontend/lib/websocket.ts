// WebSocket hook — real-time connection management
// Locked contract per Spec-06 §1.9
//
// Usage: call useWebSocket() in the dashboard layout.
// It connects automatically when isAuthenticated + userId are available,
// reconnects when the access token changes, and sends 30s heartbeat pings.

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useWebSocketStore } from "@/lib/store/websocket-store";
import type { WebSocketEvent } from "@/lib/store/websocket-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s per Spec-06 §1.9
const CLOSE_CODE_INVALID_TOKEN = 4000;
const CLOSE_CODE_USER_ID_MISMATCH = 4001;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setLastEvent = useWebSocketStore((s) => s.setLastEvent);
  const setConnectionStatus = useWebSocketStore((s) => s.setConnectionStatus);

  const cleanUp = useCallback(() => {
    // Clear heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    // Close existing WS
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.id || !accessToken) return;

    // Clean up any existing connection
    cleanUp();
    reconnectAttemptsRef.current = 0;

    setConnectionStatus("connecting");

    const wsUrl = `${WS_URL}/ws/${user.id}?token=${encodeURIComponent(accessToken)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;

      // Start 30s heartbeat
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        setLastEvent(data);
      } catch {
        // Ignore non-JSON messages (e.g., ping/pong responses)
      }
    };

    ws.onclose = (event) => {
      setConnectionStatus("disconnected");
      cleanUp();

      // Per Spec-06 §1.9: on close code 4000 or 4001, do NOT blindly
      // auto-reconnect with the same stale token. The API client's refresh
      // logic will update the accessToken in Zustand, which triggers
      // this hook's useEffect to reconnect with the fresh token.
      if (
        event.code === CLOSE_CODE_INVALID_TOKEN ||
        event.code === CLOSE_CODE_USER_ID_MISMATCH
      ) {
        return;
      }

      // Exponential backoff for reconnection (max ~32s)
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        32000,
      );
      reconnectAttemptsRef.current += 1;

      setTimeout(() => {
        if (isAuthenticated && user?.id && accessToken) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after this — no explicit handling needed
    };
  }, [isAuthenticated, user?.id, accessToken, cleanUp, setLastEvent, setConnectionStatus]);

  useEffect(() => {
    if (isAuthenticated && user?.id && accessToken) {
      connect();
    } else {
      cleanUp();
      setConnectionStatus("disconnected");
    }

    return () => {
      cleanUp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, accessToken]);
}