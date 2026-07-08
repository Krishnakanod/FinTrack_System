"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmModal as ConfirmModalComponent } from "@/components/ui/confirm-modal";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
}

interface ConfirmModalState extends ConfirmOptions {
  isOpen: boolean;
}

export function useConfirmModal() {
  const [state, setState] = useState<ConfirmModalState>({
    isOpen: false,
    message: "",
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, isOpen: true });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolverRef.current?.(true);
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  const ConfirmModal = useCallback(
    () => (
      <ConfirmModalComponent
        open={state.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        confirmVariant={state.confirmVariant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [state, handleConfirm, handleCancel],
  );

  return { confirm, ConfirmModal };
}
