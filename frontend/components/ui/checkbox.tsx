import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label
        className={cn(
          "flex items-start gap-2 cursor-pointer",
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
          {...props}
        />
        {label && <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
