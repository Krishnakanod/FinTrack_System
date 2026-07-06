"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = "From Date",
  toLabel = "To Date",
}: DateRangePickerProps) {
  const [clearedHint, setClearedHint] = useState<string | null>(null);

  const handleFromChange = (value: string) => {
    if (to && value && value > to) {
      onToChange("");
      setClearedHint("Please select an end date.");
    }
    onFromChange(value);
  };

  const handleToChange = (value: string) => {
    setClearedHint(null);
    onToChange(value);
  };

  const isInvalid = Boolean(from && to && from > to);
  const toError = isInvalid
    ? "End date must be after the start date."
    : clearedHint;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="date-from">{fromLabel}</Label>
          <Input
            id="date-from"
            type="date"
            value={from}
            onChange={(e) => handleFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date-to">{toLabel}</Label>
          <Input
            id="date-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => handleToChange(e.target.value)}
          />
        </div>
      </div>
      {toError && <p className="text-sm text-red-500">{toError}</p>}
    </div>
  );
}

export function isDateRangeValid(from: string, to: string): boolean {
  if (!from || !to) return true;
  return from <= to;
}
