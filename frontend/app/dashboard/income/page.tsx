"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  PAYMENT_TYPES,
  type Income,
  type IncomeSourceType,
  type PaymentType,
  type IncomeUpdateInput,
} from "@/lib/api/income";
import { listFriends, type FriendProfile } from "@/lib/api/friends";
import { formatDateIST } from "@/lib/utils/format-date";
import type { ApiError } from "@/lib/api/client";

// ===== Form Schema =====

const incomeSchema = z.object({
  source_type: z.enum(["salary", "from_friend"]),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  payment_type: z.string().min(1, "Payment type is required"),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

// ===== Helper Functions =====

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return formatDateIST(dateStr, "date");
}

function getTodayIST(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

function getSourceIcon(sourceType: string): string {
  return sourceType === "salary" ? "💰" : "👥";
}

function getSourceLabel(sourceType: string): string {
  return sourceType === "salary" ? "Salary" : "From Friend";
}

// ===== Main Component =====

export default function IncomePage() {
  const queryClient = useQueryClient();

  // Filter state
  const [filterSourceType, setFilterSourceType] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<Income | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");

  // Fetch friends for "From Friend" dropdown (Sprint 6 — replaces Sprint 5 stub)
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: listFriends,
    staleTime: 60 * 1000,
  });
  const friends = friendsData?.items ?? [];

  const incomeSourceTypeFilter =
    filterSourceType && filterSourceType !== "all" ? filterSourceType : undefined;

  // Fetch income
  const { data, isLoading } = useQuery({
    queryKey: [
      "income",
      {
        source_type: incomeSourceTypeFilter ?? null,
        date_from: filterDateFrom ?? null,
        date_to: filterDateTo ?? null,
      },
    ],
    queryFn: () =>
      listIncome({
        source_type: incomeSourceTypeFilter,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      }),
  });

  const incomes = data?.items ?? [];

  const areFiltersActive =
    (filterSourceType && filterSourceType !== "all") ||
    Boolean(filterDateFrom) ||
    Boolean(filterDateTo);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Income added successfully");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to add income");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IncomeUpdateInput }) =>
      updateIncome(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Income updated successfully");
      setIsAddDialogOpen(false);
      setEditingIncome(null);
      resetForm();
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update income");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Income deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingIncome(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to delete income");
    },
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      source_type: "salary",
      description: "",
      amount: "",
      date: getTodayIST(),
      payment_type: "",
    },
  });

  const watchedSourceType = watch("source_type");
  const watchedPaymentType = watch("payment_type");

  function handleDateFromChange(value: string) {
    setFilterDateFrom(value);
    if (filterDateTo && value > filterDateTo) {
      setFilterDateTo(value);
    }
  }

  function handleDateToChange(value: string) {
    setFilterDateTo(value);
    if (filterDateFrom && value < filterDateFrom) {
      setFilterDateFrom(value);
    }
  }

  function resetForm() {
    reset({
      source_type: "salary",
      description: "",
      amount: "",
      date: getTodayIST(),
      payment_type: "",
    });
    setSelectedFriendId("");
  }

  function handleEdit(income: Income) {
    setEditingIncome(income);
    setValue("source_type", income.source_type);
    setValue("description", income.description || "");
    setValue("amount", String(income.amount));
    setValue("date", income.date.split("T")[0]);
    setValue("payment_type", income.payment_type);
    if (income.friend_id) {
      setSelectedFriendId(income.friend_id);
    }
    setIsAddDialogOpen(true);
  }

  function handleDelete(income: Income) {
    setDeletingIncome(income);
    setIsDeleteDialogOpen(true);
  }

  function onSubmit(data: IncomeFormValues) {
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (editingIncome) {
      // Build partial payload with only changed fields for UPDATE
      const payload: IncomeUpdateInput = {};

      if (data.source_type !== editingIncome.source_type) {
        payload.source_type = data.source_type as IncomeSourceType;
      }

      if (data.description !== editingIncome.description) {
        payload.description = data.description || "";
      }

      if (Math.abs(amountNum - editingIncome.amount) > 0.001) {
        payload.amount = amountNum;
      }

      if (data.date !== editingIncome.date) {
        payload.date = data.date;
      }

      if (data.payment_type !== editingIncome.payment_type) {
        payload.payment_type = data.payment_type as PaymentType;
      }

      // Send only if at least one field changed
      if (Object.keys(payload).length > 0) {
        updateMutation.mutate({ id: editingIncome.id, data: payload });
      } else {
        toast.info("No changes detected");
      }
    } else {
      // Create NEW income - must include all required fields
      const payload = {
        source_type: data.source_type as IncomeSourceType,
        friend_id: data.source_type === "from_friend" ? selectedFriendId || null : null,
        description: data.description || "",
        amount: amountNum,
        date: data.date,
        payment_type: data.payment_type as PaymentType,
      };
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Income
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track your income sources
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select
                value={filterSourceType}
                onValueChange={setFilterSourceType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="from_friend">From Friend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            From date cannot be after To date.
          </p>
        </CardContent>
      </Card>

      {/* Income List */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </CardContent>
        </Card>
      ) : incomes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            {areFiltersActive ? (
              <>
                <p className="text-sm text-zinc-500">
                  No income entries match your current filters.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setFilterSourceType("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-500">No income records found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add your first income
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.map((income) => (
                    <TableRow key={income.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{getSourceIcon(income.source_type)}</span>
                          {getSourceLabel(income.source_type)}
                        </div>
                      </TableCell>
                      <TableCell>{income.description || "—"}</TableCell>
                      <TableCell className="font-semibold text-green-600 dark:text-green-500">
                        +{formatCurrency(income.amount)}
                      </TableCell>
                      <TableCell>{formatDate(income.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{income.payment_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(income)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(income)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {incomes.map((income) => (
              <Card key={income.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {getSourceIcon(income.source_type)}
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {getSourceLabel(income.source_type)}
                        </CardTitle>
                        <CardDescription>
                          {income.description || "No description"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-500">
                        +{formatCurrency(income.amount)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(income.date)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{income.payment_type}</Badge>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(income)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(income)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIncome ? "Edit Income" : "Add Income"}
            </DialogTitle>
            <DialogDescription>
              {editingIncome
                ? "Update the income details below"
                : "Record a new income source"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Source Type *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={watchedSourceType === "salary" ? "default" : "outline"}
                  onClick={() => setValue("source_type", "salary")}
                  className="w-full"
                >
                  💰 Salary
                </Button>
                <Button
                  type="button"
                  variant={watchedSourceType === "from_friend" ? "default" : "outline"}
                  onClick={() => setValue("source_type", "from_friend")}
                  className="w-full"
                >
                  👥 From Friend
                </Button>
              </div>
              {errors.source_type && (
                <p className="text-sm text-red-500">{errors.source_type.message}</p>
              )}
              {watchedSourceType === "from_friend" && (
                <div className="space-y-2">
                  <Label htmlFor="friend-select">Select Friend *</Label>
                  <Select
                    value={selectedFriendId}
                    onValueChange={setSelectedFriendId}
                  >
                    <SelectTrigger id="friend-select">
                      <SelectValue placeholder="Choose a friend..." />
                    </SelectTrigger>
                    <SelectContent>
                      {friends.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-zinc-500">
                          No friends in your list. Add friends first.
                        </div>
                      ) : (
                        friends.map((friend) => (
                          <SelectItem key={friend.id} value={friend.id}>
                            {friend.name} ({friend.email})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {watchedSourceType === "from_friend" && !selectedFriendId && (
                    <p className="text-xs text-zinc-500">
                      Select a friend to associate with this income
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this income for?"
                {...register("description")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount")}
                />
                {errors.amount && (
                  <p className="text-sm text-red-500">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  {...register("date")}
                />
                {errors.date && (
                  <p className="text-sm text-red-500">{errors.date.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_type">Payment Type *</Label>
              <Select
                value={watchedPaymentType}
                onValueChange={(val) => setValue("payment_type", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_type && (
                <p className="text-sm text-red-500">{errors.payment_type.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingIncome(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingIncome ? "Update Income" : "Add Income"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this income record? This action cannot be undone.
              {deletingIncome && (
                <div className="mt-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                  <p className="font-medium">{getSourceLabel(deletingIncome.source_type)}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatCurrency(deletingIncome.amount)} • {formatDate(deletingIncome.date)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingIncome(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingIncome) {
                  deleteMutation.mutate(deletingIncome.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
