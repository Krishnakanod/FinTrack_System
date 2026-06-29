"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  useWebSocketStore,
  type GroupTransactionPayload,
} from "@/lib/store/websocket-store";

function isGroupTransactionPayload(
  payload: unknown,
): payload is GroupTransactionPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.group_id === "string" &&
    typeof p.transaction_id === "string" &&
    typeof p.description === "string" &&
    typeof p.amount === "number" &&
    typeof p.actor_name === "string"
  );
}

export function WebSocketEventListener() {
  const queryClient = useQueryClient();
  const lastEvent = useWebSocketStore((s) => s.lastEvent);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "GROUP_TRANSACTION") {
      const payload = lastEvent.payload;
      if (!isGroupTransactionPayload(payload)) return;

      // Invalidate affected queries so other users see live updates
      queryClient.invalidateQueries({
        queryKey: ["groups", payload.group_id, "transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["balances"] });

      // Show real-time toast
      toast.message(
        `${payload.actor_name} added ₹${payload.amount.toFixed(2)} — ${payload.description}`,
        {
          description: "New group transaction",
        },
      );
    }

    if (lastEvent.type === "NOTIFICATION") {
      // Invalidate notifications to update unread count in header
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      // Show toast for budget alerts
      if (lastEvent.payload && typeof lastEvent.payload === "object") {
        const payload = lastEvent.payload as Record<string, unknown>;
        if (payload.type === "budget_alert") {
          toast.info(payload.title as string, {
            description: payload.body as string,
          });
        }
      }
    }
  }, [lastEvent, queryClient]);

  return null;
}
