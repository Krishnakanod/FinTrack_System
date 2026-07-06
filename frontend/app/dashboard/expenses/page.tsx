"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Loader2, AlertTriangle, Search, X } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DateRangePicker, isDateRangeValid } from "@/components/ui/date-range-picker";
import { TransactionDetailModal } from "@/components/transactions/transaction-detail-modal";
import { useConfirmModal } from "@/lib/hooks/use-confirm-modal";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadReceiptOcr,
  confirmOcrExpense,
  EXPENSE_CATEGORIES,
  PAYMENT_TYPES,
  type Expense,
  type ExpenseCategory,
  type PaymentType,
  type OcrResult,
  type ExpenseUpdateInput,
} from "@/lib/api/expenses";
import { formatDateIST } from "@/lib/utils/format-date";
import type { ApiError } from "@/lib/api/client";

// ===== Form Schemas =====

const expenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  payment_type: z.string().min(1, "Payment type is required"),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

// ===== Constants =====

const OCR_CONFIDENCE_THRESHOLD = 0.67; // Per Spec-04 locked threshold

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

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Food: "🍔",
    Transport: "🚗",
    Shopping: "🛍️",
    Entertainment: "🎬",
    Health: "💊",
    Utilities: "💡",
    Other: "📦",
  };
  return icons[category] || "📦";
}

// ===== Main Component =====

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterPaymentType, setFilterPaymentType] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const { confirm, ConfirmModal } = useConfirmModal();

  // OCR state
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  const expenseCategoryFilter =
    filterCategory && filterCategory !== "all" ? filterCategory : undefined;
  const expensePaymentTypeFilter =
    filterPaymentType && filterPaymentType !== "all" ? filterPaymentType : undefined;

  // Fetch expenses
  const { data, isLoading } = useQuery({
    queryKey: [
      "expenses",
      {
        category: expenseCategoryFilter ?? null,
        payment_type: expensePaymentTypeFilter ?? null,
        date_from: filterDateFrom ?? null,
        date_to: filterDateTo ?? null,
      },
    ],
    queryFn: () =>
      listExpenses({
        category: expenseCategoryFilter,
        payment_type: expensePaymentTypeFilter,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      }),
  });

  const rawExpenses = data?.items ?? [];

  const filteredExpenses = rawExpenses.filter((expense) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      expense.description?.toLowerCase().includes(query) ||
      expense.category.toLowerCase().includes(query)
    );
  });

  const expenses = filteredExpenses;

  const areFiltersActive =
    (filterCategory && filterCategory !== "all") ||
    (filterPaymentType && filterPaymentType !== "all") ||
    Boolean(filterDateFrom) ||
    Boolean(filterDateTo) ||
    Boolean(searchQuery);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Expense added successfully");
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to add expense");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseUpdateInput }) =>
      updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Expense updated successfully");
      setIsAddDialogOpen(false);
      setEditingExpense(null);
      resetForm();
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update expense");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Expense deleted successfully");
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to delete expense");
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
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "",
      description: "",
      amount: "",
      date: getTodayIST(),
      payment_type: "",
    },
  });

  const watchedCategory = watch("category");
  const watchedPaymentType = watch("payment_type");

  function handleClearFilters() {
    setSearchQuery("");
    setFilterCategory("");
    setFilterPaymentType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  function resetForm() {
    reset({
      category: "",
      description: "",
      amount: "",
      date: getTodayIST(),
      payment_type: "",
    });
    setOcrResult(null);
  }

  async function handleEdit(expense: Expense) {
    const confirmed = await confirm({
      message: "You are about to edit this expense.",
      confirmLabel: "Edit",
    });
    if (!confirmed) return;

    setEditingExpense(expense);
    setValue("category", expense.category);
    setValue("description", expense.description || "");
    setValue("amount", String(expense.amount));
    setValue("date", expense.date.split("T")[0]);
    setValue("payment_type", expense.payment_type);
    setIsAddDialogOpen(true);
  }

  async function handleDelete(expense: Expense) {
    const confirmed = await confirm({
      message: "This expense will be permanently deleted.",
      confirmLabel: "Delete",
      confirmVariant: "destructive",
    });
    if (!confirmed) return;

    deleteMutation.mutate(expense.id);
  }

  function onSubmit(data: ExpenseFormValues) {
    const amountNum = parseFloat(data.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (editingExpense) {
      // Build partial payload with only changed fields for UPDATE
      const payload: ExpenseUpdateInput = {};

      if (data.category !== editingExpense.category) {
        payload.category = data.category as ExpenseCategory;
      }

      if (data.description !== editingExpense.description) {
        payload.description = data.description || "";
      }

      if (Math.abs(amountNum - editingExpense.amount) > 0.001) {
        payload.amount = amountNum;
      }

      if (data.date !== editingExpense.date) {
        payload.date = data.date;
      }

      if (data.payment_type !== editingExpense.payment_type) {
        payload.payment_type = data.payment_type as PaymentType;
      }

      // Send only if at least one field changed
      if (Object.keys(payload).length > 0) {
        updateMutation.mutate({ id: editingExpense.id, data: payload });
      } else {
        toast.info("No changes detected");
      }
    } else if (ocrResult) {
      // OCR confirm flow - must include all required fields
      confirmOcrExpense({
        category: data.category as ExpenseCategory,
        description: data.description || "",
        amount: amountNum,
        date: data.date,
        payment_type: data.payment_type as PaymentType,
        ocr_confidence: ocrResult.confidence_score,
      })
        .then((expense) => {
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["analytics"] });
          toast.success("Expense added from receipt");
          setIsAddDialogOpen(false);
          resetForm();
        })
        .catch((error: ApiError) => {
          toast.error(error.message || "Failed to save OCR expense");
        });
    } else {
      // Create NEW expense - must include all required fields
      const payload = {
        category: data.category as ExpenseCategory,
        description: data.description || "",
        amount: amountNum,
        date: data.date,
        payment_type: data.payment_type as PaymentType,
      };
      createMutation.mutate(payload);
    }
  }

  async function handleOcrUpload(file: File) {
    setIsOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const result = await uploadReceiptOcr({
            image_base64: base64,
            mime_type: file.type,
          });

          setOcrResult(result);

          // Check if OCR extracted any data
          if (!result.amount && !result.date && !result.merchant) {
            toast.error("Couldn't read receipt — please fill manually");
            return;
          }

          // Pre-fill form with extracted data
          if (result.amount) setValue("amount", String(result.amount));
          if (result.date) setValue("date", result.date);
          if (result.merchant) setValue("description", result.merchant);

          toast.success("Receipt scanned successfully");
        } catch (error) {
          const apiError = error as ApiError;
          toast.error(apiError.message || "Failed to process receipt");
        } finally {
          setIsOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to read file");
      setIsOcrLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Expenses
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track and manage your expenses
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="search"
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filterCategory}
                onValueChange={setFilterCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select
                value={filterPaymentType}
                onValueChange={setFilterPaymentType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All payment types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payment types</SelectItem>
                  {PAYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {areFiltersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-auto py-0 text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear filters
                  </Button>
                )}
              </div>
              <DateRangePicker
                from={filterDateFrom}
                to={filterDateTo}
                onFromChange={setFilterDateFrom}
                onToChange={setFilterDateTo}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            {areFiltersActive ? (
              <>
                <p className="text-sm text-zinc-500">
                  {searchQuery.trim() && !areFiltersActive
                    ? "No expenses match your search."
                    : "No expenses match your current filters."}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-500">No expenses found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  Add your first expense
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
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow
                      key={expense.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{getCategoryIcon(expense.category)}</span>
                          {expense.category}
                        </div>
                      </TableCell>
                      <TableCell>{expense.description || "—"}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.payment_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={expense.source === "ocr" ? "default" : "secondary"}
                        >
                          {expense.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(expense);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(expense);
                            }}
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
            {expenses.map((expense) => (
              <Card
                key={expense.id}
                className="cursor-pointer"
                onClick={() => setSelectedExpense(expense)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {getCategoryIcon(expense.category)}
                      </span>
                      <div>
                        <CardTitle className="text-base">
                          {expense.category}
                        </CardTitle>
                        <CardDescription>
                          {expense.description || "No description"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(expense.amount)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(expense.date)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="outline">{expense.payment_type}</Badge>
                      <Badge
                        variant={expense.source === "ocr" ? "default" : "secondary"}
                      >
                        {expense.source}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(expense);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(expense);
                        }}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? "Update the expense details below"
                : "Choose how you want to add an expense"}
            </DialogDescription>
          </DialogHeader>

          {!editingExpense && (
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="ocr">Scan Receipt</TabsTrigger>
              </TabsList>

              <TabsContent value="ocr" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Receipt Image</Label>
                  <div className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center dark:border-zinc-700">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrUpload(file);
                      }}
                      className="hidden"
                      id="receipt-upload"
                    />
                    <label
                      htmlFor="receipt-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {isOcrLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                      ) : (
                        <Upload className="h-8 w-8 text-zinc-400" />
                      )}
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {isOcrLoading
                          ? "Processing receipt..."
                          : "Click to upload or drag and drop"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        JPG or PNG, max 5MB
                      </span>
                    </label>
                  </div>
                </div>

                {ocrResult && ocrResult.confidence_score < OCR_CONFIDENCE_THRESHOLD && (
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950/20">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Please double-check the extracted values
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        The OCR confidence was low. Review and edit the form below before saving.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What was this expense for?"
                {...register("description")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingExpense(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
                {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingExpense
                  ? "Update Expense"
                  : ocrResult
                  ? "Confirm & Save"
                  : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TransactionDetailModal
        transaction={selectedExpense}
        type="expense"
        open={!!selectedExpense}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
      />
      <ConfirmModal />
    </div>
  );
}
