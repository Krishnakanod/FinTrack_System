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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(false);

  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setLastEvent = useWebSocketStore((s) => s.setLastEvent);
  const setConnectionStatus = useWebSocketStore((s) => s.setConnectionStatus);

  // Read auth values from refs inside callbacks to avoid stale closures.
  const authRef = useRef({ isAuthenticated, user, accessToken });
  authRef.current = { isAuthenticated, user, accessToken };

  // Track component mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanUp = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const { isAuthenticated: auth, user: u, accessToken: token } = authRef.current;

    // Skip if not authenticated, no user ID, or already connecting
    if (!auth || !u?.id || !token || isConnectingRef.current) {
      console.log(`[WebSocket] Skipping connect: auth=${auth}, user=${u?.id}, connecting=${isConnectingRef.current}`);
      return;
    }

    // Don't connect if component unmounted
    if (!mountedRef.current) {
      console.log("[WebSocket] Component unmounted, skipping connect");
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus("connecting");

    const wsUrl = `${WS_URL}/ws/${u.id}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WebSocket] Connected for user ${u.id}`);
      isConnectingRef.current = false;
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;

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
      console.log(`[WebSocket] Closed with code ${event.code}`);
      isConnectingRef.current = false;
      setConnectionStatus("disconnected");

      // Clear heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      // Per Spec-06 §1.9: on close code 4000 or 4001, do NOT blindly
      // auto-reconnect with the same stale token.
      if (
        event.code === CLOSE_CODE_INVALID_TOKEN ||
        event.code === CLOSE_CODE_USER_ID_MISMATCH
      ) {
        console.log("[WebSocket] Not reconnecting: token invalid or user mismatch");
        return;
      }

      // Schedule reconnect with exponential backoff (max ~32s)
      reconnectAttemptsRef.current = Math.min(reconnectAttemptsRef.current + 1, 10);
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptsRef.current),
        32000,
      );

      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
      reconnectTimerRef.current = setTimeout(() => {
        const { isAuthenticated: a, user: u, accessToken: t } = authRef.current;
        if (a && u?.id && t && mountedRef.current) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      // Transient connection error — onclose fires next and schedules reconnect.
      // Using warn (not error) because a single failed attempt during the
      // silent-refresh window is expected and self-heals automatically.
      console.warn("[WebSocket] Connection error — will retry via onclose handler.");
    };
  }, [setLastEvent, setConnectionStatus]);

  useEffect(() => {
    if (isAuthenticated && user?.id && accessToken) {
      console.log(`[WebSocket] Initiating connection for user ${user.id}`);
      reconnectAttemptsRef.current = 0;
      connect();
    } else {
      console.log("[WebSocket] No auth or user ID, cleaning up");
      cleanUp();
      setConnectionStatus("disconnected");
    }

    return () => {
      console.log("[WebSocket] Cleaning up on unmount/token change");
      cleanUp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, accessToken, cleanUp, connect, setConnectionStatus]);
}
