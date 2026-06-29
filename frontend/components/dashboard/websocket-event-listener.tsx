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
      // Notifications are handled by the notifications bell in Sprint 8.
      // For now, just ensure the balances and group data stay fresh.
      if (
        typeof lastEvent.payload === "object" &&
        lastEvent.payload !== null
      ) {
        const p = lastEvent.payload as Record<string, unknown>;
        const metadata = p.metadata as Record<string, string> | undefined;
        if (metadata?.group_id) {
          queryClient.invalidateQueries({
            queryKey: ["groups", metadata.group_id, "transactions"],
          });
          queryClient.invalidateQueries({ queryKey: ["balances"] });
        }
      }
    }
  }, [lastEvent, queryClient]);

  return null;
}
