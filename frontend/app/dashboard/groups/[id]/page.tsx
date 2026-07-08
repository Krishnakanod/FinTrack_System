"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  Search,
  Trash2,
  Users,
  X,
  LogOut,
  UserPlus,
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
import { useConfirmModal } from "@/lib/hooks/use-confirm-modal";
import {
  getGroup,
  listGroupTransactions,
  addTransaction,
  addMember,
  updateGroup,
  updateGroupTransaction,
  deleteGroupTransaction,
  deleteGroup,
  exitGroup,
  type Group,
  type GroupTransaction,
  type MemberProfile,
  type SplitType,
} from "@/lib/api/groups";
import { listFriends } from "@/lib/api/friends";

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
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const { confirm, ConfirmModal } = useConfirmModal();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(true);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(getTodayIST());
  const [splitType, setSplitType] = useState<SplitMode>("equal");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(),
  );
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [selectedTransaction, setSelectedTransaction] = useState<GroupTransaction | null>(null);
  const [transactionSearch, setTransactionSearch] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");

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

  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: () => listFriends(),
    enabled: !!groupId && isAddMemberOpen,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => addMember(groupId, userId),
    onSuccess: () => {
      toast.success("Member added");
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      setSelectedFriendId("");
      setIsAddMemberOpen(false);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      toast.success("Group deleted");
      router.push("/dashboard/groups");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to delete group");
    },
  });

  const exitGroupMutation = useMutation({
    mutationFn: () => exitGroup(groupId),
    onSuccess: () => {
      toast.success("You have left the group");
      router.push("/dashboard/groups");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to exit group");
    },
  });
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

  const updateTransactionMutation = useMutation({
    mutationFn: (data: {
      amount: number;
      description: string;
      paid_by: string;
      split_type: SplitMode;
      split_among?: string[];
      splits?: { user_id: string; amount_owed: number }[];
      date: string;
    }) => updateGroupTransaction(groupId, editingTransactionId!, data),
    onSuccess: () => {
      toast.success("Transaction updated");
      queryClient.invalidateQueries({
        queryKey: ["groups", groupId, "transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
      setIsDialogOpen(false);
      setEditingTransactionId(null);
      setSelectedTransaction(null);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to update transaction");
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: ({ transactionId }: { transactionId: string }) =>
      deleteGroupTransaction(groupId, transactionId),
    onSuccess: () => {
      toast.success("Transaction deleted");
      queryClient.invalidateQueries({
        queryKey: ["groups", groupId, "transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setSelectedTransaction(null);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to delete transaction");
    },
  });

  const members = group?.members ?? [];
  const transactions = transactionsData?.items ?? [];

  const filteredTransactions = transactions.filter((t) => {
    if (!transactionSearch.trim()) return true;
    return t.description.toLowerCase().includes(transactionSearch.toLowerCase());
  });

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

  function openAddDialog() {
    resetForm();
    setIsAddMode(true);
    setEditingTransactionId(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(transaction: GroupTransaction) {
    resetForm();
    setIsAddMode(false);
    setEditingTransactionId(transaction.id);
    setAmount(String(transaction.total_amount));
    setDescription(transaction.description);
    setPaidBy(transaction.paid_by);
    setTransactionDate(transaction.date.split("T")[0]);
    setSplitType(transaction.split_type);
    setSelectedMemberIds(new Set(transaction.splits.map((s) => s.user_id)));
    if (transaction.split_type === "custom") {
      const shares: Record<string, string> = {};
      transaction.splits.forEach((s) => {
        shares[s.user_id] = String(s.amount_owed);
      });
      setCustomShares(shares);
    }
    setIsDialogOpen(true);
  }

  function resetForm() {
    setAmount("");
    setDescription("");
    setPaidBy("");
    setTransactionDate(getTodayIST());
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

    const mutation = isAddMode ? addTransactionMutation : updateTransactionMutation;

    if (splitType === "equal") {
      mutation.mutate({
        amount: total,
        description: description.trim(),
        paid_by: paidBy,
        split_type: "equal",
        split_among: selectedMembers.map((m) => m.id),
        date: transactionDate,
      });
    } else {
      const splits = selectedMembers.map((m) => ({
        user_id: m.id,
        amount_owed: parseFloat(customShares[m.id] || "0"),
      }));
      mutation.mutate({
        amount: total,
        description: description.trim(),
        paid_by: paidBy,
        split_type: "custom",
        splits,
        date: transactionDate,
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
        {currentUser?.id === group?.created_by && (
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddMemberOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const confirmed = await confirm({
                  message: "This group and all its transactions will be permanently deleted.",
                  confirmLabel: "Delete",
                  confirmVariant: "destructive",
                });
                if (confirmed) {
                  deleteGroupMutation.mutate();
                }
              }}
              disabled={deleteGroupMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Group
            </Button>
          </>
        )}
        {currentUser?.id !== group?.created_by && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const confirmed = await confirm({
                message: "You will be removed from this group.",
                confirmLabel: "Exit",
              });
              if (confirmed) {
                exitGroupMutation.mutate();
              }
            }}
            disabled={exitGroupMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Exit Group
          </Button>
        )}
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
                  if (trimmed.length < 3 || trimmed.length > 50) {
                    setNameError("Group name must be between 3 and 50 characters");
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
              {group.created_by === currentUser?.id && (
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
              )}
            </div>
          )}
          {nameError && (
            <p className="text-sm text-red-500">{nameError}</p>
          )}
          <p className="text-sm text-zinc-500">
            Created by {group.created_by === currentUser?.id ? "You" : `@${group.created_by_name}`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Transactions
                </CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transaction
                  {filteredTransactions.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search transactions..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button data-testid="add-transaction-button" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {isAddMode ? "Add Transaction" : "Edit Transaction"}
                    </DialogTitle>
                    <DialogDescription>
                      {isAddMode
                        ? "Add an expense and split it among group members."
                        : "Update the transaction details."}
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
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
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
              ) : filteredTransactions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-500">
                    No transactions match your search.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((t) => (
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
              {selectedTransaction.paid_by === currentUser?.id && (
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const confirmed = await confirm({
                        message:
                          "You are about to edit this transaction for all group members.",
                        confirmLabel: "Edit",
                      });
                      if (confirmed && selectedTransaction) {
                        const tx = selectedTransaction;
                        setSelectedTransaction(null);
                        openEditDialog(tx);
                      }
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const confirmed = await confirm({
                        message:
                          "This transaction will be permanently deleted for all group members.",
                        confirmLabel: "Delete",
                        confirmVariant: "destructive",
                      });
                      if (confirmed && selectedTransaction) {
                        deleteTransactionMutation.mutate({
                          transactionId: selectedTransaction.id,
                        });
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmModal />
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Select a friend to add to this group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedFriendId} onValueChange={setSelectedFriendId}>
              <SelectTrigger id="friend-select">
                <SelectValue placeholder="Select a friend" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const memberIds = new Set(members.map((m) => m.id));
                  const availableFriends =
                    friendsData?.items.filter((f) => !memberIds.has(f.id)) ?? [];
                  return availableFriends.length === 0 ? (
                    <SelectItem value="no-friends" disabled>
                      No available friends
                    </SelectItem>
                  ) : (
                    availableFriends.map((friend) => (
                      <SelectItem key={friend.id} value={friend.id}>
                        {friend.name} ({friend.email})
                      </SelectItem>
                    ))
                  );
                })()}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMemberOpen(false);
                setSelectedFriendId("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedFriendId) {
                  toast.error("Select a friend to add");
                  return;
                }
                addMemberMutation.mutate(selectedFriendId);
              }}
              disabled={!selectedFriendId || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
