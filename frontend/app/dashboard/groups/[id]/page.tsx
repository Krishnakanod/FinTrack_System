"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Scale,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDateIST } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  getGroup,
  listGroupTransactions,
  addTransaction,
  updateGroup,
  type Group,
  type GroupTransaction,
  type MemberProfile,
  type SplitType,
} from "@/lib/api/groups";

type SplitMode = "equal" | "custom";

interface MemberWithShare extends MemberProfile {
  share: number;
}

function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function computeEqualShares(
  members: MemberProfile[],
  totalAmount: number,
): MemberWithShare[] {
  const n = members.length;
  const totalPaise = Math.round(totalAmount * 100);
  const basePaise = Math.floor(totalPaise / n);
  const remainderPaise = totalPaise - basePaise * n;

  return members.map((m, idx) => {
    const sharePaise = basePaise + (idx < remainderPaise ? 1 : 0);
    return { ...m, share: sharePaise / 100 };
  });
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [splitType, setSplitType] = useState<SplitMode>("equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(),
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [selectedTransaction, setSelectedTransaction] = useState<GroupTransaction | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [nameError, setNameError] = useState("");

  const { data: group, isLoading: isGroupLoading } = useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });

  const { data: transactionsData, isLoading: isTransactionsLoading } = useQuery(
    {
      queryKey: ["groups", groupId, "transactions"],
      queryFn: () => listGroupTransactions(groupId),
      enabled: !!groupId,
    },
  );

  const addTransactionMutation = useMutation({
    mutationFn: (data: {
      amount: number;
      description: string;
      paid_by: string;
      split_type: SplitMode;
      split_among?: string[];
      splits?: { user_id: string; amount_owed: number }[];
      date: string;
    }) => addTransaction(groupId, data),
    onSuccess: () => {
      toast.success("Transaction added");
      queryClient.invalidateQueries({
        queryKey: ["groups", groupId, "transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to add transaction");
    },
  });

  const members = group?.members ?? [];
  const transactions = transactionsData?.items ?? [];

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.has(m.id)),
    [members, selectedMemberIds],
  );

  const equalShares = useMemo(() => {
    const total = parseFloat(amount || "0");
    if (!total || selectedMembers.length === 0 || !paidBy) return [];
    return computeEqualShares(selectedMembers, total);
  }, [amount, selectedMembers, paidBy]);

  const customTotal = useMemo(() => {
    return Object.values(customShares).reduce((sum, val) => {
      const num = parseFloat(val);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [customShares]);

  const parsedAmount = parseFloat(amount || "0");
  const isCustomValid =
    splitType === "custom"
      ? Math.abs(customTotal - parsedAmount) < 0.01
      : true;

  function resetForm() {
    setAmount("");
    setDescription("");
    setPaidBy("");
    setSplitType("equal");
    setSelectedMemberIds(new Set());
    setCustomShares({});
  }

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setCustomShares((shares) => {
          const nextShares = { ...shares };
          delete nextShares[id];
          return nextShares;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllMembers() {
    setSelectedMemberIds(new Set(members.map((m) => m.id)));
  }

  function clearMemberSelection() {
    setSelectedMemberIds(new Set());
    setCustomShares({});
  }

  function handleCustomShareChange(id: string, value: string) {
    setCustomShares((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const total = parseFloat(amount);
    if (!total || total <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!description.trim()) {
      toast.error("Enter a description");
      return;
    }
    if (!paidBy) {
      toast.error("Select who paid");
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error("Select at least one member to split among");
      return;
    }
    if (!isCustomValid) {
      toast.error("Custom split amounts must sum to the total");
      return;
    }

    if (splitType === "equal") {
      addTransactionMutation.mutate({
        amount: total,
        description: description.trim(),
        paid_by: paidBy,
        split_type: "equal",
        split_among: selectedMembers.map((m) => m.id),
        date: getTodayIST(),
      });
    } else {
      const splits = selectedMembers.map((m) => ({
        user_id: m.id,
        amount_owed: parseFloat(customShares[m.id] || "0"),
      }));
      addTransactionMutation.mutate({
        amount: total,
        description: description.trim(),
        paid_by: paidBy,
        split_type: "custom",
        splits,
        date: getTodayIST(),
      });
    }
  }

  function getMemberName(id: string) {
    return members.find((m) => m.id === id)?.name ?? id;
  }

  if (isGroupLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Group not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => {
                  setEditedName(e.target.value);
                  setNameError("");
                }}
                className={nameError ? "border-red-500" : ""}
                autoFocus
              />
              <Button
                size="sm"
                onClick={async () => {
                  const trimmed = editedName.trim();
                  if (!trimmed) {
                    setNameError("Group name cannot be empty");
                    return;
                  }
                  try {
                    await updateGroup(groupId, { name: trimmed });
                    queryClient.invalidateQueries({
                      queryKey: ["groups", groupId],
                    });
                    setIsEditingName(false);
                    setNameError("");
                    toast.success("Group name updated");
                  } catch (error: any) {
                    toast.error(error.message || "Failed to update group name");
                  }
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditingName(false);
                  setEditedName(group.name);
                  setNameError("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {group.name}
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditedName(group.name);
                  setIsEditingName(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          {nameError && (
            <p className="text-sm text-red-500">{nameError}</p>
          )}
          {group.description && !isEditingName && (
            <p className="text-sm text-zinc-500">{group.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Transactions
                </CardTitle>
                <CardDescription>
                  {transactions.length} transaction
                  {transactions.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="add-transaction-button">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                    <DialogDescription>
                      Add an expense and split it among group members.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          data-testid="transaction-amount"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={getTodayIST()}
                          disabled
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Dinner"
                        data-testid="transaction-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paid-by">Paid By</Label>
                      <Select value={paidBy} onValueChange={setPaidBy}>
                        <SelectTrigger id="paid-by" data-testid="paid-by-select">
                          <SelectValue placeholder="Select payer" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} {m.id === currentUser?.id ? "(You)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Split Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSplitType("equal")}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium",
                            splitType === "equal"
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                              : "border-zinc-200 dark:border-zinc-800",
                          )}
                          data-testid="split-type-equal"
                        >
                          Equal
                        </button>
                        <button
                          type="button"
                          onClick={() => setSplitType("custom")}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium",
                            splitType === "custom"
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                              : "border-zinc-200 dark:border-zinc-800",
                          )}
                          data-testid="split-type-custom"
                        >
                          Custom
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Split Among</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={selectAllMembers}
                            className="text-xs text-zinc-500 hover:text-zinc-900"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={clearMemberSelection}
                            className="text-xs text-zinc-500 hover:text-zinc-900"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                        {members.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleMember(m.id)}
                            data-testid="member-option"
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors",
                              selectedMemberIds.has(m.id)
                                ? "bg-zinc-100 dark:bg-zinc-800"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                            )}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-sm">
                              <p className="font-medium">
                                {m.name}{" "}
                                {m.id === currentUser?.id ? "(You)" : ""}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {m.email}
                              </p>
                            </div>
                            <div
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded border",
                                selectedMemberIds.has(m.id)
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-300",
                              )}
                            >
                              {selectedMemberIds.has(m.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {splitType === "equal" && parsedAmount > 0 && (
                      <div className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                        <p className="text-sm font-medium">Equal split preview</p>
                        <div className="space-y-1">
                          {equalShares.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>
                                {m.name}{" "}
                                {m.id === paidBy ? "(Paid by)" : ""}
                              </span>
                              <span className="font-medium">
                                {m.share > 0
                                  ? formatCurrency(m.share)
                                  : "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {splitType === "custom" && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Custom amounts</p>
                        {selectedMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-2"
                          >
                            <span className="w-1/3 text-sm truncate">
                              {m.name}{" "}
                              {m.id === paidBy && (
                                <span className="text-xs text-zinc-500">
                                  (Paid by)
                                </span>
                              )}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={customShares[m.id] ?? ""}
                              onChange={(e) =>
                                handleCustomShareChange(m.id, e.target.value)
                              }
                              className="flex-1"
                            />
                          </div>
                        ))}
                        <div
                          className={cn(
                            "flex items-center justify-between text-sm",
                            !isCustomValid && "text-red-500",
                          )}
                        >
                          <span>Total entered:</span>
                          <span>
                            {formatCurrency(customTotal)} /{" "}
                            {formatCurrency(parsedAmount)}
                          </span>
                        </div>
                        {!isCustomValid && (
                          <p className="flex items-center gap-1 text-xs text-red-500">
                            <AlertCircle className="h-3 w-3" />
                            Amounts must sum to the total
                          </p>
                        )}
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="submit"
                        disabled={
                          addTransactionMutation.isPending || !isCustomValid
                        }
                        data-testid="submit-transaction"
                      >
                        {addTransactionMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Transaction
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isTransactionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    No transactions yet. Add the first one!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((t) => (
                    <div
                      key={t.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                      data-testid="transaction-item"
                      onClick={() => setSelectedTransaction(t)}
                    >
                      <div>
                        <p className="font-medium">{t.description}</p>
                        <p className="text-xs text-zinc-500">
                          Paid by {getMemberName(t.paid_by)} •{" "}
                          {formatDateIST(t.date, "date")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {formatCurrency(t.total_amount)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {t.split_type === "equal" ? "Equal" : "Custom"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium dark:bg-zinc-800">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {m.name}{" "}
                        {m.id === currentUser?.id ? "(You)" : ""}
                      </p>
                      <p className="text-xs text-zinc-500">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Your Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500">
                View detailed balances on the{" "}
                <Link
                  href="/dashboard/balances"
                  className="font-medium text-zinc-900 underline dark:text-zinc-50"
                >
                  Balances page
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Transaction Detail Modal */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTransaction?.description}</DialogTitle>
            <DialogDescription>Transaction details</DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Amount</span>
                <span className="text-lg font-bold">
                  {formatCurrency(selectedTransaction.total_amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Date</span>
                <span>{formatDateIST(selectedTransaction.date, "date")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Paid by</span>
                <span>{getMemberName(selectedTransaction.paid_by)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Split type</span>
                <span className="capitalize">
                  {selectedTransaction.split_type}
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-sm text-zinc-500">Splits</span>
                <div className="space-y-2">
                  {selectedTransaction.splits.map((split) => (
                    <div
                      key={split.user_id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
                    >
                      <span>
                        {getMemberName(split.user_id)}{" "}
                        {split.user_id === currentUser?.id && (
                          <span className="text-xs text-zinc-500">(you)</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {formatCurrency(split.amount_owed)}
                        </span>
                        {split.is_settled ? (
                          <Badge variant="secondary">Settled</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
