"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "right" | "top" | "bottom" | "left";
}

export function Tooltip({
  children,
  content,
  side = "right",
}: TooltipProps) {
  return (
    <div className="group relative flex items-center justify-center">
      {children}
      <div
        className={cn(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-sm group-hover:block dark:bg-zinc-100 dark:text-zinc-900",
          side === "right" && "left-full ml-2",
          side === "top" && "bottom-full mb-2",
          side === "bottom" && "top-full mt-2",
          side === "left" && "right-full mr-2"
        )}
      >
        {content}
      </div>
    </div>
  );
}
