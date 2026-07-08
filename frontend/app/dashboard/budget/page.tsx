"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, PiggyBank } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetStatus,
  BUDGET_PERIODS,
  EXPENSE_CATEGORIES,
  type Budget,
  type BudgetUpdateInput,
  type BudgetStatus,
} from "@/lib/api/budgets";
import type { ApiError } from "@/lib/api/client";

// ===== Form Schemas =====

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  period: z.string().min(1, "Period is required"),
  amount: z.string().min(1, "Amount is required").refine(val => !Number.isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number"
  }),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

// ===== Helper Functions =====

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Food: "🍎",
    Transport: "🚗",
    Shopping: "🛍️",
    Entertainment: "",
    Health: "🏥",
    Utilities: "💡",
    Other: "📦",
  };
  return icons[category] || "📦";
}

function getProgressColor(percentage: number, isOver: boolean, isAtLimit: boolean): string {
  if (isOver) return "bg-red-500";
  if (isAtLimit) return "bg-orange-500";
  if (percentage >= 80) return "bg-yellow-500";
  return "bg-green-500";
}

function getProgressTextColor(percentage: number, isOver: boolean, isAtLimit: boolean): string {
  if (isOver) return "text-red-600 dark:text-red-400";
  if (isAtLimit) return "text-orange-600 dark:text-orange-400";
  if (percentage >= 80) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getBudgetStatusText(percentage: number, isOver: boolean, isAtLimit: boolean): string {
  if (isOver) return "Over Budget!";
  if (isAtLimit) return "100%";
  return `${percentage}%`;
}

// ===== Main Component =====

export default function BudgetPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);

  // Fetch budget status (includes spending data)
  const { data: budgetStatusData, isLoading: isBudgetStatusLoading } = useQuery({
    queryKey: ["budget-status"],
    queryFn: getBudgetStatus,
  });

  const budgetStatus = budgetStatusData || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-status"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget created successfully");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: ApiError) => {
      if (error.error === "BUDGET_ALREADY_EXISTS") {
        toast.error("A budget for this category and period already exists. Edit it instead.");
      } else {
        toast.error(error.message || "Failed to create budget");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BudgetUpdateInput }) =>
      updateBudget(id, data),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["budget-status"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget updated successfully");
      setIsAddDialogOpen(false);
      setEditingBudget(null);
      resetForm();
    },
    onError: (error: ApiError) => {
      if (error.error === "BUDGET_ALREADY_EXISTS") {
        toast.error("A budget for this category and period already exists.");
      } else {
        toast.error(error.message || "Failed to update budget");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-status"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletingBudget(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to delete budget");
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
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "",
      period: "",
      amount: "",
    },
  });

  const watchedCategory = watch("category");
  const watchedPeriod = watch("period");

  function resetForm() {
    reset({
      category: "",
      period: "",
      amount: "",
    });
  }

  function handleEdit(budget: BudgetStatus) {
    setEditingBudget(budget);
    setValue("category", budget.category);
    setValue("period", budget.period);
    setValue("amount", String(budget.amount));
    setIsAddDialogOpen(true);
  }

  function handleDelete(budget: BudgetStatus) {
    setDeletingBudget(budget);
    setIsDeleteDialogOpen(true);
  }

  function onSubmit(data: BudgetFormValues) {
    const amountNum = Number.parseFloat(data.amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (editingBudget) {
      // Build partial update payload with only changed fields
      const payload: BudgetUpdateInput = {};

      if (data.category !== editingBudget.category) {
        payload.category = data.category as any;
      }
      if (data.period !== editingBudget.period) {
        payload.period = data.period as any;
      }
      if (Math.abs(amountNum - editingBudget.amount) > 0.001) {
        payload.amount = amountNum;
      }

      if (Object.keys(payload).length === 0) {
        toast.info("No changes detected");
        return;
      }

      updateMutation.mutate({
        id: editingBudget.id,
        data: payload,
      });
    } else {
      createMutation.mutate({
        category: data.category as any,
        period: data.period as any,
        amount: amountNum,
      });
    }
  }

  function renderBudgetCards() {
    if (isBudgetStatusLoading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-pulse flex flex-col space-y-4 w-full">
              <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
              <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
              <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (budgetStatus.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PiggyBank className="h-12 w-12 text-zinc-400 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">
              No budgets set yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Create your first budget to start tracking your spending limits
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Set Budget
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {budgetStatus.map((budget) => {
          // Three states based on exact arithmetic (avoids backend rounding artifacts)
          const isOver     = budget.current_spend >  budget.amount; // strictly over
          const isAtLimit  = budget.current_spend === budget.amount; // exactly equal
          const rawPercentage =
            budget.amount > 0
              ? (budget.current_spend / budget.amount) * 100
              : 0;
          // When not over and not at limit, cap at 99.9 so rounded 100.0 from
          // backend never displays while "Left: ₹X" is still shown
          const displayPercentage = isOver || isAtLimit
            ? 100
            : Math.min(Math.round(rawPercentage * 10) / 10, 99.9);
          const progressColor = getProgressColor(displayPercentage, isOver, isAtLimit);

          return (
            <Card key={budget.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCategoryIcon(budget.category)}</span>
                    <div>
                      <CardTitle className="text-base">
                        {budget.category}
                      </CardTitle>
                      <CardDescription>
                        {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(budget)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(budget)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-500 dark:text-zinc-400">Spent</span>
                    <span className="font-medium">
                      {formatCurrency(budget.current_spend)} / {formatCurrency(budget.amount)}
                    </span>
                  </div>
                  <Progress
                    value={displayPercentage}
                    className={`h-2 ${progressColor}`}
                  />
                  <div className="flex justify-between mt-1">
                    <span className={`text-sm font-medium ${getProgressTextColor(displayPercentage, isOver, isAtLimit)}`}>
                      {getBudgetStatusText(displayPercentage, isOver, isAtLimit)}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {isOver
                        ? `Over by: ${formatCurrency(budget.current_spend - budget.amount)}`
                        : `Left: ${formatCurrency(budget.amount - budget.current_spend)}`}
                    </span>
                  </div>
                </div>

                {isOver && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        Exceeded Budget!
                      </span>
                    </div>
                  </div>
                )}

                {isAtLimit && (
                  <div className="mt-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        Budget Limit Reached!
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Budgets
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Set and track your spending limits
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Set Budget
        </Button>
      </div>

      {/* Budget Status Cards */}
      {renderBudgetCards()}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? "Edit Budget" : "Set Budget Goal"}
            </DialogTitle>
            <DialogDescription>
              {editingBudget
                ? "Update the budget details below"
                : "Define your spending limit for a category and time period"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watchedCategory}
                onValueChange={(val) => setValue("category", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryIcon(cat)} {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">Time Period *</Label>
              <Select
                value={watchedPeriod}
                onValueChange={(val) => setValue("period", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period && (
                <p className="text-sm text-red-500">{errors.period.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Budget Amount () *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-9"
                  {...register("amount")}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingBudget(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
              >
                {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingBudget
                  ? "Update Budget"
                  : "Set Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this budget? This action cannot be undone.
              {deletingBudget && (
                <span className="mt-2 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800 block">
                  <span className="font-medium block">
                    {deletingBudget.category} ({deletingBudget.period})
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 block">
                    Budget: {formatCurrency(deletingBudget.amount)}
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingBudget(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBudget) {
                  deleteMutation.mutate(deletingBudget.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
