"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateIST } from "@/lib/utils/format-date";
import type { Expense } from "@/lib/api/expenses";
import type { Income } from "@/lib/api/income";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getRelativeTimeLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Use IST midnight boundaries for "today" / "yesterday"
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const istNow = new Date(now.getTime() + istOffsetMs);

  const dateDay = new Date(istDate.toISOString().split("T")[0]).getTime();
  const nowDay = new Date(istNow.toISOString().split("T")[0]).getTime();
  const diffDays = Math.floor((nowDay - dateDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "(Today)";
  if (diffDays === 1) return "(Yesterday)";
  if (diffDays > 1 && diffDays <= 7) return `(${diffDays} days ago)`;
  return "";
}

interface TransactionDetailModalProps {
  transaction: Expense | Income | null;
  type: "expense" | "income";
  friendName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailModal({
  transaction,
  type,
  friendName,
  open,
  onOpenChange,
}: TransactionDetailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={type === "income" ? "default" : "secondary"}>
              {type === "income" ? "Income" : "Expense"}
            </Badge>
            {transaction ? (transaction as Expense).category || (transaction as Income).source_type : ""}
          </DialogTitle>
          <DialogDescription>Transaction details</DialogDescription>
        </DialogHeader>
        {transaction && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Amount</span>
              <span className="text-2xl font-bold">
                {formatCurrency(transaction.amount)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Date</span>
              <span>
                {formatDateIST(transaction.date, "date")}{" "}
                <span className="text-zinc-400">
                  {getRelativeTimeLabel(transaction.date)}
                </span>
              </span>
            </div>

            {type === "expense" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Category</span>
                  <span>{(transaction as Expense).category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Payment Type</span>
                  <span>{transaction.payment_type}</span>
                </div>
                {(transaction as Expense).paid_to_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Paid To / Source Name</span>
                    <span className="font-medium">{(transaction as Expense).paid_to_name}</span>
                  </div>
                )}
              </>
            )}

            {type === "income" && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Source Type</span>
                  <span>
                    {(transaction as Income).source_type === "salary"
                      ? "Salary"
                      : `From Friend${friendName ? ` (${friendName})` : ""}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Payment Type</span>
                  <span>{transaction.payment_type}</span>
                </div>
              </>
            )}

            {transaction.description && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-zinc-500">Description</span>
                <span className="text-sm">{transaction.description}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500">Added on</span>
              <span className="text-sm">
                {formatDateIST(transaction.created_at, "datetime")}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
